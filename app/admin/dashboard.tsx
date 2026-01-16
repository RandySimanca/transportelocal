import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Driver {
    id: string;
    nombre: string;
    email: string;
    telefono: string;
    tipoServicio: string;
    verificado: boolean;
    disponible: boolean;
    apodo?: string;
}

export default function AdminDashboard() {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchDrivers();
            } else {
                router.replace('/admin/login');
            }
        });
        return () => unsub();
    }, []);

    const fetchDrivers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'conductores'));
            const driversData: Driver[] = [];
            querySnapshot.forEach((doc) => {
                driversData.push({ id: doc.id, ...doc.data() } as Driver);
            });
            setDrivers(driversData);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            Alert.alert('Error', 'No se pudieron cargar los conductores');
        } finally {
            setLoading(false);
        }
    };

    const verifyDriver = async (driver: Driver) => {
        try {
            await updateDoc(doc(db, 'conductores', driver.id), {
                verificado: true,
                disponible: true, // Automatically set as active/available
            });
            setDrivers(prev =>
                prev.map(d => (d.id === driver.id ? { ...d, verificado: true, disponible: true } : d))
            );
            Alert.alert('Éxito', `${driver.nombre} ha sido verificado y activado`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo verificar el conductor');
            console.error(error);
        }
    };

    const revokeDriver = async (driver: Driver) => {
        try {
            await updateDoc(doc(db, 'conductores', driver.id), {
                verificado: false,
                disponible: false,
            });
            setDrivers(prev =>
                prev.map(d =>
                    d.id === driver.id ? { ...d, verificado: false, disponible: false } : d
                )
            );
            Alert.alert('Éxito', `Verificación de ${driver.nombre} revocada`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo revocar la verificación');
            console.error(error);
        }
    };

    const deleteDriver = async (driver: Driver) => {
        Alert.alert(
            'Confirmar Eliminación',
            `¿Estás seguro de eliminar a ${driver.nombre}? Esta acción no se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'conductores', driver.id));
                            setDrivers(prev => prev.filter(d => d.id !== driver.id));
                            Alert.alert('Éxito', `${driver.nombre} ha sido eliminado`);
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar el conductor');
                            console.error(error);
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/admin/login');
        } catch (error) {
            Alert.alert('Error', 'No se pudo cerrar sesión');
            console.error(error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9333ea" />
                    <Text style={styles.loadingText}>Cargando conductores...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const pendingDrivers = drivers.filter(d => !d.verificado);
    const verifiedDrivers = drivers.filter(d => d.verificado);

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Panel de Administración',
                    headerShown: true,
                    headerRight: () => (
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutHeaderButton}>
                            <MaterialIcons name="logout" size={24} color="#ef4444" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
                        <Text style={styles.statNumber}>{pendingDrivers.length}</Text>
                        <Text style={styles.statLabel}>Pendientes</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
                        <Text style={styles.statNumber}>{verifiedDrivers.length}</Text>
                        <Text style={styles.statLabel}>Verificados</Text>
                    </View>
                </View>

                {pendingDrivers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Conductores Pendientes</Text>
                        {pendingDrivers.map(driver => (
                            <View key={driver.id} style={styles.driverCard}>
                                <View style={styles.driverHeader}>
                                    <FontAwesome5 name="user-clock" size={24} color="#f59e0b" />
                                    <View style={styles.driverInfo}>
                                        <Text style={styles.driverName}>{driver.nombre}</Text>
                                        <Text style={styles.driverDetail}>{driver.email}</Text>
                                        <Text style={styles.driverDetail}>{driver.telefono}</Text>
                                        <Text style={styles.driverService}>{driver.tipoServicio}</Text>
                                    </View>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.verifyButton]}
                                        onPress={() => verifyDriver(driver)}
                                    >
                                        <MaterialIcons name="check-circle" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>Verificar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={() => deleteDriver(driver)}
                                    >
                                        <MaterialIcons name="delete" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {verifiedDrivers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Conductores Verificados</Text>
                        {verifiedDrivers.map(driver => (
                            <View key={driver.id} style={styles.driverCard}>
                                <View style={styles.driverHeader}>
                                    <FontAwesome5 name="user-check" size={24} color="#10b981" />
                                    <View style={styles.driverInfo}>
                                        <Text style={styles.driverName}>{driver.nombre}</Text>
                                        <Text style={styles.driverDetail}>{driver.email}</Text>
                                        <Text style={styles.driverDetail}>{driver.telefono}</Text>
                                        <Text style={styles.driverService}>{driver.tipoServicio}</Text>
                                        <View style={styles.statusBadge}>
                                            <Text style={styles.statusText}>
                                                {driver.disponible ? '🟢 Disponible' : '🔴 No disponible'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.revokeButton]}
                                        onPress={() => revokeDriver(driver)}
                                    >
                                        <MaterialIcons name="cancel" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>Revocar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={() => deleteDriver(driver)}
                                    >
                                        <MaterialIcons name="delete" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {drivers.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <FontAwesome5 name="users" size={64} color="#d1d5db" />
                        <Text style={styles.emptyText}>No hay conductores registrados</Text>
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
    logoutHeaderButton: {
        marginRight: 16,
    },
    scrollContent: {
        padding: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
    },
    driverCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    driverHeader: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    driverDetail: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 2,
    },
    driverService: {
        fontSize: 14,
        color: '#3b82f6',
        fontWeight: '600',
        textTransform: 'capitalize',
        marginTop: 4,
    },
    statusBadge: {
        marginTop: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        gap: 6,
    },
    verifyButton: {
        backgroundColor: '#10b981',
    },
    revokeButton: {
        backgroundColor: '#f59e0b',
    },
    deleteButton: {
        backgroundColor: '#ef4444',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 16,
    },
});
