import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { FlatList, View, ViewStyle, TouchableOpacity, Alert } from 'react-native';
import { ChatMessage, hasMultipleVersions } from '@/utils/conversations';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Image } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import { MessageReactions } from './MessageReactions';
import { MessageVersions } from './MessageVersions';

interface VirtualChatListProps {
  messages: ChatMessage[];
  markdownStyles: any;
  style?: ViewStyle;
  onScrollToEnd?: () => void;
  scrollToEnd?: boolean;
  onEditMessage?: (index: number, message: ChatMessage) => void;
  onDeleteMessage?: (index: number) => void;
  conversationId?: string;
  isConversationSaved?: boolean;
  onReactionUpdate?: () => void;
  onVersionSwitch?: (messageIndex: number, versionNumber: number) => Promise<void>;
}

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  markdownStyles: any;
  onEditMessage?: (index: number, message: ChatMessage) => void;
  onDeleteMessage?: (index: number) => void;
  conversationId?: string;
  isConversationSaved?: boolean;
  onReactionUpdate?: () => void;
  onVersionSwitch?: (messageIndex: number, versionNumber: number) => Promise<void>;
}

// Memoized individual message component
const MessageItem = React.memo<MessageItemProps>(({ 
  message, 
  index, 
  markdownStyles, 
  onEditMessage, 
  onDeleteMessage,
  conversationId,
  isConversationSaved,
  onReactionUpdate,
  onVersionSwitch
}) => {
  const isUser = message.role === 'user';
  
  const messageStyles = useMemo(() => ({
    container: {
      marginVertical: 8,
      paddingHorizontal: isUser ? 16 : 4,
      alignItems: isUser ? 'flex-end' : 'flex-start',
    } as ViewStyle,
    bubble: {
      backgroundColor: isUser ? '#007AFF' : '#424242',
      padding: 12,
      borderRadius: 16,
      maxWidth: isUser ? '85%' : '95%',
      minWidth: '20%',
      borderBottomRightRadius: isUser ? 4 : 16,
      borderBottomLeftRadius: isUser ? 16 : 4,
      flexShrink: 1,
    } as ViewStyle,
    text: {
      color: isUser ? '#ffffff' : '#ffffff',
      fontSize: 16,
      lineHeight: 22,
      flexWrap: 'wrap',
      flexShrink: 1,
      width: '100%',
    },
    image: {
      width: 200,
      height: 150,
      borderRadius: 8,
      marginBottom: 8,
    },
    providerBadge: {
      fontSize: 10,
      opacity: 0.7,
      marginTop: 4,
      alignSelf: 'flex-end',
      color: isUser ? '#ffffff' : '#666666',
    },
  }), [isUser]);

  const handleLongPress = () => {
    if (!onEditMessage && !onDeleteMessage) return;
    
    const options = [];
    
    // Only allow editing user messages
    if (onEditMessage && isUser) {
      options.push({ text: 'Edit', onPress: () => onEditMessage(index, message) });
    }
    
    // Allow deleting any message
    if (onDeleteMessage) {
      options.push({ text: 'Delete', style: 'destructive' as const, onPress: () => onDeleteMessage(index) });
    }
    
    options.push({ text: 'Cancel', style: 'cancel' as const });
    
    // Only show alert if there are actions available
    if (options.length > 1) {
      Alert.alert(
        'Message Options',
        `${isUser ? 'Your message' : 'AI response'}`,
        options
      );
    }
  };

  return (
    <TouchableOpacity 
      style={messageStyles.container}
      onLongPress={handleLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <ThemedView style={messageStyles.bubble}>
        {message.image && (
          <Image
            source={{ uri: message.image.uri }}
            style={messageStyles.image}
            contentFit="cover"
          />
        )}
        
        {isUser ? (
          <ThemedText style={messageStyles.text} selectable>
            {message.text}
          </ThemedText>
        ) : (
          <Markdown style={markdownStyles}>
            {`**${(message.provider ?? 'AI').charAt(0).toUpperCase() + (message.provider ?? 'AI').slice(1)}:** ${message.text}`}
          </Markdown>
        )}
        
        {message.provider && !isUser && (
          <ThemedText style={messageStyles.providerBadge}>
            {message.provider}
          </ThemedText>
        )}

        {/* Add reactions component only to AI messages */}
        {conversationId && isConversationSaved && !isUser && (
          <MessageReactions
            message={message}
            conversationId={conversationId}
            messageIndex={index}
            onReactionUpdate={onReactionUpdate}
          />
        )}
      </ThemedView>

      {/* Add version indicator for messages with multiple versions */}
      {conversationId && hasMultipleVersions(message) && onVersionSwitch && (
        <MessageVersions
          message={message}
          conversationId={conversationId}
          messageIndex={index}
          onVersionSwitch={(versionNumber) => onVersionSwitch(index, versionNumber)}
        />
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return (
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.provider === nextProps.message.provider &&
    prevProps.message.image?.uri === nextProps.message.image?.uri &&
    prevProps.index === nextProps.index
  );
});

MessageItem.displayName = 'MessageItem';

// Virtual chat list component
export const VirtualChatList = React.memo<VirtualChatListProps>(({
  messages,
  markdownStyles,
  style,
  onScrollToEnd,
  scrollToEnd = false,
  onEditMessage,
  onDeleteMessage,
  conversationId,
  isConversationSaved,
  onReactionUpdate,
  onVersionSwitch,
}) => {
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollToEnd && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, scrollToEnd]);

  // Render individual message
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    return (
      <MessageItem
        message={item}
        index={index}
        markdownStyles={markdownStyles}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        conversationId={conversationId}
        isConversationSaved={isConversationSaved}
        onReactionUpdate={onReactionUpdate}
        onVersionSwitch={onVersionSwitch}
      />
    );
  }, [markdownStyles, onEditMessage, onDeleteMessage, conversationId, isConversationSaved, onReactionUpdate, onVersionSwitch]);

  // Generate unique key for each message
  const keyExtractor = useCallback((item: ChatMessage, index: number) => {
    return `${item.role}-${index}-${item.text.substring(0, 20)}`;
  }, []);

  // Estimate item height for better performance
  const getItemLayout = useCallback((data: any, index: number) => {
    const averageHeight = 80; // Estimated average height per message
    return {
      length: averageHeight,
      offset: averageHeight * index,
      index,
    };
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    onScrollToEnd?.();
  }, [onScrollToEnd]);

  // Performance optimizations
  const performanceProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    initialNumToRender: 20,
    windowSize: 10,
    getItemLayout: messages.length > 100 ? getItemLayout : undefined,
  }), [messages.length, getItemLayout]);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={handleScroll}
      {...performanceProps}
    />
  );
});

VirtualChatList.displayName = 'VirtualChatList';

export default VirtualChatList;