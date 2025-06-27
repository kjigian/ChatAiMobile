import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { ThemedButton } from './ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ChatMessage } from '@/utils/conversations';
import { messageReactions, REACTION_EMOJIS } from '@/utils/messageReactions';

interface MessageReactionsProps {
  message: ChatMessage;
  conversationId: string;
  messageIndex: number;
  onReactionUpdate?: () => void;
}

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (emoji: string) => void;
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({ visible, onClose, onSelectReaction }) => {
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  const handleReactionSelect = (emoji: string) => {
    onSelectReaction(emoji);
    onClose();
  };

  const pickerStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    reactionPickerContainer: {
      margin: 20,
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      maxWidth: 300,
      width: '90%',
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 16,
    },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 16,
    },
    emojiButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: secondaryColor,
    },
    emojiText: {
      fontSize: 20,
    },
    cancelButton: {
      alignSelf: 'center',
      paddingHorizontal: 20,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={pickerStyles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <ThemedView style={[pickerStyles.reactionPickerContainer, { backgroundColor, borderColor }]}>
          <ThemedText style={[pickerStyles.pickerTitle, { color: textColor }]}>
            Choose a reaction
          </ThemedText>
          <View style={pickerStyles.emojiGrid}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={pickerStyles.emojiButton}
                onPress={() => handleReactionSelect(emoji)}
              >
                <ThemedText style={pickerStyles.emojiText}>{emoji}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <ThemedButton 
            title="Cancel" 
            onPress={onClose} 
            style={pickerStyles.cancelButton}
          />
        </ThemedView>
      </TouchableOpacity>
    </Modal>
  );
};

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  message,
  conversationId,
  messageIndex,
  onReactionUpdate
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const primaryColor = useThemeColor({}, 'primary');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  const stats = messageReactions.getReactionStats(message);
  const isFavorite = message.isFavorite || false;

  const handleAddReaction = useCallback(async (emoji: string) => {
    const success = await messageReactions.addReaction(conversationId, messageIndex, emoji);
    if (success) {
      onReactionUpdate?.();
    } else {
      Alert.alert('Error', 'Failed to add reaction');
    }
  }, [conversationId, messageIndex, onReactionUpdate]);

  const handleRemoveReaction = useCallback(async (emoji: string) => {
    const success = await messageReactions.removeReaction(conversationId, messageIndex, emoji);
    if (success) {
      onReactionUpdate?.();
    } else {
      Alert.alert('Error', 'Failed to remove reaction');
    }
  }, [conversationId, messageIndex, onReactionUpdate]);

  const handleToggleFavorite = useCallback(async () => {
    const success = await messageReactions.toggleFavorite(conversationId, messageIndex);
    if (success) {
      onReactionUpdate?.();
    } else {
      Alert.alert('Error', 'Failed to toggle favorite');
    }
  }, [conversationId, messageIndex, onReactionUpdate]);

  const handleReactionPress = useCallback((emoji: string) => {
    const hasReaction = messageReactions.hasReaction(message, emoji);
    if (hasReaction) {
      handleRemoveReaction(emoji);
    } else {
      handleAddReaction(emoji);
    }
  }, [message, handleAddReaction, handleRemoveReaction]);

  const styles = StyleSheet.create({
    container: {
      marginTop: 8,
    },
    reactionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    reactionBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: secondaryColor,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: borderColor,
      minHeight: 24,
    },
    activeReactionBubble: {
      backgroundColor: primaryColor,
      borderColor: primaryColor,
    },
    reactionEmoji: {
      fontSize: 14,
      marginRight: 4,
    },
    reactionCount: {
      fontSize: 12,
      color: textColor,
      fontWeight: '500',
    },
    activeReactionCount: {
      color: 'white',
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: borderColor,
    },
    favoriteButton: {
      backgroundColor: isFavorite ? '#FFD700' : 'transparent',
      borderColor: isFavorite ? '#FFD700' : borderColor,
    },
    actionButtonText: {
      fontSize: 12,
      color: textColor,
      marginLeft: 4,
    },
    favoriteButtonText: {
      color: isFavorite ? '#000' : textColor,
    },
  });

  return (
    <View style={styles.container}>
      {/* Display existing reactions */}
      {stats.totalReactions > 0 && (
        <View style={styles.reactionsContainer}>
          {stats.uniqueEmojis.map((emoji) => {
            const count = stats.reactionCounts[emoji];
            const hasReaction = messageReactions.hasReaction(message, emoji);
            
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionBubble,
                  hasReaction && styles.activeReactionBubble,
                ]}
                onPress={() => handleReactionPress(emoji)}
              >
                <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                <ThemedText 
                  style={[
                    styles.reactionCount,
                    hasReaction && styles.activeReactionCount,
                  ]}
                >
                  {count}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowPicker(true)}
        >
          <ThemedText style={styles.reactionEmoji}>😊</ThemedText>
          <ThemedText style={styles.actionButtonText}>React</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.favoriteButton]}
          onPress={handleToggleFavorite}
        >
          <ThemedText style={styles.reactionEmoji}>
            {isFavorite ? '⭐' : '☆'}
          </ThemedText>
          <ThemedText style={[styles.actionButtonText, styles.favoriteButtonText]}>
            {isFavorite ? 'Favorited' : 'Favorite'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Reaction picker modal */}
      <ReactionPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectReaction={handleAddReaction}
      />
    </View>
  );
};

export default MessageReactions;