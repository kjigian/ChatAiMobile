import React, { useState, useRef, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView as RNScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, View } from 'react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import DropDownPicker from 'react-native-dropdown-picker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function GeminiChatScreen() {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash-latest');
  const availableModels = [
    { label: 'Gemini 1.5 Flash (Latest)', value: 'gemini-1.5-flash-latest' },
    { label: 'Gemini 1.5 Pro (Latest)', value: 'gemini-1.5-pro-latest' },
    { label: 'Gemini 2.0 Flash (Stable)', value: 'gemini-2.0-flash-001' },
    { label: 'Gemini 2.5 Pro (Preview)', value: 'gemini-2.5-pro-preview-06-05' },
    // { label: 'OpenAI GPT-4', value: 'openai-gpt-4' }, // Example for later
  ];

  const [apiKey, setApiKey] = useState('');

  // Load API key from AsyncStorage
  useEffect(() => {
    const loadKey = async () => {
      try {
        const key = await AsyncStorage.getItem('@gemini_api_key');
        if (key) setApiKey(key);
      } catch (e) {
        console.error('Failed to load API key', e);
      }
    };
    loadKey();
  }, []);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollViewRef = useRef<RNScrollView>(null);

  // Call useThemedStyles at the top level and destructure all needed values
  const { styles, iconColor, primaryColor, backgroundColor } = useThemedStyles();

  const handleSendMessage = async () => {
    if (!apiKey.trim()) {
      Alert.alert('API Key Required', 'Please enter your Google Gemini API Key in Settings.');
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
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: selectedModel });
      const result = await model.generateContent(userInput);
      const response = result.response;
      const text = response.text();
      const newAiMessage: ChatMessage = { role: 'model', text: text };
      setChatHistory(prevChat => [...prevChat, newAiMessage]);
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ThemedView style={styles.innerContainer}>
          <ThemedView style={styles.headerContainer}>
            <ThemedText type="title" style={styles.title}>Gemini Chat</ThemedText>
            {/* Isolate the DropDownPicker in its own regular View with explicit styling */}
            <View style={[styles.pickerContainer, {backgroundColor}]}>
            <DropDownPicker
              open={open}
              value={selectedModel}
              items={availableModels}
              setOpen={setOpen}
              setValue={setSelectedModel}
              placeholder="Select a model"
              style={styles.dropdownPicker}
              containerStyle={styles.dropdownContainer}
              dropDownContainerStyle={styles.dropdownListContainer}
              zIndex={3000}
              zIndexInverse={1000}
              theme="DARK"
            />
            </View>
            
          </ThemedView>

          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={{ paddingBottom: 10, paddingTop: 10 }}
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
                <ThemedText
                  style={message.role === 'user' ? styles.userMessageText : styles.aiMessageText}
                  selectable={true}
                >
                  <ThemedText style={styles.messageRole}>{message.role === 'user' ? 'You: ' : 'Gemini: '}</ThemedText>
                  {message.text}
                </ThemedText>
              </ThemedView>
            ))}
            {isLoading && (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={primaryColor} /> {/* Use destructured primaryColor */}
                <ThemedText style={styles.loadingText}>Gemini is thinking...</ThemedText>
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

const useThemedStyles = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'primary');
  const textColor = useThemeColor({}, 'text');
  const secondaryBgColor = useThemeColor({}, 'secondaryBackground');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const borderColor = useThemeColor({}, 'border');
  const iconColor = useThemeColor({}, 'icon');

  // Memoize the styles object itself
  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor },
    container: { flex: 1, backgroundColor },
    innerContainer: { flex: 1, paddingTop: 15, paddingHorizontal: 15 },
    headerContainer: { marginBottom: 10 },
    title: { textAlign: 'center', marginBottom: 10 },
    input: { marginBottom: 15, color: textColor, backgroundColor, borderColor },
    chatContainer: { flex: 1, marginBottom: 10, backgroundColor, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor },
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
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingHorizontal: 15, backgroundColor },
    chatInput: { flex: 1, backgroundColor, borderWidth: 1, borderColor, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginRight: 10, fontSize: 16, maxHeight: 100, color: textColor },
  }), [backgroundColor, primaryColor, textColor, secondaryBgColor, buttonTextColor, borderColor, iconColor]);

  // Return the styles object and the specific colors needed in GeminiChatScreen
  return { styles, iconColor, primaryColor, backgroundColor };
};
