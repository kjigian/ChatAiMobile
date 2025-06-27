import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider } from '@/ai/generateText';
import { logger } from './logger';

interface CacheEntry {
  response: string;
  timestamp: number;
  provider: Provider;
  model: string;
  ttl: number;
}

interface CacheRequest {
  prompt: string;
  provider: Provider;
  model: string;
  imageHash?: string;
  historyHash?: string;
}

export class ResponseCache {
  private static readonly CACHE_PREFIX = 'ai_response_cache_';
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_CACHE_SIZE = 100; // Maximum number of cached responses
  private static readonly CLEANUP_THRESHOLD = 120; // Cleanup when cache exceeds this

  // Generate cache key from request parameters
  private static generateCacheKey(request: CacheRequest): string {
    const keyData = {
      prompt: request.prompt.substring(0, 1000), // Limit key size
      provider: request.provider,
      model: request.model,
      imageHash: request.imageHash,
      historyHash: request.historyHash,
    };
    
    // Create a hash of the request data
    const keyString = JSON.stringify(keyData);
    return this.CACHE_PREFIX + this.simpleHash(keyString);
  }

  // Simple hash function for cache keys
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Generate hash for conversation history
  static generateHistoryHash(history: Array<{ text: string; role: string }>): string {
    const historyString = history
      .slice(-5) // Only use last 5 messages for cache key
      .map(msg => `${msg.role}:${msg.text.substring(0, 100)}`)
      .join('|');
    return this.simpleHash(historyString);
  }

  // Generate hash for image data
  static generateImageHash(imageData?: { base64?: string; uri?: string }): string | undefined {
    if (!imageData) return undefined;
    const imageString = imageData.base64 || imageData.uri || '';
    return this.simpleHash(imageString.substring(0, 200));
  }

  // Get cached response if valid and not expired
  static async getCached(request: CacheRequest): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(cachedData);
      const now = Date.now();

      // Check if cache entry has expired
      if (now - entry.timestamp > entry.ttl) {
        // Clean up expired entry
        await AsyncStorage.removeItem(cacheKey);
        logger.log('Cache entry expired and removed:', cacheKey);
        return null;
      }

      // Verify cache entry matches current request
      if (entry.provider !== request.provider || entry.model !== request.model) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      logger.log('Cache hit for request:', request.prompt.substring(0, 50) + '...');
      return entry.response;
    } catch (error) {
      logger.warn('Error retrieving from cache:', error);
      return null;
    }
  }

  // Store response in cache
  static async setCached(request: CacheRequest, response: string, customTtl?: number): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const ttl = customTtl || this.DEFAULT_TTL;
      
      const entry: CacheEntry = {
        response,
        timestamp: Date.now(),
        provider: request.provider,
        model: request.model,
        ttl,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      logger.log('Response cached for request:', request.prompt.substring(0, 50) + '...');

      // Periodic cleanup
      await this.periodicCleanup();
    } catch (error) {
      logger.warn('Error storing in cache:', error);
    }
  }

  // Clean up expired entries and limit cache size
  private static async periodicCleanup(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));

      if (cacheKeys.length < this.CLEANUP_THRESHOLD) {
        return;
      }

      logger.log('Running cache cleanup, current size:', cacheKeys.length);

      const now = Date.now();
      const entriesToRemove: string[] = [];
      const validEntries: Array<{ key: string; timestamp: number }> = [];

      // Check each cache entry
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (!data) {
            entriesToRemove.push(key);
            continue;
          }

          const entry: CacheEntry = JSON.parse(data);
          
          // Remove expired entries
          if (now - entry.timestamp > entry.ttl) {
            entriesToRemove.push(key);
          } else {
            validEntries.push({ key, timestamp: entry.timestamp });
          }
        } catch (error) {
          // Remove corrupted entries
          entriesToRemove.push(key);
        }
      }

      // Remove expired/corrupted entries
      if (entriesToRemove.length > 0) {
        await AsyncStorage.multiRemove(entriesToRemove);
        logger.log('Removed expired cache entries:', entriesToRemove.length);
      }

      // If still too many entries, remove oldest ones
      if (validEntries.length > this.MAX_CACHE_SIZE) {
        validEntries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = validEntries.slice(0, validEntries.length - this.MAX_CACHE_SIZE);
        const keysToRemove = toRemove.map(entry => entry.key);
        
        await AsyncStorage.multiRemove(keysToRemove);
        logger.log('Removed old cache entries to maintain size limit:', keysToRemove.length);
      }
    } catch (error) {
      logger.warn('Error during cache cleanup:', error);
    }
  }

  // Clear all cached responses
  static async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.log('Cleared all cached responses:', cacheKeys.length);
      }
    } catch (error) {
      logger.warn('Error clearing cache:', error);
    }
  }

  // Get cache statistics
  static async getStats(): Promise<{ count: number; totalSize: number }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      return { count: cacheKeys.length, totalSize };
    } catch (error) {
      logger.warn('Error getting cache stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}