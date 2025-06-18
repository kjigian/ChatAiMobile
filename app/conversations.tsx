import React, { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { listConversations, deleteConversation, Conversation } from '@/utils/conversations';
import { useNavigation } from 'expo-router';

export default function ConversationsScreen() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const navigation = useNavigation<any>();

  const load = async () => {
    const list = await listConversations();
    setConvos(list);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [navigation]);

  const handleOpen = (id: string) => {
    navigation.navigate('(tabs)', { loadId: id });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete conversation?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteConversation(id); load(); } },
    ]);
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity onPress={() => handleOpen(item.id)} onLongPress={() => handleDelete(item.id)} style={{ padding: 16, borderBottomWidth: 1 }}>
      <ThemedText>{new Date(item.updatedAt).toLocaleString()}</ThemedText>
      <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>{item.provider} · {item.model}</ThemedText>
      <ThemedText numberOfLines={1} style={{ opacity: 0.6 }}>{item.messages[item.messages.length-1]?.text}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList data={convos} keyExtractor={c=>c.id} renderItem={renderItem} ListEmptyComponent={<ThemedText style={{ marginTop: 40, textAlign: 'center' }}>No saved chats yet.</ThemedText>} />
    </ThemedView>
  );
}
