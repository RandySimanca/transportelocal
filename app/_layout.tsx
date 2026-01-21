import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

// Configuración global de notificaciones (DEBE estar fuera del componente)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Listener para notificaciones recibidas mientras la app está en primer plano
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida en foreground:', notification);
    });

    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuario tocó notificación:', response);
      const data = response.notification.request.content.data as { chatId?: string, senderId?: string };

      if (data?.senderId) {
        // Navegar al chat usando el ID de quien envió el mensaje
        router.push({
          pathname: '/chat',
          params: {
            driverId: data.senderId,
            driverName: 'Usuario' // Opcional: podrías pasar el nombre si lo incluyes en el payload
          }
        });
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

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
