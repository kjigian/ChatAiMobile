import React, { useEffect, useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedButton } from '@/components/ThemedButton';
import { listConversations, deleteConversation, renameConversation, generateConversationTitle, cleanupEmptyConversations, Conversation } from '@/utils/conversations';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ConversationsScreen() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const navigation = useNavigation();
  const router = useRouter();
  const { styles } = useThemedStyles();

  const load = async () => {
    // Clean up any empty conversations first
    await cleanupEmptyConversations();
    const list = await listConversations();
    setConvos(list);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [navigation]);

  const handleOpen = (id: string) => {
    console.log('[Conversations] Attempting to load conversation with ID:', id);
    // Navigate to the chat tab (index) with the loadId parameter
    // First navigate to the index tab, then set params
    router.push('/(tabs)/');
    // Add a small delay to ensure navigation completes
    setTimeout(() => {
      router.setParams({ loadId: id });
    }, 100);
    console.log('[Conversations] Navigation completed with Expo Router using param loadId:', id);
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete conversation?', `"${title}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteConversation(id); load(); } },
    ]);
  };

  const handleRename = (conversation: Conversation) => {
    const currentTitle = generateConversationTitle(conversation);
    Alert.prompt(
      'Rename Conversation',
      'Enter a new title for this conversation:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Save', 
          onPress: async (newTitle) => {
            if (newTitle && newTitle.trim()) {
              try {
                await renameConversation(conversation.id, newTitle.trim());
                load();
              } catch {
                Alert.alert('Error', 'Failed to rename conversation');
              }
            }
          }
        },
      ],
      'plain-text',
      currentTitle
    );
  };

  const handleLongPress = (conversation: Conversation, title: string) => {
    Alert.alert(
      'Conversation Options',
      `"${title}"`,
      [
        { text: 'Rename', onPress: () => handleRename(conversation) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(conversation.id, title) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const title = generateConversationTitle(item);
    const lastMessage = item.messages && item.messages.length > 0 ? item.messages[item.messages.length - 1] : null;
    const messagePreview = lastMessage ? lastMessage.text : 'No messages yet';
    
    return (
      <TouchableOpacity 
        onPress={() => handleOpen(item.id)} 
        onLongPress={() => handleLongPress(item, title)}
        style={styles.conversationItem}
      >
        <ThemedView style={styles.conversationContent}>
          <ThemedText style={styles.conversationTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText style={styles.conversationMeta}>
            {new Date(item.updatedAt).toLocaleDateString()} · {item.provider} · {item.model}
          </ThemedText>
          <ThemedText numberOfLines={2} style={styles.conversationPreview}>
            {messagePreview}
          </ThemedText>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>Conversations</ThemedText>
        <ThemedButton 
          title="New Chat" 
          onPress={() => router.push({
            pathname: '/(tabs)/index',
            params: { refreshTime: Date.now().toString() }
          })}
          style={styles.newChatButton}
        />
      </ThemedView>
      <FlatList 
        data={convos} 
        keyExtractor={c => c.id} 
        renderItem={renderItem} 
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No saved chats yet.</ThemedText>
            <ThemedText style={styles.emptySubtext}>Start a new conversation to see it here.</ThemedText>
          </ThemedView>
        } 
      />
    </ThemedView>
  );
}

const useThemedStyles = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: textColor,
    },
    newChatButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    list: {
      flex: 1,
    },
    listContent: {
      flexGrow: 1,
    },
    conversationItem: {
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    conversationContent: {
      padding: 16,
    },
    conversationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
      marginBottom: 4,
    },
    conversationMeta: {
      fontSize: 12,
      color: textColor,
      opacity: 0.6,
      marginBottom: 6,
    },
    conversationPreview: {
      fontSize: 14,
      color: textColor,
      opacity: 0.7,
      lineHeight: 18,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: textColor,
      opacity: 0.6,
      textAlign: 'center',
    },
  }), [backgroundColor, textColor, borderColor]);

  return { styles };
};
