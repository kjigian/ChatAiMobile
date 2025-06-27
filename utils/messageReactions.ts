import { randomUUID } from 'expo-crypto';
import { ChatMessage, MessageReaction, Conversation, saveConversation, loadConversation } from './conversations';
import { logger } from './logger';

// Common emoji reactions
export const REACTION_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🤔',
  '🎉', '🔥', '💯', '👏', '🚀', '💡', '✅', '❌'
] as const;

export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export interface MessageReactionManager {
  // Add a reaction to a message
  addReaction(
    conversationId: string,
    messageIndex: number,
    emoji: string
  ): Promise<boolean>;

  // Remove a reaction from a message
  removeReaction(
    conversationId: string,
    messageIndex: number,
    emoji: string
  ): Promise<boolean>;

  // Toggle favorite status of a message
  toggleFavorite(
    conversationId: string,
    messageIndex: number
  ): Promise<boolean>;

  // Get all favorite messages across conversations
  getAllFavorites(): Promise<Array<{
    conversationId: string;
    messageIndex: number;
    message: ChatMessage;
    conversationTitle: string;
  }>>;

  // Get reaction statistics
  getReactionStats(message: ChatMessage): {
    totalReactions: number;
    uniqueEmojis: string[];
    reactionCounts: Record<string, number>;
  };
}

export class MessageReactions implements MessageReactionManager {
  // Ensure message has an ID
  private static ensureMessageId(message: ChatMessage): ChatMessage {
    if (!message.id) {
      return { ...message, id: randomUUID() };
    }
    return message;
  }

