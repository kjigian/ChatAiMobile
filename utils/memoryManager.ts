import { ChatMessage } from './conversations';
import { logger } from './logger';

export class MemoryManager {
  private static readonly MESSAGE_BATCH_SIZE = 50;
  private static readonly MAX_MESSAGES_IN_MEMORY = 200;
  private static readonly CLEANUP_THRESHOLD = 300;

  // Message pagination state
  private static messageCache = new Map<string, ChatMessage[]>();
  private static conversationOffsets = new Map<string, number>();

  // Get paginated messages for a conversation
  static getPaginatedMessages(
    conversationId: string,
    allMessages: ChatMessage[],
    offset: number = 0,
    limit: number = this.MESSAGE_BATCH_SIZE
  ): {
    messages: ChatMessage[];
    hasMore: boolean;
    nextOffset: number;
  } {
    logger.log('Getting paginated messages:', {
      conversationId: conversationId.substring(0, 8),
      totalMessages: allMessages.length,
      offset,
      limit,
    });

    const startIndex = Math.max(0, allMessages.length - offset - limit);
    const endIndex = allMessages.length - offset;
    
    const messages = allMessages.slice(startIndex, endIndex);
    const hasMore = startIndex > 0;
    const nextOffset = hasMore ? offset + limit : offset;

    // Cache the messages
    const cacheKey = `${conversationId}-${offset}`;
    this.messageCache.set(cacheKey, messages);

    // Update conversation offset
    this.conversationOffsets.set(conversationId, nextOffset);

    return {
      messages,
      hasMore,
      nextOffset,
    };
  }

  // Load more messages for conversation
  static loadMoreMessages(
    conversationId: string,
    allMessages: ChatMessage[],
    currentOffset: number = 0
  ): {
    newMessages: ChatMessage[];
    hasMore: boolean;
    totalOffset: number;
  } {
    const result = this.getPaginatedMessages(
      conversationId,
      allMessages,
      currentOffset,
      this.MESSAGE_BATCH_SIZE
    );

    return {
      newMessages: result.messages,
      hasMore: result.hasMore,
      totalOffset: result.nextOffset,
    };
  }

  // Get cached messages for a conversation offset
  static getCachedMessages(conversationId: string, offset: number): ChatMessage[] | null {
    const cacheKey = `${conversationId}-${offset}`;
    return this.messageCache.get(cacheKey) || null;
  }

  // Smart message loading - loads recent messages first
  static getSmartMessageLoad(
    conversationId: string,
    allMessages: ChatMessage[]
  ): {
    recentMessages: ChatMessage[];
    totalMessages: number;
    loadedCount: number;
    hasMore: boolean;
  } {
    const totalMessages = allMessages.length;
    
    // For conversations with many messages, load only recent ones
    if (totalMessages > this.MAX_MESSAGES_IN_MEMORY) {
      const recentMessages = allMessages.slice(-this.MAX_MESSAGES_IN_MEMORY);
      
      logger.log('Smart loading recent messages:', {
        conversationId: conversationId.substring(0, 8),
        totalMessages,
        loadedCount: recentMessages.length,
      });

      return {
        recentMessages,
        totalMessages,
        loadedCount: recentMessages.length,
        hasMore: totalMessages > this.MAX_MESSAGES_IN_MEMORY,
      };
    }

    // For smaller conversations, load all messages
    return {
      recentMessages: allMessages,
      totalMessages,
      loadedCount: totalMessages,
      hasMore: false,
    };
  }

  // Memory cleanup - remove old cached messages
  static cleanupMemory(): void {
    const cacheSize = this.messageCache.size;
    
    if (cacheSize <= this.CLEANUP_THRESHOLD) {
      return;
    }

    logger.log('Cleaning up message cache, current size:', cacheSize);

    // Convert cache to array and sort by usage
    const cacheEntries = Array.from(this.messageCache.entries());
    
    // Remove oldest half of the cache
    const toRemove = Math.floor(cacheEntries.length / 2);
    
    for (let i = 0; i < toRemove; i++) {
      this.messageCache.delete(cacheEntries[i][0]);
    }

    logger.log('Memory cleanup complete, removed:', toRemove, 'entries');
  }

  // Clear cache for specific conversation
  static clearConversationCache(conversationId: string): void {
    const keysToRemove: string[] = [];
    
    for (const key of this.messageCache.keys()) {
      if (key.startsWith(conversationId)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => this.messageCache.delete(key));
    this.conversationOffsets.delete(conversationId);

    logger.log('Cleared cache for conversation:', conversationId.substring(0, 8));
  }

  // Clear all memory caches
  static clearAllCache(): void {
    this.messageCache.clear();
    this.conversationOffsets.clear();
    logger.log('Cleared all memory caches');
  }

  // Get memory usage statistics
  static getMemoryStats(): {
    cachedConversations: number;
    cachedMessageBatches: number;
    estimatedMemoryUsage: number;
  } {
    const cachedConversations = this.conversationOffsets.size;
    const cachedMessageBatches = this.messageCache.size;
    
    // Rough estimation of memory usage
    let estimatedMemoryUsage = 0;
    for (const messages of this.messageCache.values()) {
      estimatedMemoryUsage += messages.reduce(
        (acc, msg) => acc + msg.text.length + (msg.image ? 100000 : 0), // Rough estimate
        0
      );
    }

    return {
      cachedConversations,
      cachedMessageBatches,
      estimatedMemoryUsage,
    };
  }

  // Optimize conversation for display
  static optimizeConversationForDisplay(
    conversationId: string,
    allMessages: ChatMessage[]
  ): {
    displayMessages: ChatMessage[];
    totalMessages: number;
    isOptimized: boolean;
    recommendations: string[];
  } {
    const totalMessages = allMessages.length;
    const recommendations: string[] = [];
    let isOptimized = false;

    // Check if optimization is needed
    if (totalMessages > this.MAX_MESSAGES_IN_MEMORY) {
      const smartLoad = this.getSmartMessageLoad(conversationId, allMessages);
      
      isOptimized = true;
      recommendations.push(`Loaded ${smartLoad.loadedCount} of ${totalMessages} messages`);
      recommendations.push('Use "Load More" to see older messages');
      
      return {
        displayMessages: smartLoad.recentMessages,
        totalMessages,
        isOptimized,
        recommendations,
      };
    }

    // Check for large images
    const imageCount = allMessages.filter(msg => msg.image).length;
    if (imageCount > 10) {
      recommendations.push('Consider removing old images to improve performance');
    }

    // Check for very long messages
    const longMessages = allMessages.filter(msg => msg.text.length > 5000).length;
    if (longMessages > 5) {
      recommendations.push('Some messages are very long, consider summarizing');
    }

    return {
      displayMessages: allMessages,
      totalMessages,
      isOptimized,
      recommendations,
    };
  }
}