import React, { useEffect, useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, Alert, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedButton } from '@/components/ThemedButton';
import { 
  listConversations, 
  deleteConversation, 
  renameConversation, 
  generateConversationTitle, 
  cleanupEmptyConversations, 
  Conversation,
  ConversationFolder,
  listFolders,
  listConversationsByFolder,
  updateConversationFolder,
  updateConversationTags,
  getAllTags
} from '@/utils/conversations';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ConversationSearch } from '@/components/ConversationSearch';
import { DataExporter, DataImporter } from '@/utils/dataExport';
import { FolderManager } from '@/components/FolderManager';
import { conversationSharing } from '@/utils/conversationSharing';

export default function ConversationsScreen() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [allConvos, setAllConvos] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<ConversationFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [showSearch, setShowSearch] = useState(false);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'folders'>('all');
  const navigation = useNavigation();
  const router = useRouter();
  const { styles } = useThemedStyles();

  const load = async () => {
    // Clean up any empty conversations first
    await cleanupEmptyConversations();
    const list = await listConversations();
    const folderList = await listFolders();
    
    setAllConvos(list);
    setFolders(folderList);
    
    // Filter conversations based on current view mode and selected folder
    if (viewMode === 'folders') {
      const filtered = await listConversationsByFolder(selectedFolder);
      setConvos(filtered);
    } else {
      setConvos(list);
    }
  };

  const handleExportJSON = async () => {
    await DataExporter.quickExportJSON(convos);
  };

  const handleExportMarkdown = async () => {
    await DataExporter.quickExportMarkdown(convos);
  };

  const handleImport = async () => {
    const importedConversations = await DataImporter.quickImportWithPrompt();
    if (importedConversations.length > 0) {
      const mergeResult = DataImporter.mergeConversations(convos, importedConversations);
      setConvos(mergeResult.merged);
      
      Alert.alert(
        'Import Complete',
        `Added: ${mergeResult.addedCount} conversations\nUpdated: ${mergeResult.updatedCount} conversations\nDuplicates skipped: ${mergeResult.duplicateCount}`,
        [{ text: 'OK' }]
      );
    }
  };

  const showExportOptions = () => {
    Alert.alert(
      'Export Conversations',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'JSON (Complete)', onPress: handleExportJSON },
        { text: 'Markdown (Text)', onPress: handleExportMarkdown },
      ]
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    load();
  }, [viewMode, selectedFolder]);

  const handleOpen = (id: string) => {
    console.log('[Conversations] Attempting to load conversation with ID:', id);
    // Navigate to index drawer screen with parameters
    router.push({
      pathname: '/',
      params: { loadId: id }
    });
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
        { text: 'Move to Folder', onPress: () => handleMoveToFolder(conversation) },
        { text: 'Edit Tags', onPress: () => handleEditTags(conversation) },
        { text: 'Share', onPress: () => handleShare(conversation) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(conversation.id, title) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleMoveToFolder = (conversation: Conversation) => {
    // Show folder selector
    setShowFolderManager(true);
    // We'll handle the folder selection in the FolderManager onSelect callback
  };

  const handleEditTags = (conversation: Conversation) => {
    const currentTags = conversation.tags?.join(', ') || '';
    Alert.prompt(
      'Edit Tags',
      'Enter tags separated by commas:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (input) => {
            if (input !== undefined) {
              const tags = input
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
              
              try {
                await updateConversationTags(conversation.id, tags);
                load();
              } catch (error) {
                Alert.alert('Error', 'Failed to update tags');
              }
            }
          },
        },
      ],
      'plain-text',
      currentTags
    );
  };

  const handleShare = async (conversation: Conversation) => {
    Alert.alert(
      'Share Conversation',
      'Choose how to share:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'As Markdown', 
          onPress: () => conversationSharing.shareConversation(conversation, { 
            format: 'markdown', 
            includeMetadata: true, 
            includeImages: false 
          })
        },
        { 
          text: 'As Text', 
          onPress: () => conversationSharing.shareConversation(conversation, { 
            format: 'text', 
            includeMetadata: true, 
            includeImages: false 
          })
        },
        { 
          text: 'As JSON', 
          onPress: () => conversationSharing.shareConversation(conversation, { 
            format: 'json', 
            includeMetadata: true, 
            includeImages: false 
          })
        },
      ]
    );
  };

  const handleFolderSelect = async (folderId: string | undefined, conversationToMove?: Conversation) => {
    if (conversationToMove) {
      try {
        await updateConversationFolder(conversationToMove.id, folderId);
        load();
      } catch (error) {
        Alert.alert('Error', 'Failed to move conversation');
      }
    } else {
      setSelectedFolder(folderId);
      setViewMode('folders');
      load();
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'all' ? 'folders' : 'all');
    setSelectedFolder(undefined);
    load();
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const title = generateConversationTitle(item);
    const lastMessage = item.messages && item.messages.length > 0 ? item.messages[item.messages.length - 1] : null;
    const messagePreview = lastMessage ? lastMessage.text : 'No messages yet';
    const folder = folders.find(f => f.id === item.folderId);
    
    return (
      <TouchableOpacity 
        onPress={() => handleOpen(item.id)} 
        onLongPress={() => handleLongPress(item, title)}
        style={styles.conversationItem}
      >
        <ThemedView style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <ThemedText style={styles.conversationTitle} numberOfLines={1}>
              {title}
            </ThemedText>
            {folder && (
              <View style={[styles.folderIndicator, { backgroundColor: folder.color || '#666' }]}>
                <ThemedText style={styles.folderIndicatorText}>
                  {folder.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </View>
          
          <ThemedText style={styles.conversationMeta}>
            {new Date(item.updatedAt).toLocaleDateString()} · {item.provider} · {item.model}
          </ThemedText>
          
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tagChip}>
                  <ThemedText style={styles.tagText}>#{tag}</ThemedText>
                </View>
              ))}
              {item.tags.length > 3 && (
                <ThemedText style={styles.moreTagsText}>+{item.tags.length - 3}</ThemedText>
              )}
            </View>
          )}
          
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
        <ThemedText type="title" style={styles.headerTitle}>
          {viewMode === 'folders' && selectedFolder 
            ? folders.find(f => f.id === selectedFolder)?.name || 'Unorganized'
            : 'Conversations'}
        </ThemedText>
        <ThemedView style={styles.headerButtons}>
          <ThemedButton 
            title={viewMode === 'all' ? '📁' : '📋'}
            onPress={toggleViewMode}
            style={[styles.headerButton, styles.viewModeButton]}
          />
          <ThemedButton 
            title="🗂️"
            onPress={() => setShowFolderManager(true)}
            style={[styles.headerButton, styles.folderButton]}
          />
          <ThemedButton 
            title="🔍"
            onPress={() => setShowSearch(true)}
            style={[styles.headerButton, styles.searchButton]}
          />
          <ThemedButton 
            title="📤"
            onPress={showExportOptions}
            style={[styles.headerButton, styles.exportButton]}
          />
          <ThemedButton 
            title="📥"
            onPress={handleImport}
            style={[styles.headerButton, styles.importButton]}
          />
          <ThemedButton 
            title="New Chat" 
            onPress={() => router.push({
              pathname: '/',
              params: { refreshTime: Date.now().toString() }
            })}
            style={styles.newChatButton}
          />
        </ThemedView>
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
      
      {/* Search Modal */}
      <ConversationSearch
        conversations={allConvos}
        onSelectConversation={handleOpen}
        onClose={() => setShowSearch(false)}
        visible={showSearch}
      />

      {/* Folder Manager Modal */}
      <FolderManager
        visible={showFolderManager}
        onClose={() => setShowFolderManager(false)}
        onFolderSelect={handleFolderSelect}
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
      flex: 1,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 44,
    },
    searchButton: {
      backgroundColor: 'transparent',
    },
    exportButton: {
      backgroundColor: 'transparent',
    },
    importButton: {
      backgroundColor: 'transparent',
    },
    viewModeButton: {
      backgroundColor: 'transparent',
    },
    folderButton: {
      backgroundColor: 'transparent',
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
    conversationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    conversationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
      flex: 1,
    },
    folderIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    folderIndicatorText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'white',
    },
    conversationMeta: {
      fontSize: 12,
      color: textColor,
      opacity: 0.6,
      marginBottom: 6,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 6,
      gap: 4,
    },
    tagChip: {
      backgroundColor: borderColor,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    tagText: {
      fontSize: 10,
      color: textColor,
      opacity: 0.8,
    },
    moreTagsText: {
      fontSize: 10,
      color: textColor,
      opacity: 0.6,
      fontStyle: 'italic',
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