  // Add a reaction to a message
  async addReaction(
    conversationId: string,
    messageIndex: number,
    emoji: string
  ): Promise<boolean> {
    try {
      logger.log('Adding reaction:', { conversationId, messageIndex, emoji });

      const conversation = await loadConversation(conversationId);
      if (!conversation) {
        logger.error('Conversation not found:', conversationId);
        return false;
      }

      if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
        logger.error('Invalid message index:', messageIndex);
        return false;
      }

      const message = conversation.messages[messageIndex];
      const updatedMessage = this.ensureMessageId(message);

      // Initialize reactions array if it doesn't exist
      if (!updatedMessage.reactions) {
        updatedMessage.reactions = [];
      }

      // Check if reaction already exists
      const existingReactionIndex = updatedMessage.reactions.findIndex(
        reaction => reaction.emoji === emoji
      );

      if (existingReactionIndex >= 0) {
        // Update timestamp of existing reaction
        updatedMessage.reactions[existingReactionIndex].timestamp = new Date().toISOString();
      } else {
        // Add new reaction
        updatedMessage.reactions.push({
          emoji,
          timestamp: new Date().toISOString(),
        });
      }

      // Update the conversation
      const updatedConversation = {
        ...conversation,
        messages: conversation.messages.map((msg, index) =>
          index === messageIndex ? updatedMessage : msg
        ),
      };

      await saveConversation(updatedConversation);
      logger.log('Reaction added successfully');
      return true;
    } catch (error) {
      logger.error('Failed to add reaction:', error);
      return false;
    }
  }

  // Remove a reaction from a message
  async removeReaction(
    conversationId: string,
    messageIndex: number,
    emoji: string
  ): Promise<boolean> {
    try {
      logger.log('Removing reaction:', { conversationId, messageIndex, emoji });

      const conversation = await loadConversation(conversationId);
      if (!conversation) {
        logger.error('Conversation not found:', conversationId);
        return false;
      }

      if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
        logger.error('Invalid message index:', messageIndex);
        return false;
      }

      const message = conversation.messages[messageIndex];
      if (!message.reactions || message.reactions.length === 0) {
        logger.log('No reactions to remove');
        return true; // No reactions to remove, consider it successful
      }

      // Remove the reaction
      const updatedReactions = message.reactions.filter(
        reaction => reaction.emoji !== emoji
      );

      const updatedMessage = {
        ...message,
        reactions: updatedReactions,
      };

      // Update the conversation
      const updatedConversation = {
        ...conversation,
        messages: conversation.messages.map((msg, index) =>
          index === messageIndex ? updatedMessage : msg
        ),
      };

      await saveConversation(updatedConversation);
      logger.log('Reaction removed successfully');
      return true;
    } catch (error) {
      logger.error('Failed to remove reaction:', error);
      return false;
    }
  }

  // Toggle favorite status of a message
  async toggleFavorite(
    conversationId: string,
    messageIndex: number
  ): Promise<boolean> {
    try {
      logger.log('Toggling favorite:', { conversationId, messageIndex });

      const conversation = await loadConversation(conversationId);
      if (!conversation) {
        logger.error('Conversation not found:', conversationId);
        return false;
      }

      if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
        logger.error('Invalid message index:', messageIndex);
        return false;
      }

      const message = conversation.messages[messageIndex];
      const updatedMessage = {
        ...this.ensureMessageId(message),
        isFavorite: !message.isFavorite,
      };

      // Update the conversation
      const updatedConversation = {
        ...conversation,
        messages: conversation.messages.map((msg, index) =>
          index === messageIndex ? updatedMessage : msg
        ),
      };

      await saveConversation(updatedConversation);
      logger.log('Favorite toggled successfully, new state:', updatedMessage.isFavorite);
      return true;
    } catch (error) {
      logger.error('Failed to toggle favorite:', error);
      return false;
    }
  }

  // Get all favorite messages across conversations
  async getAllFavorites(): Promise<Array<{
    conversationId: string;
    messageIndex: number;
    message: ChatMessage;
    conversationTitle: string;
  }>> {
    try {
      logger.log('Getting all favorite messages');

      // Import here to avoid circular dependency
      const { listConversations, generateConversationTitle } = await import('./conversations');
      const conversations = await listConversations();
      const favorites: Array<{
        conversationId: string;
        messageIndex: number;
        message: ChatMessage;
        conversationTitle: string;
      }> = [];

      for (const conversation of conversations) {
        conversation.messages.forEach((message, index) => {
          if (message.isFavorite) {
            favorites.push({
              conversationId: conversation.id,
              messageIndex: index,
              message,
              conversationTitle: generateConversationTitle(conversation),
            });
          }
        });
      }

      // Sort by most recent first
      favorites.sort((a, b) => {
        const aTime = a.message.reactions?.[0]?.timestamp || '0';
        const bTime = b.message.reactions?.[0]?.timestamp || '0';
        return bTime.localeCompare(aTime);
      });

      logger.log('Found favorites:', favorites.length);
      return favorites;
    } catch (error) {
      logger.error('Failed to get favorites:', error);
      return [];
    }
  }

  // Get reaction statistics for a message
  getReactionStats(message: ChatMessage): {
    totalReactions: number;
    uniqueEmojis: string[];
    reactionCounts: Record<string, number>;
  } {
    if (!message.reactions || message.reactions.length === 0) {
      return {
        totalReactions: 0,
        uniqueEmojis: [],
        reactionCounts: {},
      };
    }

    const reactionCounts: Record<string, number> = {};
    
    message.reactions.forEach(reaction => {
      reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
    });

    return {
      totalReactions: message.reactions.length,
      uniqueEmojis: Object.keys(reactionCounts),
      reactionCounts,
    };
  }

  // Check if a message has a specific reaction
  hasReaction(message: ChatMessage, emoji: string): boolean {
    return message.reactions?.some(reaction => reaction.emoji === emoji) || false;
  }

  // Get most recent reaction timestamp for a message
  getLastReactionTime(message: ChatMessage): string | null {
    if (!message.reactions || message.reactions.length === 0) {
      return null;
    }

    return message.reactions
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      .timestamp;
  }

  // Clear all reactions from a message
  async clearAllReactions(
    conversationId: string,
    messageIndex: number
  ): Promise<boolean> {
    try {
      const conversation = await loadConversation(conversationId);
      if (!conversation) return false;

      if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
        return false;
      }

      const message = conversation.messages[messageIndex];
      const updatedMessage = {
        ...message,
        reactions: [],
      };

      const updatedConversation = {
        ...conversation,
        messages: conversation.messages.map((msg, index) =>
          index === messageIndex ? updatedMessage : msg
        ),
      };

      await saveConversation(updatedConversation);
      return true;
    } catch (error) {
      logger.error('Failed to clear reactions:', error);
      return false;
    }
  }
}

// Export singleton instance
export const messageReactions = new MessageReactions();