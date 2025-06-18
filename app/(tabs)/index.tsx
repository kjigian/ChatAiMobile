import React, { useState, useRef, useMemo, useEffect } from 'react';
import { getItem } from '@/utils/storage';
import { ScrollView as RNScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateText, Provider } from '@/ai/generateText';


import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { createNewConversation, saveConversation, loadConversation, Conversation } from '@/utils/conversations';
import Markdown from 'react-native-markdown-display';
import { useProviderModel } from '@/context/ProviderModelContext';
import { useNavigation } from 'expo-router';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  provider?: Provider; // Present for model messages
}

export default function GeminiChatScreen() {
    const { selectedProvider, selectedModel } = useProviderModel();

  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ gemini: '', openai: '', anthropic: '' });

  // Load API keys from storage
  // create new conversation on first mount
  useEffect(() => {
    (async () => {
      const conv = await createNewConversation({ provider: selectedProvider, model: selectedModel });
      setConversation(conv);
    })();
  }, []);

  useEffect(() => {
        const loadKeys = async () => {
      try {
                        const [gKey, oKey, aKey] = await Promise.all([
          getItem('gemini_api_key'),
          getItem('openai_api_key'),
          getItem('anthropic_api_key'),
        ]);
        setApiKeys({
          gemini: gKey ?? '',
          openai: oKey ?? '',
          anthropic: aKey ?? '',
        });
      } catch (e) {
        console.error('Failed to load API key', e);
      }
    };
        loadKeys();
  }, []);
  const [userInput, setUserInput] = useState('');
  const navigation = useNavigation<any>();

  // listen for refreshTime param to start new chat
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const routeAny = navigation.getState()?.routes?.find((rt: any)=>rt.name==='(tabs)');
      const params = routeAny?.params as any || {};
      const { refreshTime, loadId } = params;
      if (loadId) {
          (async () => {
            const conv = await loadConversation(loadId);
            if (conv) {
              setConversation(conv);
              setChatHistory(conv.messages as any);
            }
            navigation.setParams({ loadId: undefined });
          })();
        } else if (refreshTime) {
        (async () => {
          const conv = await createNewConversation({ provider: selectedProvider, model: selectedModel });
          setConversation(conv);
          setChatHistory([]);
          // clear param
          navigation.setParams({ refreshTime: undefined });
        })();
      }
    });
    return unsubscribe;
  }, [navigation, selectedProvider, selectedModel]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const scrollViewRef = useRef<RNScrollView>(null);

    const insets = useSafeAreaInsets();
  // Call useThemedStyles at the top level and destructure all needed values
  const { styles, iconColor, primaryColor, backgroundColor, markdownStyles } = useThemedStyles(insets.bottom);

    const currentApiKey = apiKeys[selectedProvider] ?? '';

  const handleSendMessage = async () => {
        if (!currentApiKey.trim()) {
            Alert.alert('API Key Required', `Please enter your ${selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key in Settings.`);
      return;
    }
    if (!userInput.trim()) {
      Alert.alert('Message Required', 'Please type a message to send.');
      return;
    }

    setIsLoading(true);
        const newUserMessage: ChatMessage = { role: 'user', text: userInput };
    setChatHistory(prevChat => [...prevChat, newUserMessage]);
    setUserInput('');

    try {
                  const text = await generateText({
        provider: selectedProvider,
        model: selectedModel,
        prompt: userInput,
        apiKey: currentApiKey,
        history: [...chatHistory, newUserMessage],
      });
            const newAiMessage: ChatMessage = { role: 'model', text, provider: selectedProvider };
      setChatHistory(prevChat => [...prevChat, newAiMessage]);

      // persist conversation
      if (conversation) {
        const updated: Conversation = {
          ...conversation,
          provider: selectedProvider,
          model: selectedModel,
          messages: [...chatHistory, newUserMessage, newAiMessage],
        };
        setConversation(updated);
        try {
          await saveConversation(updated);
        } catch (e) {
          console.warn('Failed to save conversation', e);
        }
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      Alert.alert('Error', `Failed to get response from Gemini: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        <ThemedView style={styles.innerContainer}>
          <ThemedView style={styles.headerContainer} />

          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {chatHistory.map((message, index) => (
              <ThemedView
                key={index}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.aiMessage,
                ]}
              >
                {message.role === 'user' ? (
                  <ThemedText style={styles.userMessageText} selectable>
                    {message.text}
                  </ThemedText>
                ) : (
                  <Markdown style={markdownStyles as any}>
                    {`**${(message.provider ?? 'AI').charAt(0).toUpperCase() + (message.provider ?? 'AI').slice(1)}:** ${message.text}`}
                  </Markdown>
                )}
              </ThemedView>
            ))}
            {isLoading && (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={primaryColor} /> {/* Use destructured primaryColor */}
                <ThemedText style={styles.loadingText}>{`${selectedProvider === 'gemini' ? 'Gemini' : selectedProvider === 'openai' ? 'OpenAI' : 'Claude'} is thinking...`}</ThemedText>
              </ThemedView>
            )}
          </ScrollView>

          <ThemedView style={styles.inputContainer}>
            <ThemedTextInput
              style={styles.chatInput}
              placeholder="Type your message..."
              value={userInput}
              onChangeText={setUserInput}
              multiline
              onSubmitEditing={handleSendMessage}
              placeholderTextColor={iconColor} // Use destructured iconColor
            />
            <ThemedButton title="Send" onPress={handleSendMessage} disabled={isLoading} />
          </ThemedView>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useThemedStyles = (bottomInset: number) => {
  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'primary');
  const textColor = useThemeColor({}, 'text');
  const secondaryBgColor = useThemeColor({}, 'secondaryBackground');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const borderColor = useThemeColor({}, 'border');
  const iconColor = useThemeColor({}, 'icon');

  // Memoize the styles object itself
  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor},
    container: { flex: 1, backgroundColor },
    innerContainer: { flex: 1, paddingTop: 15, paddingHorizontal: 15 },
    headerContainer: { marginBottom: 10 },
    title: { textAlign: 'center', marginBottom: 10 },
    input: { marginBottom: 15, color: textColor, backgroundColor, borderColor },
    chatContainer: { flex: 1, backgroundColor, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor },
    messageBubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, marginBottom: 8, maxWidth: '85%' },
    userMessage: { backgroundColor: primaryColor, alignSelf: 'flex-end' },
    aiMessage: { backgroundColor: secondaryBgColor, alignSelf: 'flex-start' },
    userMessageText: { fontSize: 16, color: buttonTextColor },
    aiMessageText: { fontSize: 16, color: textColor },
    messageRole: { fontWeight: 'bold' },
    loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    loadingText: { marginLeft: 10, fontSize: 14, color: iconColor },
    
    pickerContainer: { marginBottom: 10 },
    dropdownPicker: { backgroundColor, borderColor, borderWidth: 1, borderRadius: 8 },
    dropdownContainer: {},
    dropdownListContainer: { backgroundColor, borderColor, borderWidth: 1, borderRadius: 8 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10, paddingBottom: bottomInset, paddingHorizontal: 15, backgroundColor },
    chatInput: { flex: 1, backgroundColor, borderWidth: 1, borderColor, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginRight: 10, fontSize: 16, maxHeight: 100, color: textColor },
  }), [backgroundColor, primaryColor, textColor, secondaryBgColor, buttonTextColor, borderColor, iconColor, bottomInset]);

  // Return the styles object and the specific colors needed in GeminiChatScreen
  const markdownStyles = useMemo(() => ({
    body: { color: textColor, fontSize: 16 },
    strong: { fontWeight: 'bold' },
    code_block: { backgroundColor: secondaryBgColor, padding: 6, borderRadius: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: textColor },
    fence: { backgroundColor: secondaryBgColor, padding: 6, borderRadius: 6 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
  }), [textColor, secondaryBgColor]);

  return { styles, iconColor, primaryColor, backgroundColor, markdownStyles };
};
