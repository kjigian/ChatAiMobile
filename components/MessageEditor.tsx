import React, { useState } from 'react';
import { View, StyleSheet, Modal, Alert, TouchableOpacity, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ChatMessage } from '@/utils/conversations';

interface MessageEditorProps {
  visible: boolean;
  message: ChatMessage | null;
  onClose: () => void;
  onSave: (newText: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({
  visible,
  message,
  onClose,
  onSave,
  onDelete,
}) => {
  const [editedText, setEditedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  React.useEffect(() => {
    if (message) {
      setEditedText(message.text);
    }
  }, [message]);

  const handleSave = async () => {
    if (!editedText.trim()) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    try {
      await onSave(editedText.trim());
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Keyboard.dismiss();
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await onDelete();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!message) return null;

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
    },
    modalOverlayInner: {
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
      borderColor,
      backgroundColor,
      maxWidth: 400,
      width: '90%',
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      flex: 1,
    },
    closeButton: {
      padding: 4,
    },
    closeText: {
      fontSize: 20,
      color: primaryColor,
    },
    messageInfo: {
      backgroundColor: secondaryColor,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    messageRole: {
      fontSize: 14,
      fontWeight: '500',
      color: textColor,
      marginBottom: 4,
    },
    messagePreview: {
      fontSize: 12,
      color: textColor,
      opacity: 0.7,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: textColor,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: textColor,
      backgroundColor,
      textAlignVertical: 'top',
      minHeight: 120,
      marginBottom: 16,
    },
    characterCount: {
      fontSize: 12,
      color: textColor,
      opacity: 0.6,
      textAlign: 'right',
      marginBottom: 16,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    saveButton: {
      backgroundColor: primaryColor,
    },
    deleteButton: {
      backgroundColor: '#FF6B6B',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    saveButtonText: {
      color: 'white',
    },
    deleteButtonText: {
      color: 'white',
    },
    cancelButtonText: {
      color: textColor,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity 
          style={styles.modalOverlayInner} 
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <ThemedView style={styles.modalContent}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Edit Message</ThemedText>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
            >
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.messageInfo}>
            <ThemedText style={styles.messageRole}>
              {message.role === 'user' ? 'Your message' : `${message.provider || 'AI'} response`}
            </ThemedText>
            <ThemedText style={styles.messagePreview} numberOfLines={2}>
              {message.text.substring(0, 100)}
              {message.text.length > 100 ? '...' : ''}
            </ThemedText>
          </View>

          <ThemedText style={styles.inputLabel}>Message Text:</ThemedText>
          <TextInput
            style={styles.textInput}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            placeholder="Enter message text..."
            placeholderTextColor={textColor + '80'}
            autoFocus
          />

          <ThemedText style={styles.characterCount}>
            {editedText.length} characters
          </ThemedText>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              disabled={isLoading}
            >
              <ThemedText style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
              disabled={isLoading}
            >
              <ThemedText style={[styles.buttonText, styles.deleteButtonText]}>
                Delete
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={isLoading || !editedText.trim()}
            >
              <ThemedText style={[styles.buttonText, styles.saveButtonText]}>
                {isLoading ? 'Saving...' : 'Save'}
              </ThemedText>
            </TouchableOpacity>
          </View>
          </ThemedView>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default MessageEditor;