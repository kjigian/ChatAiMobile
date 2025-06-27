import { Conversation, ChatMessage } from './conversations';
import { logger } from './logger';

export interface SearchResult {
  conversation: Conversation;
  messageMatches: MessageMatch[];
  score: number;
  type: 'conversation_title' | 'message_content' | 'both';
}

export interface MessageMatch {
  message: ChatMessage;
  messageIndex: number;
  matchedText: string;
  context: string;
  score: number;
}

export interface SearchOptions {
  query: string;
  includeMessages: boolean;
  includeConversationTitles: boolean;
  caseSensitive: boolean;
  exactMatch: boolean;
  provider?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  maxResults?: number;
}

export class ConversationSearchEngine {
  private static readonly DEFAULT_OPTIONS: Partial<SearchOptions> = {
    includeMessages: true,
    includeConversationTitles: true,
    caseSensitive: false,
    exactMatch: false,
    maxResults: 50,
  };

  // Main search function
  static async searchConversations(
    conversations: Conversation[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const fullOptions = { ...this.DEFAULT_OPTIONS, ...options };

    if (!fullOptions.query || fullOptions.query.trim().length === 0) {
      return [];
    }

    logger.log('Starting conversation search:', {
      query: fullOptions.query,
      totalConversations: conversations.length,
      options: fullOptions,
    });

    const results: SearchResult[] = [];

    for (const conversation of conversations) {
      const result = this.searchSingleConversation(conversation, fullOptions);
      if (result && result.score > 0) {
        results.push(result);
      }
    }

    // Sort by relevance score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Apply max results limit
    const limitedResults = results.slice(0, fullOptions.maxResults);

    const searchTime = Date.now() - startTime;
    logger.log('Search completed:', {
      query: fullOptions.query,
      resultsFound: limitedResults.length,
      searchTime: `${searchTime}ms`,
    });

    return limitedResults;
  }

  // Search within a single conversation
  private static searchSingleConversation(
    conversation: Conversation,
    options: SearchOptions
  ): SearchResult | null {
    let totalScore = 0;
    let resultType: SearchResult['type'] = 'message_content';
    const messageMatches: MessageMatch[] = [];

    // Apply date filter if specified
    if (options.dateRange) {
      const conversationDate = new Date(conversation.createdAt || 0);
      if (conversationDate < options.dateRange.start || conversationDate > options.dateRange.end) {
        return null;
      }
    }

    // Apply provider filter if specified
    if (options.provider && conversation.provider !== options.provider) {
      return null;
    }

    // Search conversation title
    if (options.includeConversationTitles && conversation.title) {
      const titleMatch = this.searchText(conversation.title, options.query, options);
      if (titleMatch.found) {
        totalScore += titleMatch.score * 2; // Title matches get double weight
        resultType = totalScore > 0 ? 'conversation_title' : resultType;
      }
    }

    // Search messages
    if (options.includeMessages && conversation.messages) {
      conversation.messages.forEach((message, index) => {
        const messageMatch = this.searchMessage(message, index, options.query, options);
        if (messageMatch) {
          messageMatches.push(messageMatch);
          totalScore += messageMatch.score;
        }
      });

      if (messageMatches.length > 0) {
        resultType = resultType === 'conversation_title' ? 'both' : 'message_content';
      }
    }

    if (totalScore === 0) {
      return null;
    }

    return {
      conversation,
      messageMatches,
      score: totalScore,
      type: resultType,
    };
  }

  // Search within a single message
  private static searchMessage(
    message: ChatMessage,
    messageIndex: number,
    query: string,
    options: SearchOptions
  ): MessageMatch | null {
    const searchResult = this.searchText(message.text, query, options);
    
    if (!searchResult.found) {
      return null;
    }

    // Generate context around the match
    const context = this.generateContext(message.text, query, options);

    return {
      message,
      messageIndex,
      matchedText: searchResult.matchedText,
      context,
      score: searchResult.score,
    };
  }

  // Core text search function
  private static searchText(
    text: string,
    query: string,
    options: SearchOptions
  ): { found: boolean; score: number; matchedText: string } {
    if (!text || !query) {
      return { found: false, score: 0, matchedText: '' };
    }

    const searchText = options.caseSensitive ? text : text.toLowerCase();
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    if (options.exactMatch) {
      const found = searchText.includes(searchQuery);
      return {
        found,
        score: found ? query.length : 0,
        matchedText: found ? query : '',
      };
    }

    // Fuzzy search with scoring
    const words = searchQuery.split(/\s+/).filter(word => word.length > 0);
    let totalScore = 0;
    let matchedWords: string[] = [];

    for (const word of words) {
      if (searchText.includes(word)) {
        // Base score for word match
        let wordScore = word.length;
        
        // Bonus for exact word boundaries
        const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
        if (wordBoundaryRegex.test(text)) {
          wordScore *= 1.5;
        }

        // Bonus for beginning of text
        if (searchText.startsWith(word)) {
          wordScore *= 1.3;
        }

        totalScore += wordScore;
        matchedWords.push(word);
      }
    }

    // Bonus for matching all words
    if (matchedWords.length === words.length) {
      totalScore *= 1.2;
    }

    return {
      found: totalScore > 0,
      score: Math.round(totalScore),
      matchedText: matchedWords.join(' '),
    };
  }

  // Generate context snippet around matches
  private static generateContext(text: string, query: string, options: SearchOptions): string {
    const maxContextLength = 150;
    const searchText = options.caseSensitive ? text : text.toLowerCase();
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    // Find first match position
    const matchIndex = searchText.indexOf(searchQuery.split(' ')[0]);
    if (matchIndex === -1) {
      return text.substring(0, maxContextLength) + (text.length > maxContextLength ? '...' : '');
    }

    // Calculate context boundaries
    const halfContext = Math.floor(maxContextLength / 2);
    const start = Math.max(0, matchIndex - halfContext);
    const end = Math.min(text.length, matchIndex + searchQuery.length + halfContext);

    let context = text.substring(start, end);
    
    // Add ellipsis if we truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
  }

  // Search suggestions based on existing conversations
  static generateSearchSuggestions(conversations: Conversation[]): string[] {
    const suggestions = new Set<string>();
    
    // Add common words from conversation titles
    conversations.forEach(conv => {
      if (conv.title) {
        const words = conv.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3 && !this.isCommonWord(word)) {
            suggestions.add(word);
          }
        });
      }
    });

    // Add provider names
    suggestions.add('gemini');
    suggestions.add('openai');
    suggestions.add('claude');

    // Add common topics (could be expanded based on usage)
    suggestions.add('code');
    suggestions.add('help');
    suggestions.add('explain');
    suggestions.add('question');

    return Array.from(suggestions).slice(0, 10);
  }

  // Helper function to escape regex special characters
  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Helper function to identify common words to exclude from suggestions
  private static isCommonWord(word: string): boolean {
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'put', 'say', 'she', 'too', 'use'];
    return commonWords.includes(word.toLowerCase());
  }

  // Advanced search with filters
  static async advancedSearch(
    conversations: Conversation[],
    query: string,
    filters: {
      provider?: string;
      dateRange?: { start: Date; end: Date };
      hasImages?: boolean;
      minMessages?: number;
      maxMessages?: number;
    }
  ): Promise<SearchResult[]> {
    let filteredConversations = conversations;

    // Apply filters before search
    if (filters.hasImages !== undefined) {
      filteredConversations = filteredConversations.filter(conv => {
        const hasImages = conv.messages?.some(msg => msg.image) || false;
        return filters.hasImages ? hasImages : !hasImages;
      });
    }

    if (filters.minMessages !== undefined || filters.maxMessages !== undefined) {
      filteredConversations = filteredConversations.filter(conv => {
        const messageCount = conv.messages?.length || 0;
        const meetsMin = filters.minMessages === undefined || messageCount >= filters.minMessages;
        const meetsMax = filters.maxMessages === undefined || messageCount <= filters.maxMessages;
        return meetsMin && meetsMax;
      });
    }

    return this.searchConversations(filteredConversations, {
      query,
      includeMessages: true,
      includeConversationTitles: true,
      caseSensitive: false,
      exactMatch: false,
      provider: filters.provider,
      dateRange: filters.dateRange,
    });
  }
}