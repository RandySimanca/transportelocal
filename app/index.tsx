import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Nota: setNotificationHandler está configurado globalmente en _layout.tsx

export default function HomeScreen() {
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [updateMessage, setUpdateMessage] = useState('');
    const [pushTokenStatus, setPushTokenStatus] = useState('No registrado');
    const router = useRouter();

    useEffect(() => {
        checkUpdatesAndAuth();
    }, []);

    async function checkUpdatesAndAuth() {
        await onFetchUpdateAsync();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Si hay usuario, intentamos registrar notificaciones de una vez
                await registerForPushNotificationsAsync(user.uid);

                // Check if it's a driver
                try {
                    const driverDoc = await getDoc(doc(db, 'conductores', user.uid));
                    if (driverDoc.exists()) {
                        router.replace('/driver/dashboard');
                        return;
                    }
                } catch (error) {
                    console.error("Error checking driver status:", error);
                }
            }
            setCheckingAuth(false);
        });

        return () => unsubscribe();
    }

    async function onFetchUpdateAsync(manual = false) {
        try {
            if (__DEV__) {
                console.log("HomeScreen: Skipping update check in DEV mode");
                if (manual) Alert.alert("Modo Desarrollo", "Las actualizaciones OTA no funcionan en modo desarrollo.");
                return;
            }

            console.log("HomeScreen: Checking for updates...");
            if (manual) setUpdateMessage('Buscando actualizaciones...');

            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                console.log("HomeScreen: Update available, fetching...");
                setUpdateMessage('Descargando nueva actualización...');
                await Updates.fetchUpdateAsync();
                setUpdateMessage('Actualización lista. Reiniciando...');
                Alert.alert("Actualización", "Nueva versión descargada. Reiniciando app...", [
                    { text: "OK", onPress: async () => await Updates.reloadAsync() }
                ]);
            } else {
                console.log("HomeScreen: No updates available.");
                if (manual) {
                    setUpdateMessage('');
                    Alert.alert("Actualizado", "Ya tienes la última versión.");
                }
            }
        } catch (error) {
            console.log(`Error fetching latest Expo update: ${error}`);
            if (manual) {
                setUpdateMessage('');
                Alert.alert("Error OTA", "No se pudo buscar actualizaciones: " + error);
            }
        }
    }

    async function registerForPushNotificationsAsync(uid: string) {
        if (!Device.isDevice) {
            setPushTokenStatus('No es dispositivo físico');
            return;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                setPushTokenStatus('Permiso denegado');
                return;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.extra?.projectId;
            if (!projectId) {
                setPushTokenStatus('Falta Project ID');
                console.error("Project ID not found in app config");
                return;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const token = tokenData.data;
            console.log("HomeScreen: Push Token:", token);
            setPushTokenStatus('Token obtenido');

            // Guardar el token en la colección correspondiente
            // Primero intentamos ver si es conductor
            const driverDoc = await getDoc(doc(db, 'conductores', uid));
            if (driverDoc.exists()) {
                await updateDoc(doc(db, 'conductores', uid), { pushToken: token });
                setPushTokenStatus('Token guardado (Conductor)');
            } else {
                // Si no es conductor, lo guardamos en usuarios (pasajeros)
                await setDoc(doc(db, 'usuarios', uid), {
                    pushToken: token,
                    lastSeen: new Date()
                }, { merge: true });
                setPushTokenStatus('Token guardado (Usuario)');
            }
        } catch (error) {
            console.error("HomeScreen: Error en registro de notificaciones:", error);
            setPushTokenStatus(`Error: ${error}`);
        }
    }

    if (checkingAuth || updateMessage) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="white" />
                {updateMessage ? (
                    <Text style={{ color: 'white', marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                        {updateMessage}
                    </Text>
                ) : null}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Transporte Local</Text>
                    <Text style={styles.subtitle}>Conectando pasajeros y conductores de forma rápida y segura.</Text>
                </View>

                <View style={styles.cardsContainer}>
                    {/* User Card */}
                    <Link href="/user" asChild>
                        <TouchableOpacity style={styles.card}>
                            <View style={[styles.iconContainer, { backgroundColor: '#3b82f6' }]}>
                                <FontAwesome5 name="user" size={32} color="white" />
                            </View>
                            <Text style={styles.cardTitle}>Soy Usuario</Text>
                            <Text style={styles.cardText}>Busca conductores disponibles cerca de ti y contáctalos por WhatsApp.</Text>
                        </TouchableOpacity>
                    </Link>

                    {/* Driver Card */}
                    <Link href="/driver/login" asChild>
                        <TouchableOpacity style={styles.card}>
                            <View style={[styles.iconContainer, { backgroundColor: '#10b981' }]}>
                                <FontAwesome5 name="car" size={32} color="white" />
                            </View>
                            <Text style={styles.cardTitle}>Soy Conductor</Text>
                            <Text style={styles.cardText}>Regístrate, verifica tu cuenta y empieza a recibir solicitudes de viaje.</Text>
                        </TouchableOpacity>
                    </Link>

                    {/* Admin Card */}
                    <Link href="/admin/login" asChild>
                        <TouchableOpacity style={styles.card}>
                            <View style={[styles.iconContainer, { backgroundColor: '#9333ea' }]}>
                                <MaterialIcons name="admin-panel-settings" size={32} color="white" />
                            </View>
                            <Text style={styles.cardTitle}>Administrador</Text>
                            <Text style={styles.cardText}>Gestiona usuarios, verifica conductores y administra la plataforma.</Text>
                        </TouchableOpacity>
                    </Link>
                </View>

                {/* (debug info)
                <View style={styles.debugContainer}>
                    <Text style={styles.debugTitle}>Debug Info</Text>
                   <Text style={styles.debugText}>ID: {Constants.expoConfig?.extra?.eas?.projectId || 'N/A'}</Text>
                    <Text style={styles.debugText}>RV: {Updates.runtimeVersion || 'N/A'}</Text>
                    <Text style={styles.debugText}>Channel: {Updates.channel || 'N/A'}</Text>
                    <Text style={styles.debugText}>Push Status: {pushTokenStatus}</Text> 
                    <TouchableOpacity
                        style={styles.debugButton}
                        onPress={() => onFetchUpdateAsync(true)}
                    >
                        <MaterialIcons name="system-update" size={16} color="white" />
                        <Text style={styles.debugButtonText}>Buscar Actualización</Text>
                    </TouchableOpacity>
                </View>*/}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#3b82f6',
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    header: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontSize: 40,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        color: '#dbeafe',
        fontSize: 16,
        textAlign: 'center',
    },
    cardsContainer: {
        width: '100%',
        maxWidth: 400,
        gap: 24,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        padding: 16,
        borderRadius: 50,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    cardText: {
        color: '#dbeafe',
        fontSize: 14,
        textAlign: 'center',
    },
    debugContainer: {
        marginTop: 32,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
    },
    debugTitle: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 8,
        fontSize: 12,
    },
    debugText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontFamily: 'monospace',
        marginBottom: 4,
        textAlign: 'center',
    },
    debugButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
        marginTop: 8,
        gap: 6,
    },
    debugButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
});
