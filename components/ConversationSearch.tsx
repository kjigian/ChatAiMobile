import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Modal } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedTextInput } from './ThemedTextInput';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Conversation } from '@/utils/conversations';
import { ConversationSearchEngine, SearchResult, SearchOptions } from '@/utils/searchEngine';
import { logger } from '@/utils/logger';

interface ConversationSearchProps {
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  onClose: () => void;
  visible: boolean;
}

interface SearchFilters {
  provider: string;
  hasImages: boolean | null;
  dateRange: string;
}

export const ConversationSearch = React.memo<ConversationSearchProps>(({
  conversations,
  onSelectConversation,
  onClose,
  visible
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    provider: 'all',
    hasImages: null,
    dateRange: 'all',
  });

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  // Debounced search function
  const performSearch = useCallback(async (query: string, searchFilters: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchOptions: SearchOptions = {
        query: query.trim(),
        includeMessages: true,
        includeConversationTitles: true,
        caseSensitive: false,
        exactMatch: false,
        maxResults: 20,
      };

      // Apply provider filter
      if (searchFilters.provider !== 'all') {
        searchOptions.provider = searchFilters.provider;
      }

      // Apply date range filter
      if (searchFilters.dateRange !== 'all') {
        const now = new Date();
        const ranges = {
          'today': { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now },
          'week': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
          'month': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
        };
        searchOptions.dateRange = ranges[searchFilters.dateRange as keyof typeof ranges];
      }

      let results: SearchResult[];

      // Use advanced search if we have additional filters
      if (searchFilters.hasImages !== null) {
        results = await ConversationSearchEngine.advancedSearch(conversations, query.trim(), {
          provider: searchFilters.provider === 'all' ? undefined : searchFilters.provider,
          dateRange: searchOptions.dateRange,
          hasImages: searchFilters.hasImages,
        });
      } else {
        results = await ConversationSearchEngine.searchConversations(conversations, searchOptions);
      }

      setSearchResults(results);
      logger.log('Search completed:', { query, resultsCount: results.length });
    } catch (error) {
      logger.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search conversations. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [conversations]);

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performSearch(searchQuery, filters);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters, performSearch]);

  // Get search suggestions
  const suggestions = useMemo(() => {
    if (searchQuery.length > 0) return [];
    return ConversationSearchEngine.generateSearchSuggestions(conversations);
  }, [conversations, searchQuery]);

  // Render search result item
  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => {
    const conversation = item.conversation;
    const messageCount = conversation.messages?.length || 0;
    const createdDate = conversation.createdAt ? new Date(conversation.createdAt).toLocaleDateString() : 'Unknown';

    return (
      <TouchableOpacity
        style={[styles.resultItem, { borderBottomColor: borderColor }]}
        onPress={() => onSelectConversation(conversation.id)}
      >
        <View style={styles.resultHeader}>
          <ThemedText style={[styles.conversationTitle, { color: textColor }]} numberOfLines={1}>
            {conversation.title || 'Untitled Conversation'}
          </ThemedText>
          <View style={styles.resultMeta}>
            <ThemedText style={[styles.metaText, { color: textColor }]}>
              {messageCount} msgs • {createdDate}
            </ThemedText>
            {item.type === 'conversation_title' && (
              <View style={[styles.matchTypeBadge, { backgroundColor: primaryColor }]}>
                <ThemedText style={styles.badgeText}>Title</ThemedText>
              </View>
            )}
          </View>
        </View>
        
        {item.messageMatches.length > 0 && (
          <View style={styles.messageMatches}>
            {item.messageMatches.slice(0, 2).map((match, index) => (
              <View key={index} style={styles.messageMatch}>
                <ThemedText style={[styles.matchContext, { color: textColor }]} numberOfLines={2}>
                  {match.context}
                </ThemedText>
              </View>
            ))}
            {item.messageMatches.length > 2 && (
              <ThemedText style={[styles.moreMatches, { color: primaryColor }]}>
                +{item.messageMatches.length - 2} more matches
              </ThemedText>
            )}
          </View>
        )}
        
        <View style={styles.scoreContainer}>
          <ThemedText style={[styles.scoreText, { color: primaryColor }]}>
            Score: {item.score}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  }, [borderColor, textColor, primaryColor, onSelectConversation]);

  // Render suggestion item
  const renderSuggestion = useCallback(({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.suggestionItem, { backgroundColor: secondaryColor }]}
      onPress={() => setSearchQuery(item)}
    >
      <ThemedText style={[styles.suggestionText, { color: textColor }]}>
        {item}
      </ThemedText>
    </TouchableOpacity>
  ), [secondaryColor, textColor]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <ThemedText style={[styles.closeText, { color: primaryColor }]}>✕</ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Search Conversations</ThemedText>
        <TouchableOpacity 
          onPress={() => setShowFilters(!showFilters)}
          style={styles.filterButton}
        >
          <ThemedText style={[styles.filterText, { color: primaryColor }]}>
            {showFilters ? 'Hide' : 'Filter'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { borderColor }]}>
        <ThemedTextInput
          style={[styles.searchInput, { color: textColor, borderColor }]}
          placeholder="Search conversations and messages..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={visible}
          clearButtonMode="while-editing"
        />
        {isSearching && (
          <ThemedText style={[styles.searchingText, { color: primaryColor }]}>
            Searching...
          </ThemedText>
        )}
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={[styles.filtersContainer, { backgroundColor: secondaryColor, borderColor }]}>
          <View style={styles.filterRow}>
            <ThemedText style={[styles.filterLabel, { color: textColor }]}>Provider:</ThemedText>
            <View style={styles.filterOptions}>
              {['all', 'gemini', 'openai', 'anthropic'].map(provider => (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.filterOption,
                    { backgroundColor: filters.provider === provider ? primaryColor : 'transparent' }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, provider }))}
                >
                  <ThemedText 
                    style={[
                      styles.filterOptionText,
                      { color: filters.provider === provider ? 'white' : textColor }
                    ]}
                  >
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.filterRow}>
            <ThemedText style={[styles.filterLabel, { color: textColor }]}>Time:</ThemedText>
            <View style={styles.filterOptions}>
              {['all', 'today', 'week', 'month'].map(range => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.filterOption,
                    { backgroundColor: filters.dateRange === range ? primaryColor : 'transparent' }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, dateRange: range }))}
                >
                  <ThemedText 
                    style={[
                      styles.filterOptionText,
                      { color: filters.dateRange === range ? 'white' : textColor }
                    ]}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsContainer}>
        {searchQuery.length < 2 ? (
          // Show suggestions when no search query
          <View style={styles.suggestionsContainer}>
            <ThemedText style={[styles.suggestionsTitle, { color: textColor }]}>
              Search Suggestions:
            </ThemedText>
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item) => item}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsList}
            />
          </View>
        ) : searchResults.length > 0 ? (
          // Show search results
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.conversation.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
          />
        ) : !isSearching ? (
          // Show no results message
          <View style={styles.noResultsContainer}>
            <ThemedText style={[styles.noResultsText, { color: textColor }]}>
              No conversations found for &ldquo;{searchQuery}&rdquo;
            </ThemedText>
            <ThemedText style={[styles.noResultsSubtext, { color: textColor }]}>
              Try different keywords or check your filters
            </ThemedText>
          </View>
        ) : null}
      </View>
      </ThemedView>
    </Modal>
  );
});

ConversationSearch.displayName = 'ConversationSearch';

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
  filterButton: {
    padding: 4,
  },
  filterText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchingText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  filtersContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    padding: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  resultMeta: {
    alignItems: 'flex-end',
  },
  metaText: {
    fontSize: 12,
    opacity: 0.7,
  },
  matchTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  messageMatches: {
    marginTop: 8,
  },
  messageMatch: {
    marginBottom: 4,
  },
  matchContext: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  moreMatches: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  scoreContainer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 10,
    opacity: 0.6,
  },
  suggestionsContainer: {
    padding: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionsList: {
    paddingTop: 8,
  },
  suggestionItem: {
    flex: 1,
    margin: 4,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default ConversationSearch;