import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Conversation, ChatMessage } from './conversations';
import { logger } from './logger';

export interface ShareOptions {
  format: 'json' | 'markdown' | 'text';
  includeMetadata: boolean;
  includeImages: boolean;
  title?: string;
}

export interface SharedConversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
  tags?: string[];
  sharedAt: string;
  sharedBy?: string;
}

class ConversationSharingManager {
  async shareConversation(
    conversation: Conversation,
    options: ShareOptions = {
      format: 'markdown',
      includeMetadata: true,
      includeImages: false,
    }
  ): Promise<boolean> {
    try {
      const content = await this.formatConversation(conversation, options);
      const filename = this.generateFilename(conversation, options.format);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: options.title || `Share ${conversation.title || 'Conversation'}`,
        });
        
        // Clean up the temporary file
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        
        logger.log('Successfully shared conversation:', conversation.id);
        return true;
      } else {
        logger.warn('Sharing not available on this platform');
        return false;
      }
    } catch (error) {
      logger.error('Failed to share conversation:', error);
      return false;
    }
  }

  async shareMultipleConversations(
    conversations: Conversation[],
    options: ShareOptions = {
      format: 'json',
      includeMetadata: true,
      includeImages: false,
    }
  ): Promise<boolean> {
    try {
      let content: string;
      let filename: string;

      if (options.format === 'json') {
        const sharedConversations: SharedConversation[] = conversations.map(conv => ({
          ...conv,
          sharedAt: new Date().toISOString(),
        }));
        content = JSON.stringify(sharedConversations, null, 2);
        filename = `conversations-export-${new Date().toISOString().split('T')[0]}.json`;
      } else {
        content = conversations
          .map(conv => this.formatConversation(conv, options))
          .join('\n\n---\n\n');
        filename = `conversations-export-${new Date().toISOString().split('T')[0]}.${options.format}`;
      }

      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: options.title || `Share ${conversations.length} Conversations`,
        });
        
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        
        logger.log('Successfully shared', conversations.length, 'conversations');
        return true;
      } else {
        logger.warn('Sharing not available on this platform');
        return false;
      }
    } catch (error) {
      logger.error('Failed to share conversations:', error);
      return false;
    }
  }

  async createShareableLink(conversation: Conversation): Promise<string | null> {
    try {
      // This would typically involve uploading to a sharing service
      // For now, we'll create a simple encoded URL that could be handled by a web service
      const shareData: SharedConversation = {
        ...conversation,
        sharedAt: new Date().toISOString(),
      };

      // In a real implementation, you would:
      // 1. Upload the conversation to a secure sharing service
      // 2. Get back a unique share ID
      // 3. Return a URL like: https://yourapp.com/shared/[shareId]
      
      // For demo purposes, we'll create a data URL
      const encoded = btoa(JSON.stringify(shareData));
      const shareUrl = `https://your-app.com/shared?data=${encoded}`;
      
      logger.log('Created shareable link for conversation:', conversation.id);
      return shareUrl;
    } catch (error) {
      logger.error('Failed to create shareable link:', error);
      return null;
    }
  }

  async importFromShareableLink(url: string): Promise<SharedConversation | null> {
    try {
      // Extract data from URL
      const urlObj = new URL(url);
      const encodedData = urlObj.searchParams.get('data');
      
      if (!encodedData) {
        throw new Error('No data found in share URL');
      }

      const decoded = atob(encodedData);
      const sharedConversation: SharedConversation = JSON.parse(decoded);
      
      // Validate the conversation structure
      if (!sharedConversation.id || !sharedConversation.messages) {
        throw new Error('Invalid conversation data');
      }

      logger.log('Successfully imported conversation from link:', sharedConversation.id);
      return sharedConversation;
    } catch (error) {
      logger.error('Failed to import from shareable link:', error);
      return null;
    }
  }

  private async formatConversation(conversation: Conversation, options: ShareOptions): Promise<string> {
    switch (options.format) {
      case 'json':
        return this.formatAsJSON(conversation, options);
      case 'markdown':
        return this.formatAsMarkdown(conversation, options);
      case 'text':
        return this.formatAsText(conversation, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  private formatAsJSON(conversation: Conversation, options: ShareOptions): string {
    const shareData: SharedConversation = {
      ...conversation,
      sharedAt: new Date().toISOString(),
    };

    if (!options.includeImages) {
      shareData.messages = shareData.messages.map(msg => ({
        ...msg,
        image: undefined,
      }));
    }

    return JSON.stringify(shareData, null, 2);
  }

  private formatAsMarkdown(conversation: Conversation, options: ShareOptions): string {
    let content = '';

    if (options.includeMetadata) {
      content += `# ${conversation.title || 'Conversation'}\n\n`;
      content += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
      content += `**Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n`;
      content += `**Provider:** ${conversation.provider}\n`;
      content += `**Model:** ${conversation.model}\n`;
      
      if (conversation.tags && conversation.tags.length > 0) {
        content += `**Tags:** ${conversation.tags.join(', ')}\n`;
      }
      
      content += '\n---\n\n';
    }

    for (const message of conversation.messages) {
      const role = message.role === 'user' ? 'User' : (message.provider || 'AI');
      content += `## ${role}\n\n`;
      
      if (message.image && options.includeImages) {
        content += `![Image](${message.image.uri})\n\n`;
      }
      
      content += `${message.text}\n\n`;
    }

    return content;
  }

  private formatAsText(conversation: Conversation, options: ShareOptions): string {
    let content = '';

    if (options.includeMetadata) {
      content += `${conversation.title || 'Conversation'}\n`;
      content += `${'='.repeat((conversation.title || 'Conversation').length)}\n\n`;
      content += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
      content += `Updated: ${new Date(conversation.updatedAt).toLocaleString()}\n`;
      content += `Provider: ${conversation.provider}\n`;
      content += `Model: ${conversation.model}\n`;
      
      if (conversation.tags && conversation.tags.length > 0) {
        content += `Tags: ${conversation.tags.join(', ')}\n`;
      }
      
      content += '\n' + '-'.repeat(50) + '\n\n';
    }

    for (const message of conversation.messages) {
      const role = message.role === 'user' ? 'User' : (message.provider || 'AI');
      content += `${role}: ${message.text}\n\n`;
    }

    return content;
  }

  private generateFilename(conversation: Conversation, format: string): string {
    const title = conversation.title || 'conversation';
    const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
    const timestamp = new Date().toISOString().split('T')[0];
    return `${safeTitle}-${timestamp}.${format}`;
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'markdown':
        return 'text/markdown';
      case 'text':
        return 'text/plain';
      default:
        return 'text/plain';
    }
  }
}

export const conversationSharing = new ConversationSharingManager();