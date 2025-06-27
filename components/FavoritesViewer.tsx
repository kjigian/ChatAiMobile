import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { ThemedButton } from './ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { messageReactions } from '@/utils/messageReactions';
import { ChatMessage } from '@/utils/conversations';
import { useRouter } from 'expo-router';

interface FavoriteMessage {
  conversationId: string;
  messageIndex: number;
  message: ChatMessage;
  conversationTitle: string;
}

interface FavoritesViewerProps {
  visible: boolean;
  onClose: () => void;
}

interface FavoriteItemProps {
  item: FavoriteMessage;
  onPress: (conversationId: string) => void;
  onUnfavorite: (conversationId: string, messageIndex: number) => void;
}

const FavoriteItem: React.FC<FavoriteItemProps> = ({ item, onPress, onUnfavorite }) => {
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');
  const primaryColor = useThemeColor({}, 'primary');

  const handleUnfavorite = () => {
    Alert.alert(
      'Remove Favorite',
      'Remove this message from favorites?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onUnfavorite(item.conversationId, item.messageIndex),
        },
      ]
    );
  };

  const getMessagePreview = (text: string) => {
    const maxLength = 100;
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: secondaryColor,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: borderColor,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    conversationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: primaryColor,
      flex: 1,
    },
    roleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    roleIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '500',
      color: textColor,
      opacity: 0.7,
    },
    messageText: {
      fontSize: 14,
      color: textColor,
      lineHeight: 20,
      marginBottom: 8,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    favoriteIcon: {
      fontSize: 16,
    },
    unfavoriteButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    unfavoriteButtonText: {
      fontSize: 12,
      color: textColor,
      opacity: 0.7,
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(item.conversationId)}
    >
      <ThemedView style={styles.header}>
        <ThemedText style={styles.conversationTitle} numberOfLines={1}>
          {item.conversationTitle}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.roleContainer}>
        <ThemedText style={styles.roleIcon}>
          {item.message.role === 'user' ? '🧑' : '🤖'}
        </ThemedText>
        <ThemedText style={styles.roleText}>
          {item.message.role === 'user' ? 'You' : 'Assistant'}
        </ThemedText>
      </ThemedView>

      <ThemedText style={styles.messageText}>
        {getMessagePreview(item.message.text)}
      </ThemedText>

      <ThemedView style={styles.actionsContainer}>
        <ThemedText style={styles.favoriteIcon}>⭐</ThemedText>
        <TouchableOpacity style={styles.unfavoriteButton} onPress={handleUnfavorite}>
          <ThemedText style={styles.unfavoriteButtonText}>Remove</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </TouchableOpacity>
  );
};

export const FavoritesViewer: React.FC<FavoritesViewerProps> = ({ visible, onClose }) => {
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const favoriteMessages = await messageReactions.getAllFavorites();
      setFavorites(favoriteMessages);
    } catch (error) {
      console.error('Failed to load favorites:', error);
      Alert.alert('Error', 'Failed to load favorite messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadFavorites();
    }
  }, [visible, loadFavorites]);

  const handleNavigateToConversation = (conversationId: string) => {
    onClose();
    router.push({
      pathname: '/',
      params: { loadId: conversationId }
    });
  };

  const handleUnfavorite = async (conversationId: string, messageIndex: number) => {
    const success = await messageReactions.toggleFavorite(conversationId, messageIndex);
    if (success) {
      // Remove from local state
      setFavorites(prev => 
        prev.filter(fav => 
          !(fav.conversationId === conversationId && fav.messageIndex === messageIndex)
        )
      );
    } else {
      Alert.alert('Error', 'Failed to remove favorite');
    }
  };

  const renderFavoriteItem = ({ item }: { item: FavoriteMessage }) => (
    <FavoriteItem
      item={item}
      onPress={handleNavigateToConversation}
      onUnfavorite={handleUnfavorite}
    />
  );

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
      flex: 1,
      backgroundColor,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: textColor,
    },
    closeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: textColor,
      opacity: 0.7,
      textAlign: 'center',
      lineHeight: 20,
    },
    favoriteCount: {
      fontSize: 14,
      color: textColor,
      opacity: 0.7,
      marginBottom: 16,
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Favorite Messages</ThemedText>
          <ThemedButton title="Done" onPress={onClose} style={styles.closeButton} />
        </ThemedView>

        <ThemedView style={styles.content}>
          {loading ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyTitle}>Loading favorites...</ThemedText>
            </ThemedView>
          ) : favorites.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyIcon}>⭐</ThemedText>
              <ThemedText style={styles.emptyTitle}>No Favorites Yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Tap the star icon on any message to add it to your favorites.
                Your favorite messages will appear here for easy access.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedText style={styles.favoriteCount}>
                {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
              </ThemedText>
              <FlatList
                data={favorites}
                renderItem={renderFavoriteItem}
                keyExtractor={(item) => `${item.conversationId}-${item.messageIndex}`}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </ThemedView>
      </ThemedView>
    </Modal>
  );
};

export default FavoritesViewer;