import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, ChatMessage } from './conversations';
import { logger } from './logger';

export interface ExportData {
  version: string;
  exportDate: string;
  totalConversations: number;
  conversations: Conversation[];
  metadata: {
    appVersion: string;
    platform: string;
    exportFormat: 'json' | 'markdown';
  };
}

export interface ExportOptions {
  format: 'json' | 'markdown';
  includeImages: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  conversationIds?: string[];
  prettify?: boolean;
}

export class DataExporter {
  private static readonly EXPORT_VERSION = '1.0';
  private static readonly APP_VERSION = '1.0.0';

  // Export conversations to various formats
  static async exportConversations(
    conversations: Conversation[],
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; fileName?: string; error?: string }> {
    try {
      logger.log('Starting export:', {
        format: options.format,
        conversationCount: conversations.length,
        includeImages: options.includeImages,
      });

      // Filter conversations based on options
      let filteredConversations = conversations;

      // Apply conversation ID filter
      if (options.conversationIds && options.conversationIds.length > 0) {
        filteredConversations = filteredConversations.filter(conv =>
          options.conversationIds!.includes(conv.id)
        );
      }

      // Apply date range filter
      if (options.dateRange) {
        filteredConversations = filteredConversations.filter(conv => {
          const convDate = new Date(conv.createdAt || 0);
          return convDate >= options.dateRange!.start && convDate <= options.dateRange!.end;
        });
      }

      // Process images if needed
      if (!options.includeImages) {
        filteredConversations = filteredConversations.map(conv => ({
          ...conv,
          messages: conv.messages?.map(msg => ({ ...msg, image: undefined })) || [],
        }));
      }

      let content: string;
      let fileName: string;

      if (options.format === 'json') {
        const exportData: ExportData = {
          version: this.EXPORT_VERSION,
          exportDate: new Date().toISOString(),
          totalConversations: filteredConversations.length,
          conversations: filteredConversations,
          metadata: {
            appVersion: this.APP_VERSION,
            platform: Platform.OS,
            exportFormat: 'json',
          },
        };

        content = options.prettify 
          ? JSON.stringify(exportData, null, 2)
          : JSON.stringify(exportData);
        fileName = `conversations_${new Date().toISOString().split('T')[0]}.json`;
      } else {
        content = this.convertToMarkdown(filteredConversations);
        fileName = `conversations_${new Date().toISOString().split('T')[0]}.md`;
      }

      logger.log('Export completed:', {
        fileName,
        fileSize: content.length,
        conversationsExported: filteredConversations.length,
      });

      return { success: true, content, fileName };
    } catch (error) {
      logger.error('Export failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Convert conversations to markdown format
  private static convertToMarkdown(conversations: Conversation[]): string {
    const lines: string[] = [];
    
    lines.push('# Conversation Export');
    lines.push('');
    lines.push(`**Export Date:** ${new Date().toLocaleString()}`);
    lines.push(`**Total Conversations:** ${conversations.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    conversations.forEach((conversation, index) => {
      lines.push(`## ${index + 1}. ${conversation.title || 'Untitled Conversation'}`);
      lines.push('');
      
      // Conversation metadata
      lines.push(`**ID:** ${conversation.id}`);
      lines.push(`**Provider:** ${conversation.provider || 'Unknown'}`);
      lines.push(`**Model:** ${conversation.model || 'Unknown'}`);
      lines.push(`**Created:** ${conversation.createdAt ? new Date(conversation.createdAt).toLocaleString() : 'Unknown'}`);
      lines.push(`**Messages:** ${conversation.messages?.length || 0}`);
      lines.push('');

      // Messages
      if (conversation.messages && conversation.messages.length > 0) {
        lines.push('### Messages');
        lines.push('');

        conversation.messages.forEach((message, msgIndex) => {
          const role = message.role === 'user' ? '🧑 **User**' : '🤖 **Assistant**';
          lines.push(`#### ${msgIndex + 1}. ${role}`);
          lines.push('');
          
          if (message.image) {
            lines.push('*[Image attached]*');
            lines.push('');
          }
          
          lines.push(message.text);
          lines.push('');
          lines.push('---');
          lines.push('');
        });
      } else {
        lines.push('*No messages in this conversation*');
        lines.push('');
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  // Copy export content to clipboard (fallback for sharing)
  static async copyToClipboard(content: string, fileName: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Web clipboard API
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(content);
          Alert.alert('Copied to Clipboard', `${fileName} content has been copied to your clipboard.`);
          return true;
        }
      }
      
      // For mobile, we'll show the content for manual copy
      Alert.alert(
        'Export Ready',
        `${fileName} is ready. The content will be shown for manual copying.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Show Content', 
            onPress: () => {
              Alert.alert('Export Content', content.substring(0, 1000) + (content.length > 1000 ? '...' : ''));
            }
          },
        ]
      );
      return true;
    } catch (error) {
      logger.error('Copy failed:', error);
      Alert.alert('Copy Failed', 'Could not copy the exported content.');
      return false;
    }
  }

  // Quick export with default options
  static async quickExportJSON(conversations: Conversation[]): Promise<void> {
    const result = await this.exportConversations(conversations, {
      format: 'json',
      includeImages: true,
      prettify: true,
    });

    if (result.success && result.content && result.fileName) {
      Alert.alert(
        'Export Successful',
        'Conversations have been exported. Would you like to copy to clipboard?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy', 
            onPress: () => this.copyToClipboard(result.content!, result.fileName!) 
          },
        ]
      );
    } else {
      Alert.alert('Export Failed', result.error || 'Unknown error occurred.');
    }
  }

  // Quick export as Markdown
  static async quickExportMarkdown(conversations: Conversation[]): Promise<void> {
    const result = await this.exportConversations(conversations, {
      format: 'markdown',
      includeImages: false, // Images not supported in markdown
    });

    if (result.success && result.content && result.fileName) {
      Alert.alert(
        'Export Successful',
        'Conversations have been exported as Markdown. Would you like to copy to clipboard?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy', 
            onPress: () => this.copyToClipboard(result.content!, result.fileName!) 
          },
        ]
      );
    } else {
      Alert.alert('Export Failed', result.error || 'Unknown error occurred.');
    }
  }
}

export class DataImporter {
  // Import conversations from JSON text
  static async importFromJSONText(jsonText: string): Promise<{
    success: boolean;
    conversations?: Conversation[];
    error?: string;
  }> {
    try {
      logger.log('Starting import from text');

      // Parse JSON
      const data: ExportData = JSON.parse(jsonText);

      // Validate format
      if (!data.conversations || !Array.isArray(data.conversations)) {
        return { success: false, error: 'Invalid file format: conversations array not found' };
      }

      // Validate conversation structure
      const validConversations: Conversation[] = [];
      let invalidCount = 0;

      for (const conv of data.conversations) {
        if (this.validateConversationStructure(conv)) {
          validConversations.push(conv);
        } else {
          invalidCount++;
        }
      }

      if (invalidCount > 0) {
        logger.warn('Invalid conversations found:', invalidCount);
      }

      logger.log('Import completed:', {
        totalFound: data.conversations.length,
        validConversations: validConversations.length,
        invalidCount,
      });

      return {
        success: true,
        conversations: validConversations,
      };
    } catch (error) {
      logger.error('Import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Validate conversation structure
  private static validateConversationStructure(conv: any): conv is Conversation {
    return (
      typeof conv === 'object' &&
      typeof conv.id === 'string' &&
      conv.id.length > 0 &&
      Array.isArray(conv.messages)
    );
  }

  // Merge imported conversations with existing ones
  static mergeConversations(
    existing: Conversation[],
    imported: Conversation[]
  ): {
    merged: Conversation[];
    addedCount: number;
    duplicateCount: number;
    updatedCount: number;
  } {
    const existingIds = new Set(existing.map(conv => conv.id));
    const merged = [...existing];
    let addedCount = 0;
    let duplicateCount = 0;
    let updatedCount = 0;

    for (const importedConv of imported) {
      if (existingIds.has(importedConv.id)) {
        // Check if we should update the existing conversation
        const existingIndex = merged.findIndex(conv => conv.id === importedConv.id);
        const existingConv = merged[existingIndex];
        
        // Update if imported has more messages or newer timestamp
        const shouldUpdate = 
          (importedConv.messages?.length || 0) > (existingConv.messages?.length || 0) ||
          (importedConv.updatedAt || 0) > (existingConv.updatedAt || 0);

        if (shouldUpdate) {
          merged[existingIndex] = importedConv;
          updatedCount++;
        } else {
          duplicateCount++;
        }
      } else {
        merged.push(importedConv);
        addedCount++;
      }
    }

    return { merged, addedCount, duplicateCount, updatedCount };
  }

  // Quick import with manual JSON input
  static async quickImportWithPrompt(): Promise<Conversation[]> {
    return new Promise((resolve) => {
      Alert.prompt(
        'Import Conversations',
        'Paste your exported JSON data below:',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
          {
            text: 'Import',
            onPress: async (jsonText) => {
              if (!jsonText) {
                Alert.alert('No Data', 'Please paste the JSON data to import.');
                resolve([]);
                return;
              }

              const result = await this.importFromJSONText(jsonText);

              if (!result.success) {
                Alert.alert('Import Failed', result.error || 'Unknown error occurred.');
                resolve([]);
                return;
              }

              if (!result.conversations || result.conversations.length === 0) {
                Alert.alert('No Data', 'No valid conversations found in the provided data.');
                resolve([]);
                return;
              }

              Alert.alert(
                'Import Successful',
                `Found ${result.conversations.length} conversations. They will be merged with your existing data.`,
                [{ text: 'OK' }]
              );

              resolve(result.conversations);
            },
          },
        ],
        'plain-text'
      );
    });
  }
}