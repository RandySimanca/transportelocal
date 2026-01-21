import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, ActivityIndicator, Image, TextInput, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

interface Driver {
    id: string;
    nombre: string;
    telefono: string;
    tipoServicio: string;
    apodo?: string;
    fotoURL?: string;
    disponible: boolean;
}

const SERVICE_TYPES = [
    { id: 'all', label: 'Todos', icon: 'th-large' },
    { id: 'mototaxi', label: 'Mototaxi', icon: 'motorcycle' },
    { id: 'carromoto', label: 'Carromoto', icon: 'truck-pickup' },
    { id: 'carguero', label: 'Carguero', icon: 'truck' },
    { id: 'taxi', label: 'Taxi', icon: 'taxi' },
    { id: 'camion_ganado', label: 'Camión Ganado', icon: 'truck-moving' },
    { id: 'camioneta_4x4', label: 'Camioneta 4X4', icon: 'truck-pickup' },
    { id: 'furgon', label: 'Furgón', icon: 'shuttle-van' },
    { id: 'turbo', label: 'Turbo', icon: 'truck' },
    { id: 'volqueta', label: 'Volqueta', icon: 'dumpster' },
];

export default function UserScreen() {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedService, setSelectedService] = useState('all');
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                try {
                    const credential = await signInAnonymously(auth);
                    if (credential.user) {
                        await registerForPushNotificationsAsync(credential.user.uid);
                    }
                } catch (err) {
                    console.error("Error signing in anonymously:", err);
                }
            } else {
                // Registrar push token para usuario existente
                await registerForPushNotificationsAsync(user.uid);
            }
        });
        fetchDrivers();
        return () => unsubscribe();
    }, []);

    async function registerForPushNotificationsAsync(uid: string) {
        if (!Device.isDevice) {
            console.log('UserScreen: No es dispositivo físico, omitiendo registro de push');
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
                console.log('UserScreen: Permiso de notificaciones denegado');
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

            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (!projectId) {
                console.log('UserScreen: No se encontró projectId');
                return;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            console.log('UserScreen: Push Token registrado:', tokenData.data);

            await setDoc(doc(db, 'usuarios', uid), {
                pushToken: tokenData.data,
                lastSeen: new Date()
            }, { merge: true });

            console.log('UserScreen: Token guardado en Firestore para usuario:', uid);
        } catch (error) {
            console.error('UserScreen: Error registrando push notifications:', error);
        }
    }

    const fetchDrivers = async () => {
        try {
            const q = query(
                collection(db, 'conductores'),
                where('verificado', '==', true),
                where('disponible', '==', true)
            );
            const querySnapshot = await getDocs(q);
            const driversData: Driver[] = [];
            querySnapshot.forEach((docSnapshot) => {
                driversData.push({ id: docSnapshot.id, ...docSnapshot.data() } as Driver);
            });
            // Shuffle the drivers list
            const shuffledDrivers = driversData.sort(() => Math.random() - 0.5);
            setDrivers(shuffledDrivers);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            Alert.alert("Error", "No se pudieron cargar los conductores: " + error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDrivers = useMemo(() => {
        return drivers.filter((driver) => {
            const matchesSearch =
                driver.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
                (driver.apodo && driver.apodo.toLowerCase().includes(searchText.toLowerCase()));

            const matchesService = selectedService === 'all' || driver.tipoServicio === selectedService;

            return matchesSearch && matchesService;
        });
    }, [drivers, searchText, selectedService]);

    const openWhatsApp = (phone: string, name: string) => {
        const text = `Hola ${name}, necesito un servicio de transporte. ¿Podrías ayudarme?`;
        const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
        });
    };

    const getServiceIcon = (service: string) => {
        switch (service) {
            case 'mototaxi':
                return 'motorcycle';
            case 'carromoto':
            case 'camioneta_4x4':
                return 'truck-pickup';
            case 'carguero':
            case 'turbo':
                return 'truck';
            case 'taxi':
                return 'taxi';
            case 'camion_ganado':
                return 'truck-moving';
            case 'furgon':
                return 'shuttle-van';
            case 'volqueta':
                return 'dumpster';
            default:
                return 'car';
        }
    };

    const getServiceColor = (service: string) => {
        switch (service) {
            case 'mototaxi':
                return '#3b82f6';
            case 'carromoto':
                return '#10b981';
            case 'carguero':
                return '#f59e0b';
            case 'taxi':
                return '#eab308';
            case 'camion_ganado':
                return '#844d36';
            case 'camioneta_4x4':
                return '#4b5563';
            case 'furgon':
                return '#6366f1';
            case 'turbo':
                return '#ef4444';
            case 'volqueta':
                return '#7c2d12';
            default:
                return '#6b7280';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Conductores Disponibles', headerShown: true }} />

            <View style={styles.filterContainer}>
                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={24} color="#9ca3af" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por nombre o apodo..."
                        placeholderTextColor="#9ca3af"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText !== '' && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <MaterialIcons name="close" size={24} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Service Type Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                >
                    {SERVICE_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type.id}
                            style={[
                                styles.chip,
                                selectedService === type.id && styles.chipActive,
                                selectedService === type.id && { backgroundColor: type.id === 'all' ? '#3b82f6' : getServiceColor(type.id) }
                            ]}
                            onPress={() => setSelectedService(type.id)}
                        >
                            <FontAwesome5
                                name={type.icon}
                                size={14}
                                color={selectedService === type.id ? 'white' : '#6b7280'}
                            />
                            <Text style={[
                                styles.chipText,
                                selectedService === type.id && styles.chipTextActive
                            ]}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Cargando conductores...</Text>
                </View>
            ) : filteredDrivers.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <FontAwesome5 name="search" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>No se encontraron resultados</Text>
                    <Text style={styles.emptyText}>
                        Intenta ajustar tus filtros o búsqueda para encontrar lo que necesitas.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.headerText}>
                        {filteredDrivers.length} conductor{filteredDrivers.length !== 1 ? 'es' : ''} encontrado{filteredDrivers.length !== 1 ? 's' : ''}
                    </Text>

                    {filteredDrivers.map((driver) => (
                        <View key={driver.id} style={styles.driverCard}>
                            <View style={styles.driverHeader}>
                                {/* Profile Photo */}
                                {driver.fotoURL ? (
                                    <Image source={{ uri: driver.fotoURL }} style={styles.driverPhoto} />
                                ) : (
                                    <View style={[styles.driverPhotoPlaceholder, { backgroundColor: getServiceColor(driver.tipoServicio) }]}>
                                        <FontAwesome5 name="user" size={32} color="white" />
                                    </View>
                                )}

                                {/* Driver Info */}
                                <View style={styles.driverInfo}>
                                    <Text style={styles.driverName}>{driver.nombre}</Text>
                                    {driver.apodo && (
                                        <Text style={styles.driverNickname}>{driver.apodo}</Text>
                                    )}
                                    <View style={styles.serviceRow}>
                                        <FontAwesome5 name={getServiceIcon(driver.tipoServicio)} size={14} color={getServiceColor(driver.tipoServicio)} />
                                        <Text style={[styles.driverService, { color: getServiceColor(driver.tipoServicio) }]}>
                                            {driver.tipoServicio}
                                        </Text>
                                    </View>
                                    <View style={styles.phoneRow}>
                                        <FontAwesome5 name="phone" size={14} color="#6b7280" />
                                        <Text style={styles.driverPhone}>{driver.telefono}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.whatsappButton]}
                                    onPress={() => openWhatsApp(driver.telefono, driver.nombre)}
                                >
                                    <FontAwesome5 name="whatsapp" size={18} color="white" />
                                    <Text style={styles.actionButtonText}>WhatsApp</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.chatButton]}
                                    onPress={() => router.push({
                                        pathname: '/chat',
                                        params: {
                                            driverId: driver.id,
                                            driverName: driver.nombre,
                                            driverPhoto: driver.fotoURL || ''
                                        }
                                    })}
                                >
                                    <FontAwesome5 name="comments" size={18} color="white" />
                                    <Text style={styles.actionButtonText}>Chat Interno</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    filterContainer: {
        backgroundColor: 'white',
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 48,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#1f2937',
    },
    chipsScroll: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    chipActive: {
        borderColor: 'transparent',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    chipTextActive: {
        color: 'white',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    scrollContent: {
        padding: 16,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4b5563',
        marginBottom: 16,
    },
    driverCard: {
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
    driverHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    driverPhoto: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 12,
    },
    driverPhotoPlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 2,
    },
    driverNickname: {
        fontSize: 14,
        color: '#6b7280',
        fontStyle: 'italic',
        marginBottom: 6,
    },
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    driverService: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    driverPhone: {
        fontSize: 14,
        color: '#6b7280',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    whatsappButton: {
        backgroundColor: '#25D366',
    },
    chatButton: {
        backgroundColor: '#3b82f6',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});
