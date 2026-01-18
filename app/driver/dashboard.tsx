import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';



interface Driver {
    nombre: string;
    email: string;
    telefono: string;
    tipoServicio: string;
    apodo?: string;
    fotoURL?: string;
    verificado: boolean;
    disponible: boolean;
    pushToken?: string;
}

export default function DriverDashboard() {
    const [driver, setDriver] = useState<Driver | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [apodo, setApodo] = useState('');
    const router = useRouter();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchDriverProfile(user.uid);
            } else {
                router.replace('/driver/login');
            }
        });
        return () => unsub();
    }, []);


    const fetchDriverProfile = async (uid: string) => {
        try {
            const docSnap = await getDoc(doc(db, 'conductores', uid));
            if (docSnap.exists()) {
                const data = docSnap.data() as Driver;
                setDriver(data);
                setApodo(data.apodo || '');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets[0]) {
            await handlePhotoUpload(result.assets[0].uri);
        }
    };

    const handlePhotoUpload = async (uri: string) => {
        if (!auth.currentUser) return;

        setUploading(true);
        try {
            // En una app real, subirías a Firebase Storage
            // Por ahora solo guardamos la URI local
            await updateDoc(doc(db, 'conductores', auth.currentUser.uid), {
                fotoURL: uri,
            });

            setDriver(prev => prev ? { ...prev, fotoURL: uri } : null);
            Alert.alert('Éxito', 'Foto actualizada correctamente');
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la foto');
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const updateNickname = async () => {
        if (!auth.currentUser || !apodo.trim()) return;

        try {
            await updateDoc(doc(db, 'conductores', auth.currentUser.uid), {
                apodo: apodo.trim(),
            });
            setDriver(prev => prev ? { ...prev, apodo: apodo.trim() } : null);
            Alert.alert('Éxito', 'Apodo actualizado correctamente');
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el apodo');
            console.error(error);
        }
    };

    const toggleAvailability = async (value: boolean) => {
        if (!auth.currentUser) return;

        try {
            await updateDoc(doc(db, 'conductores', auth.currentUser.uid), {
                disponible: value,
            });
            setDriver(prev => prev ? { ...prev, disponible: value } : null);
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la disponibilidad');
            console.error(error);
        }
    };

    const [activeTab, setActiveTab] = useState<'profile' | 'messages'>('profile');
    const [chats, setChats] = useState<any[]>([]);

    useEffect(() => {
        if (!auth.currentUser || activeTab !== 'messages') return;

        const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', auth.currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            // Ordenar por fecha en el cliente para evitar el requisito de índice compuesto
            chatsData.sort((a, b) => {
                const timeA = a.lastTimestamp?.toDate?.()?.getTime() || 0;
                const timeB = b.lastTimestamp?.toDate?.()?.getTime() || 0;
                return timeB - timeA;
            });

            setChats(chatsData);
        }, (error) => {
            console.error("Error en el listener de chats:", error);
        });

        return () => unsubscribe();
    }, [activeTab]);

    const sendTestNotification = async () => {
        if (!auth.currentUser || !driver?.pushToken) {
            Alert.alert("Error", "No tienes un token de notificación registrado.");
            return;
        }

        try {
            const message = {
                to: driver.pushToken,
                sound: 'default',
                title: 'Prueba de Notificación',
                body: 'Si ves esto, las notificaciones funcionan correctamente.',
                data: { test: true },
            };

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            Alert.alert("Enviado", "Se ha enviado una notificación de prueba.");
        } catch (error) {
            Alert.alert("Error", "Falló el envío de la notificación: " + error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/driver/login');
        } catch (error) {
            Alert.alert('Error', 'No se pudo cerrar sesión');
            console.error(error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Cargando perfil...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!driver) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Mi Dashboard', headerShown: true }} />

            {/* Tab Switcher */}
            <View style={[styles.tabContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
                    onPress={() => setActiveTab('profile')}
                >
                    <FontAwesome5 name="user" size={18} color={activeTab === 'profile' ? '#10b981' : '#6b7280'} />
                    <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Perfil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
                    onPress={() => setActiveTab('messages')}
                >
                    <View>
                        <FontAwesome5 name="comments" size={18} color={activeTab === 'messages' ? '#10b981' : '#6b7280'} />
                        {chats.some(c => c.unreadCount?.[auth.currentUser?.uid || ''] > 0) && (
                            <View style={styles.tabBadge} />
                        )}
                    </View>
                    <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>Mensajes</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {activeTab === 'profile' ? (
                    <>
                        {/* Profile Photo */}
                        <View style={styles.photoSection}>
                            <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
                                {driver.fotoURL ? (
                                    <Image source={{ uri: driver.fotoURL }} style={styles.photo} />
                                ) : (
                                    <View style={styles.photoPlaceholder}>
                                        <FontAwesome5 name="user" size={48} color="#9ca3af" />
                                    </View>
                                )}
                                <View style={styles.photoOverlay}>
                                    <MaterialIcons name="camera-alt" size={24} color="white" />
                                </View>
                            </TouchableOpacity>
                            {uploading && <ActivityIndicator style={styles.uploadingIndicator} />}
                        </View>

                        {/* Verification Status */}
                        {!driver.verificado && (
                            <View style={styles.warningCard}>
                                <MaterialIcons name="warning" size={24} color="#f59e0b" />
                                <Text style={styles.warningText}>
                                    Tu cuenta está pendiente de verificación. Un administrador la revisará pronto.
                                </Text>
                            </View>
                        )}

                        {/* Profile Info */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Información del Perfil</Text>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Nombre:</Text>
                                <Text style={styles.infoValue}>{driver.nombre}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Email:</Text>
                                <Text style={styles.infoValue}>{driver.email}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Teléfono:</Text>
                                <Text style={styles.infoValue}>{driver.telefono}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Servicio:</Text>
                                <Text style={[styles.infoValue, styles.serviceType]}>{driver.tipoServicio}</Text>
                            </View>
                        </View>

                        {/* Nickname */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Apodo (Opcional)</Text>
                            <Text style={styles.cardSubtitle}>Este nombre se mostrará a los usuarios</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Ej: El Rápido"
                                value={apodo}
                                onChangeText={setApodo}
                            />

                            <TouchableOpacity style={styles.button} onPress={updateNickname}>
                                <Text style={styles.buttonText}>Actualizar Apodo</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Availability Toggle */}
                        {driver.verificado && (
                            <View style={styles.card}>
                                <View style={styles.availabilityHeader}>
                                    <View>
                                        <Text style={styles.cardTitle}>Disponibilidad</Text>
                                        <Text style={styles.cardSubtitle}>
                                            {driver.disponible ? 'Visible para usuarios' : 'No visible para usuarios'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={driver.disponible}
                                        onValueChange={toggleAvailability}
                                        trackColor={{ false: '#d1d5db', true: '#10b981' }}
                                        thumbColor={driver.disponible ? '#ffffff' : '#f3f4f6'}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Logout Button */}
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#ef4444" />
                            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
                        </TouchableOpacity>

                        {/* Test Notification Button (Debug) */}
                        <TouchableOpacity
                            style={[styles.logoutButton, { marginTop: 16, borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}
                            onPress={sendTestNotification}
                        >
                            <MaterialIcons name="notifications-active" size={20} color="#3b82f6" />
                            <Text style={[styles.logoutButtonText, { color: '#3b82f6' }]}>Probar Notificación</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.messagesContainer}>
                        {chats.length === 0 ? (
                            <View style={styles.emptyMessages}>
                                <FontAwesome5 name="comments" size={48} color="#d1d5db" />
                                <Text style={styles.emptyMessagesText}>No tienes mensajes aún</Text>
                            </View>
                        ) : (
                            chats.map(chat => (
                                <TouchableOpacity
                                    key={chat.id}
                                    style={styles.chatItem}
                                    onPress={() => router.push({
                                        pathname: '/chat',
                                        params: {
                                            driverId: chat.userId, // El "otro" es el usuario
                                            driverName: 'Usuario Anónimo', // Nombre a mostrar en el header
                                        }
                                    })}
                                >
                                    <View style={styles.chatIcon}>
                                        <FontAwesome5 name="user" size={20} color="#9ca3af" />
                                    </View>
                                    <View style={styles.chatInfo}>
                                        <View style={styles.chatHeader}>
                                            <Text style={styles.chatUser}>Usuario Anónimo</Text>
                                            {chat.lastTimestamp && (
                                                <Text style={styles.chatTime}>
                                                    {new Date(chat.lastTimestamp.toDate()).toLocaleDateString()}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.lastMessage} numberOfLines={1}>
                                            {chat.lastMessage}
                                        </Text>
                                    </View>
                                    {chat.unreadCount?.[auth.currentUser?.uid || ''] > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadText}>
                                                {chat.unreadCount[auth.currentUser?.uid || '']}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#ef4444',
    },
    scrollContent: {
        padding: 16,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    photoContainer: {
        position: 'relative',
    },
    photo: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    photoPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10b981',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'white',
    },
    uploadingIndicator: {
        marginTop: 8,
    },
    warningCard: {
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    warningText: {
        flex: 1,
        color: '#92400e',
        fontSize: 14,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    infoLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: '#1f2937',
    },
    serviceType: {
        textTransform: 'capitalize',
        fontWeight: '600',
        color: '#10b981',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f9fafb',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#10b981',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    availabilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
        gap: 8,
        marginTop: 8,
    },
    logoutButtonText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#10b981',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    activeTabText: {
        color: '#10b981',
    },
    tabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        borderWidth: 1,
        borderColor: 'white',
    },
    messagesContainer: {
        flex: 1,
    },
    emptyMessages: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    emptyMessagesText: {
        fontSize: 16,
        color: '#9ca3af',
    },
    chatItem: {
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    chatIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatInfo: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatUser: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    chatTime: {
        fontSize: 12,
        color: '#9ca3af',
    },
    lastMessage: {
        fontSize: 14,
        color: '#6b7280',
    },
    unreadBadge: {
        backgroundColor: '#ef4444',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
