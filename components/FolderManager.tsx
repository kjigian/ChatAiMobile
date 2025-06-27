import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { ThemedTextInput } from './ThemedTextInput';
import { useThemeColor } from '@/hooks/useThemeColor';
import { 
  ConversationFolder, 
  createFolder, 
  listFolders, 
  updateFolder, 
  deleteFolder,
  listConversationsByFolder 
} from '@/utils/conversations';
import { logger } from '@/utils/logger';

interface FolderManagerProps {
  visible: boolean;
  onClose: () => void;
  onFolderSelect?: (folderId: string | undefined) => void;
}

const FOLDER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export const FolderManager: React.FC<FolderManagerProps> = ({
  visible,
  onClose,
  onFolderSelect
}) => {
  const [folders, setFolders] = useState<ConversationFolder[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ConversationFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);
  const [folderConversationCounts, setFolderConversationCounts] = useState<Record<string, number>>({});

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  const loadFolders = useCallback(async () => {
    try {
      const folderList = await listFolders();
      setFolders(folderList);

      // Load conversation counts for each folder
      const counts: Record<string, number> = {};
      for (const folder of folderList) {
        const conversations = await listConversationsByFolder(folder.id);
        counts[folder.id] = conversations.length;
      }
      
      // Also get count for unorganized conversations
      const unorganized = await listConversationsByFolder(undefined);
      counts['unorganized'] = unorganized.length;
      
      setFolderConversationCounts(counts);
    } catch (error) {
      logger.error('Failed to load folders:', error);
      Alert.alert('Error', 'Failed to load folders');
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible, loadFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      await createFolder(newFolderName.trim(), selectedColor);
      setNewFolderName('');
      setSelectedColor(FOLDER_COLORS[0]);
      setShowCreateModal(false);
      await loadFolders();
      logger.log('Created folder:', newFolderName);
    } catch (error) {
      logger.error('Failed to create folder:', error);
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const handleEditFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      await updateFolder(editingFolder.id, {
        name: newFolderName.trim(),
        color: selectedColor,
      });
      setEditingFolder(null);
      setNewFolderName('');
      setSelectedColor(FOLDER_COLORS[0]);
      setShowEditModal(false);
      await loadFolders();
      logger.log('Updated folder:', editingFolder.id);
    } catch (error) {
      logger.error('Failed to update folder:', error);
      Alert.alert('Error', 'Failed to update folder');
    }
  };

  const handleDeleteFolder = (folder: ConversationFolder) => {
    const conversationCount = folderConversationCounts[folder.id] || 0;
    
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"? ${
        conversationCount > 0 
          ? `This will move ${conversationCount} conversation(s) to "Unorganized".`
          : 'This folder is empty.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFolder(folder.id);
              await loadFolders();
              logger.log('Deleted folder:', folder.id);
            } catch (error) {
              logger.error('Failed to delete folder:', error);
              Alert.alert('Error', 'Failed to delete folder');
            }
          },
        },
      ]
    );
  };

  const startEditFolder = (folder: ConversationFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setSelectedColor(folder.color || FOLDER_COLORS[0]);
    setShowEditModal(true);
  };

  const renderColorPicker = () => (
    <View style={styles.colorPicker}>
      <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Color</ThemedText>
      <View style={styles.colorGrid}>
        {FOLDER_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColor,
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>
    </View>
  );

  const renderFolderItem = ({ item }: { item: ConversationFolder }) => (
    <TouchableOpacity
      style={[styles.folderItem, { borderBottomColor: borderColor }]}
      onPress={() => {
        onFolderSelect?.(item.id);
        onClose();
      }}
      onLongPress={() => startEditFolder(item)}
    >
      <View style={styles.folderInfo}>
        <View style={styles.folderHeader}>
          <View style={[styles.folderColorIndicator, { backgroundColor: item.color || FOLDER_COLORS[0] }]} />
          <ThemedText style={[styles.folderName, { color: textColor }]}>
            {item.name}
          </ThemedText>
          <ThemedText style={[styles.folderCount, { color: textColor }]}>
            {folderConversationCounts[item.id] || 0}
          </ThemedText>
        </View>
        <ThemedText style={[styles.folderDate, { color: textColor }]}>
          Created {new Date(item.createdAt).toLocaleDateString()}
        </ThemedText>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteFolder(item)}
      >
        <ThemedText style={styles.deleteButtonText}>🗑️</ThemedText>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const CreateEditModal = ({ isEdit }: { isEdit: boolean }) => (
    <Modal
      visible={isEdit ? showEditModal : showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (isEdit) {
          setShowEditModal(false);
          setEditingFolder(null);
        } else {
          setShowCreateModal(false);
        }
        setNewFolderName('');
        setSelectedColor(FOLDER_COLORS[0]);
      }}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor, borderColor }]}>
          <ThemedText style={[styles.modalTitle, { color: textColor }]}>
            {isEdit ? 'Edit Folder' : 'Create New Folder'}
          </ThemedText>
          
          <View style={styles.inputSection}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Name</ThemedText>
            <ThemedTextInput
              style={[styles.nameInput, { borderColor, color: textColor }]}
              placeholder="Enter folder name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
          </View>

          {renderColorPicker()}

          <View style={styles.modalButtons}>
            <ThemedButton
              title="Cancel"
              onPress={() => {
                if (isEdit) {
                  setShowEditModal(false);
                  setEditingFolder(null);
                } else {
                  setShowCreateModal(false);
                }
                setNewFolderName('');
                setSelectedColor(FOLDER_COLORS[0]);
              }}
              style={[styles.modalButton, { backgroundColor: 'transparent', borderColor, borderWidth: 1 }]}
            />
            <ThemedButton
              title={isEdit ? 'Update' : 'Create'}
              onPress={isEdit ? handleEditFolder : handleCreateFolder}
              style={[styles.modalButton, { backgroundColor: primaryColor }]}
            />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={[styles.closeText, { color: primaryColor }]}>✕</ThemedText>
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Manage Folders</ThemedText>
          <TouchableOpacity 
            onPress={() => setShowCreateModal(true)}
            style={styles.addButton}
          >
            <ThemedText style={[styles.addText, { color: primaryColor }]}>+</ThemedText>
          </TouchableOpacity>
        </View>

        <FlatList
          data={folders}
          renderItem={renderFolderItem}
          keyExtractor={item => item.id}
          style={styles.folderList}
          contentContainerStyle={styles.folderListContent}
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.folderItem, { borderBottomColor: borderColor }]}
              onPress={() => {
                onFolderSelect?.(undefined);
                onClose();
              }}
            >
              <View style={styles.folderInfo}>
                <View style={styles.folderHeader}>
                  <View style={[styles.folderColorIndicator, { backgroundColor: '#666' }]} />
                  <ThemedText style={[styles.folderName, { color: textColor }]}>
                    Unorganized
                  </ThemedText>
                  <ThemedText style={[styles.folderCount, { color: textColor }]}>
                    {folderConversationCounts['unorganized'] || 0}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.folderDate, { color: textColor }]}>
                  Conversations not in any folder
                </ThemedText>
              </View>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: textColor }]}>
                No folders yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: textColor }]}>
                Create folders to organize your conversations
              </ThemedText>
            </View>
          }
        />

        <CreateEditModal isEdit={false} />
        <CreateEditModal isEdit={true} />
      </ThemedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 4,
  },
  addText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  folderList: {
    flex: 1,
  },
  folderListContent: {
    paddingBottom: 20,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  folderInfo: {
    flex: 1,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  folderColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  folderCount: {
    fontSize: 14,
    opacity: 0.7,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  folderDate: {
    fontSize: 12,
    opacity: 0.6,
    marginLeft: 24,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  colorPicker: {
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
    borderWidth: 3,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});

export default FolderManager;