import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: any;
}

export default function ChatScreen() {
    const { driverId, driverName, driverPhoto } = useLocalSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const chatId = (auth.currentUser && driverId)
        ? (auth.currentUser.uid < (driverId as string)
            ? `${auth.currentUser.uid}_${driverId}`
            : `${driverId}_${auth.currentUser.uid}`)
        : '';

    useEffect(() => {
        console.log("ChatScreen: auth.currentUser:", auth.currentUser?.uid);
        console.log("ChatScreen: driverId:", driverId);
        console.log("ChatScreen: chatId:", chatId);

        if (!auth.currentUser || !chatId) {
            if (!auth.currentUser) console.warn("ChatScreen: No hay usuario autenticado");
            if (!chatId) console.warn("ChatScreen: No se pudo generar chatId");
            return;
        }

        const q = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'asc')
        );

        console.log("ChatScreen: Iniciando listener en:", `chats/${chatId}/messages`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("ChatScreen: Snapshot recibido, mensajes:", snapshot.size);
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[];
            setMessages(msgs);
            setLoading(false);

            // Mark as read when opening chat
            updateUnreadCount();
        }, (error) => {
            console.error("ChatScreen: Error en el listener de mensajes:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [chatId]);

    const updateUnreadCount = async () => {
        if (!auth.currentUser) return;
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
            const data = chatSnap.data();
            const unreadCount = data.unreadCount || {};
            unreadCount[auth.currentUser.uid] = 0;
            await updateDoc(chatRef, { unreadCount });
        }
    };

    const sendPushNotification = async (targetUid: string, messageText: string) => {
        try {
            // Intentar obtener el token del conductor primero, luego del usuario
            let pushToken = null;

            const driverDoc = await getDoc(doc(db, 'conductores', targetUid));
            if (driverDoc.exists()) {
                pushToken = driverDoc.data().pushToken;
            } else {
                const userDoc = await getDoc(doc(db, 'usuarios', targetUid));
                if (userDoc.exists()) {
                    pushToken = userDoc.data().pushToken;
                }
            }

            if (!pushToken) {
                console.log("No se encontró pushToken para el destinatario:", targetUid);
                return;
            }

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: pushToken,
                    sound: 'default',
                    title: 'Nuevo mensaje',
                    body: messageText,
                    data: { chatId },
                }),
            });
        } catch (error) {
            console.error("Error enviando notificación push:", error);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !auth.currentUser) return;

        const text = inputText.trim();
        setInputText('');

        try {
            const chatRef = doc(db, 'chats', chatId);
            const chatSnap = await getDoc(chatRef);
            const recipientId = driverId as string;

            if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                    participants: [auth.currentUser.uid, driverId],
                    driverId: driverId,
                    userId: auth.currentUser.uid,
                    lastMessage: text,
                    lastTimestamp: serverTimestamp(),
                    unreadCount: {
                        [driverId as string]: 1,
                        [auth.currentUser.uid]: 0
                    }
                });
            } else {
                const data = chatSnap.data();
                const unreadCount = data.unreadCount || {};
                unreadCount[recipientId] = (unreadCount[recipientId] || 0) + 1;

                await updateDoc(chatRef, {
                    lastMessage: text,
                    lastTimestamp: serverTimestamp(),
                    unreadCount
                });
            }

            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text,
                senderId: auth.currentUser.uid,
                timestamp: serverTimestamp()
            });

            // Enviar notificación push al destinatario
            // El destinatario es el participante que NO es el usuario actual
            const chatData = chatSnap.exists() ? chatSnap.data() : { participants: [auth.currentUser.uid, driverId] };
            const participants = chatData?.participants || [];
            const targetId = participants.find((p: string) => p !== auth.currentUser?.uid);

            if (targetId) {
                sendPushNotification(targetId, text);
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.senderId === auth.currentUser?.uid;
        return (
            <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.theirMessageContainer]}>
                <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {item.text}
                    </Text>
                    {item.timestamp && (
                        <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
                            {new Date(item.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ title: driverName as string || 'Chat', headerShown: true }} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    />
                )}

                <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Escribe un mensaje..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                        <MaterialIcons name="send" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    inner: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messagesList: {
        padding: 16,
        paddingBottom: 8,
    },
    messageContainer: {
        width: '100%',
        marginBottom: 8,
        flexDirection: 'row',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
    },
    myBubble: {
        backgroundColor: '#3b82f6',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    myMessageText: {
        color: 'white',
    },
    theirMessageText: {
        color: '#1f2937',
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myTimestamp: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    theirTimestamp: {
        color: '#9ca3af',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: 'white',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    input: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 12,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#3b82f6',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
