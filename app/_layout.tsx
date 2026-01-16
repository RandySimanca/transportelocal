import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="user" options={{ title: 'Conductores Disponibles' }} />
        <Stack.Screen name="driver/login" options={{ title: 'Ingreso Conductor' }} />
        <Stack.Screen name="driver/register" options={{ title: 'Registro Conductor' }} />
        <Stack.Screen name="driver/dashboard" options={{ title: 'Mi Panel' }} />
        <Stack.Screen name="admin/login" options={{ title: 'Ingreso Admin' }} />
        <Stack.Screen name="admin/dashboard" options={{ title: 'Panel Admin' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
