import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

export default function DriverRegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [tipoServicio, setTipoServicio] = useState('mototaxi');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async () => {
        if (!email || !password || !nombre || !telefono) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, 'conductores', user.uid), {
                nombre,
                telefono,
                tipoServicio,
                verificado: false,
                disponible: false,
                email: user.email,
                fechaRegistro: new Date().toISOString(),
            });

            Alert.alert(
                'Registro Exitoso',
                'Tu cuenta ha sido creada. Un administrador verificará tu información pronto.',
                [{ text: 'OK', onPress: () => router.replace('/driver/dashboard') }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo crear la cuenta');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Registro Conductor', headerShown: true }} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <FontAwesome5 name="user-plus" size={48} color="white" />
                        </View>
                        <Text style={styles.title}>Registro de Conductor</Text>
                        <Text style={styles.subtitle}>Completa tus datos para comenzar</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre Completo</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Juan Pérez"
                                value={nombre}
                                onChangeText={setNombre}
                                autoComplete="name"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Teléfono (con código de país)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+573001234567"
                                value={telefono}
                                onChangeText={setTelefono}
                                keyboardType="phone-pad"
                                autoComplete="tel"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Tipo de Servicio</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={tipoServicio}
                                    onValueChange={(itemValue) => setTipoServicio(itemValue)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Mototaxi" value="mototaxi" />
                                    <Picker.Item label="Carromoto" value="carromoto" />
                                    <Picker.Item label="Carguero" value="carguero" />
                                    <Picker.Item label="Taxi" value="taxi" />
                                    <Picker.Item label="Camión Ganado" value="camion_ganado" />
                                    <Picker.Item label="Camioneta 4X4" value="camioneta_4x4" />
                                    <Picker.Item label="Furgón" value="furgon" />
                                    <Picker.Item label="Turbo" value="turbo" />
                                    <Picker.Item label="Volqueta" value="volqueta" />
                                </Picker>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Correo Electrónico</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="tu@email.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Contraseña</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoComplete="password-new"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>{loading ? 'Registrando...' : 'Registrarse'}</Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                            <Link href="/driver/login" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.link}>Inicia sesión aquí</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#10b981',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 20,
        borderRadius: 50,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#d1fae5',
        textAlign: 'center',
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f9fafb',
        color: '#1f2937',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
    },
    button: {
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    footerText: {
        color: '#6b7280',
        fontSize: 14,
    },
    link: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '600',
    },
});
