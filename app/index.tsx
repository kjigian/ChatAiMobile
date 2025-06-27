import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { getSecureItem } from '@/utils/storage';
import { ScrollView as RNScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, TouchableOpacity, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateText, streamText, Provider } from '@/ai/generateText';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';


import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { createNewConversationInMemory, saveConversation, saveConversationForFirstTime, loadConversation, Conversation, ChatMessage } from '@/utils/conversations';
import { useProviderModel } from '@/context/ProviderModelContext';
import { useNavigation } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { modelSupportsImages } from '@/constants/modelOptions';
import { validateAndSanitizeInput, validateImageSize } from '@/utils/validation';
import Markdown from 'react-native-markdown-display';
import { logger } from '@/utils/logger';
import { preloadCommonSDKs } from '@/utils/dynamicAI';
import { MessageReactions } from '@/components/MessageReactions';
import { FavoritesViewer } from '@/components/FavoritesViewer';
import { MessageEditor } from '@/components/MessageEditor';
import { VirtualChatList } from '@/components/VirtualChatList';
import { editMessage, deleteMessage, editMessageWithVersions, addResponseVersion, switchToMessageVersion } from '@/utils/conversations';


export default function GeminiChatScreen() {
    logger.log('[ChatScreen] Before useProviderModel hook call');
    const { selectedProvider, selectedModel } = useProviderModel();
    logger.log('[ChatScreen] After useProviderModel hook call. Provider:', selectedProvider, 'Model:', selectedModel);

  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ gemini: '', openai: '', anthropic: '' });

  // Load API keys from storage


  const loadKeys = useCallback(async () => {
    try {
      const [gKey, oKey, aKey] = await Promise.all([
        getSecureItem('gemini_api_key'),
        getSecureItem('openai_api_key'),
        getSecureItem('anthropic_api_key'),
      ]);
      setApiKeys({
        gemini: gKey ?? '',
        openai: oKey ?? '',
        anthropic: aKey ?? '',
      });
    } catch (e) {
      console.error('Failed to load API key', e);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    // Preload AI SDKs in background for better performance
    preloadCommonSDKs();
  }, [loadKeys]);
  const [userInput, setUserInput] = useState('');
  const navigation = useNavigation<any>();

  // react to route params (refreshTime or loadId) even if screen already focused
  const route = useRoute<any>();
  // Log the route parameter structure immediately after it's accessed
  logger.log('[Chat] Route object accessed - full route:', JSON.stringify(route));
  logger.log('[Chat] Route params specifically:', JSON.stringify(route.params));
  logger.log('[Chat] Route params loadId:', route.params?.loadId, 'refreshTime:', route.params?.refreshTime);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); // Re-add chatHistory
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConversationSaved, setIsConversationSaved] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);


  useEffect(() => {
    const effectLogic = async () => {
      const currentParams = (route.params as any) || {};
      // Ensure we always have default undefined for these if not present
      const refreshTime = currentParams.refreshTime;
      const loadId = currentParams.loadId;

      console.log('[Chat] Param/State useEffect. Params:', JSON.stringify(currentParams), 'Current Conversation ID:', conversation?.id);

      if (loadId) {
        console.log('[Chat] Handling loadId:', loadId, 'Current conversation ID before check:', conversation?.id, 'RefreshTime param:', refreshTime);
        
        // Skip loading if we already have this conversation loaded (unless refreshTime is set)
        if (conversation?.id === loadId && !refreshTime) {
          console.log('[Chat] Conversation already loaded, clearing params and skipping reload');
          navigation.setParams({ loadId: undefined, refreshTime: undefined });
          return;
        }
        try {
            console.log('[Chat] Loading conversation for id:', loadId);
            const conv = await loadConversation(loadId);
            if (conv) {
              console.log('[Chat] Conversation loaded:', conv.id, 'Messages count:', conv.messages?.length || 0);
              setConversation(conv);
              setIsConversationSaved(true); // Loaded conversations are already saved
              // Ensure messages is an array, fallback to empty array if undefined
              const messages = Array.isArray(conv.messages) ? conv.messages : [];
              setChatHistory(messages);
              console.log('[Chat] Chat history set with', messages.length, 'messages');
            } else {
              console.warn('[Chat] Conversation not found for loadId:', loadId, 'Creating a new one instead.');
              const newConv = createNewConversationInMemory({ provider: selectedProvider, model: selectedModel });
              setConversation(newConv);
              setIsConversationSaved(false); // New conversation not saved yet
              setChatHistory([]);
            }
        } catch (error) {
            console.error('[Chat] Error loading conversation:', error, 'Creating a new one as fallback.');
            const newConv = createNewConversationInMemory({ provider: selectedProvider, model: selectedModel });
            setConversation(newConv);
            setIsConversationSaved(false); // New conversation not saved yet
            setChatHistory([]);
        } finally {
            console.log('[Chat] Clearing loadId and refreshTime params after loadId attempt.');
            navigation.setParams({ loadId: undefined, refreshTime: undefined }); // Clear both regardless of initial state
        }
      } else if (refreshTime) {
        console.log('[Chat] Handling refreshTime:', refreshTime);
        try {
          console.log('[Chat] Creating new conversation due to refreshTime:', refreshTime, 'Provider:', selectedProvider, 'Model:', selectedModel);
          const newConv = createNewConversationInMemory({ provider: selectedProvider, model: selectedModel });
          setConversation(newConv);
          setIsConversationSaved(false); // New conversation not saved yet
          setChatHistory([]);
          console.log('[Chat] New conversation created in memory (ID:', newConv.id, '), chat history cleared.');
        } catch (error) {
          console.error('[Chat] Error during new conversation creation (refreshTime):', error);
        } finally {
            console.log('[Chat] Clearing refreshTime param after refresh attempt (also loadId if it was present).');
            navigation.setParams({ loadId: undefined, refreshTime: undefined });
        }
      } else if (!conversation) {
        // Initial mount without specific load/refresh params, and no conversation exists yet
        console.log('[Chat] Initializing: No active params, no existing conversation. Creating new one.');
        try {
            const newConv = createNewConversationInMemory({ provider: selectedProvider, model: selectedModel });
            setConversation(newConv);
            setIsConversationSaved(false); // New conversation not saved yet
            setChatHistory([]);
            console.log('[Chat] Initial new conversation created in memory (ID:', newConv.id, ')');
        } catch (error) {
            console.error('[Chat] Error creating initial new conversation:', error);
        }
      } else {
        // This case means params are clear (or were never set) and a conversation already exists.
        // Or, params were set, handled, and cleared, and this is a subsequent run of the effect.
        console.log('[Chat] Param/State useEffect: No specific action needed (params clear or conversation exists).');
      }
    };

    effectLogic().catch(err => {
      console.error("[Chat] Unhandled error in Param/State useEffect:", err);
      // Attempt to clear params to prevent potential loops if error is param-related
      const currentParams = (route.params as any) || {};
      if (currentParams.loadId || currentParams.refreshTime) {
          try {
            navigation.setParams({ loadId: undefined, refreshTime: undefined });
          } catch (navError) {
            console.error("[Chat] Error clearing params in top-level error handler:", navError);
          }
      }
    });
  }, [route.params, navigation, selectedProvider, selectedModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // Scroll to bottom when keyboard appears
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Keyboard hidden
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [useStreaming] = useState(true); // Re-enabled with fallback
  const [, setStreamingMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ index: number; message: ChatMessage } | null>(null);


    const insets = useSafeAreaInsets();
  // Call useThemedStyles at the top level and destructure all needed values
  const { styles, iconColor, primaryColor, markdownStyles } = useThemedStyles(insets.bottom);

    const currentApiKey = apiKeys[selectedProvider] ?? '';
  const currentModelSupportsImages = modelSupportsImages(selectedProvider, selectedModel);

  const pickImage = async () => {
    try {
      // Request media library permissions first
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!mediaLibraryPermission.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'Please allow photo library access in Settings to select photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to access photo library');
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions first
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!cameraPermission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in Settings to take photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: false,
        exif: false,
        cameraType: 'back',
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to access camera');
    }
  };

  const showImagePicker = () => {
    if (!currentModelSupportsImages) {
      Alert.alert(
        'Model Not Supported',
        `The current model (${selectedModel}) does not support image inputs. Please switch to a vision-capable model in Settings.`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
      return;
    }
    
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Handle reaction updates by reloading conversation
  const handleReactionUpdate = useCallback(async () => {
    if (conversation?.id && isConversationSaved) {
      try {
        const updated = await loadConversation(conversation.id);
        if (updated) {
          setConversation(updated);
          setChatHistory(updated.messages || []);
        }
      } catch (error) {
        console.error('Failed to reload conversation after reaction update:', error);
      }
    }
  }, [conversation?.id, isConversationSaved]);

  // Handle version switching
  const handleVersionSwitch = useCallback(async (messageIndex: number, versionNumber: number) => {
    if (!conversation?.id) return;

    try {
      const success = await switchToMessageVersion(conversation.id, messageIndex, versionNumber);
      if (success) {
        // Reload the conversation to get updated state
        const updated = await loadConversation(conversation.id);
        if (updated) {
          setConversation(updated);
          setChatHistory(updated.messages || []);
        }
      } else {
        throw new Error('Failed to switch version');
      }
    } catch (error) {
      console.error('Failed to switch message version:', error);
      Alert.alert('Error', 'Failed to switch to selected version');
    }
  }, [conversation?.id]);

  const handleEditMessage = useCallback((index: number, message: ChatMessage) => {
    setEditingMessage({ index, message });
  }, []);

  const handleDeleteMessage = useCallback(async (index: number) => {
    if (!conversation?.id) return;

    try {
      const success = await deleteMessage(conversation.id, index);
      if (success) {
        await handleReactionUpdate();
      } else {
        Alert.alert('Error', 'Failed to delete message');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  }, [conversation?.id, handleReactionUpdate]);

  const handleSaveEditedMessage = useCallback(async (newText: string) => {
    if (!conversation?.id || !editingMessage) return;

    try {
      // Use versioned editing instead of simple edit
      const success = await editMessageWithVersions(conversation.id, editingMessage.index, newText);
      if (success) {
        // Reload the conversation to get updated state
        const updatedConversation = await loadConversation(conversation.id);
        if (updatedConversation) {
          setConversation(updatedConversation);
          setChatHistory(updatedConversation.messages || []);
          
          // If we edited a user message, generate a new AI response version
          if (editingMessage.message.role === 'user') {
            // Find the next AI message after the edited user message
            const nextMessageIndex = editingMessage.index + 1;
            if (nextMessageIndex < updatedConversation.messages.length && 
                updatedConversation.messages[nextMessageIndex].role === 'model') {
              
              // Generate new AI response for the edited user message
              await generateNewResponseVersion(updatedConversation.messages, editingMessage.index, nextMessageIndex);
            } else {
              // No AI response exists yet, generate a new one
              await generateNewResponseFromEdit(updatedConversation.messages.slice(0, editingMessage.index + 1));
            }
          }
        }
        setEditingMessage(null);
      } else {
        throw new Error('Failed to save message');
      }
    } catch (error) {
      console.error('Failed to save edited message:', error);
      throw error;
    }
  }, [conversation?.id, editingMessage, loadConversation]);

  const generateNewResponseFromEdit = useCallback(async (messagesUpToEdit: ChatMessage[]) => {
    if (!currentApiKey.trim() || !conversation?.id) return;

    setIsLoading(true);
    
    try {
      const lastUserMessage = messagesUpToEdit[messagesUpToEdit.length - 1];
      const historyForAI = messagesUpToEdit.slice(0, -1); // All messages except the last (edited) user message
      
      if (useStreaming) {
        // Streaming mode
        setStreamingMessage('');
        const newAiMessage: ChatMessage = { role: 'model', text: '', provider: selectedProvider };
        setChatHistory(prevChat => [...prevChat, newAiMessage]);
        
        await streamText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: lastUserMessage.text,
          image: lastUserMessage.image,
          apiKey: currentApiKey,
          history: historyForAI,
          onChunk: (chunk: string) => {
            setStreamingMessage(prev => prev + chunk);
            setChatHistory(prevChat => {
              const updated = [...prevChat];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage && lastMessage.role === 'model') {
                lastMessage.text += chunk;
              }
              return updated;
            });
          },
          onComplete: async () => {
            setStreamingMessage('');
            setIsLoading(false);
            
            // Save conversation with new AI response
            if (conversation) {
              setChatHistory(currentHistory => {
                const allMessages = [...currentHistory];
                const updated: Conversation = {
                  ...conversation,
                  provider: selectedProvider,
                  model: selectedModel,
                  messages: allMessages,
                  updatedAt: new Date().toISOString(),
                };
                setConversation(updated);
                saveConversation(updated).catch(e => {
                  console.warn('Failed to save conversation after edit', e);
                });
                return allMessages;
              });
            }
          },
          onError: (error: Error) => {
            console.error('Streaming API Error after edit:', error);
            console.log('Falling back to non-streaming mode...');
            setIsLoading(false);
            setStreamingMessage('');
            
            // Fallback to non-streaming mode
            generateText({
              provider: selectedProvider,
              model: selectedModel,
              prompt: lastUserMessage.text,
              image: lastUserMessage.image,
              apiKey: currentApiKey,
              history: historyForAI,
            }).then(text => {
              const newAiMessage: ChatMessage = { role: 'model', text, provider: selectedProvider };
              setChatHistory(prevChat => {
                const updated = [...prevChat];
                updated[updated.length - 1] = newAiMessage;
                return updated;
              });
              
              // Save conversation
              if (conversation) {
                const updated: Conversation = {
                  ...conversation,
                  provider: selectedProvider,
                  model: selectedModel,
                  messages: [...messagesUpToEdit, newAiMessage],
                  updatedAt: new Date().toISOString(),
                };
                setConversation(updated);
                saveConversation(updated).catch(e => {
                  console.warn('Failed to save conversation after edit fallback', e);
                });
              }
            }).catch(fallbackError => {
              console.error('Fallback also failed after edit:', fallbackError);
              Alert.alert('Error', `Failed to get response: ${fallbackError.message}`);
            });
          }
        });
      } else {
        // Non-streaming mode
        const text = await generateText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: lastUserMessage.text,
          image: lastUserMessage.image,
          apiKey: currentApiKey,
          history: historyForAI,
        });
        
        const newAiMessage: ChatMessage = { role: 'model', text, provider: selectedProvider };
        setChatHistory(prevChat => [...prevChat, newAiMessage]);
        setIsLoading(false);
        
        // Save conversation
        if (conversation) {
          const updated: Conversation = {
            ...conversation,
            provider: selectedProvider,
            model: selectedModel,
            messages: [...messagesUpToEdit, newAiMessage],
            updatedAt: new Date().toISOString(),
          };
          setConversation(updated);
          await saveConversation(updated);
        }
      }
    } catch (error) {
      console.error('Failed to generate response after edit:', error);
      Alert.alert('Error', `Failed to get response: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  }, [currentApiKey, conversation, selectedProvider, selectedModel, useStreaming, setStreamingMessage]);

  const generateNewResponseVersion = useCallback(async (messages: ChatMessage[], userMessageIndex: number, aiMessageIndex: number) => {
    if (!currentApiKey.trim() || !conversation?.id) return;

    setIsLoading(true);
    
    try {
      const userMessage = messages[userMessageIndex];
      const historyForAI = messages.slice(0, userMessageIndex); // Messages before the edited user message
      
      // Get the active version number from the user message to correlate with AI response
      const activeVersion = userMessage.versions?.find(v => v.isActive);
      const correlatedVersionNumber = activeVersion?.version || 1;
      
      if (useStreaming) {
        // Streaming mode - collect response text
        let responseText = '';
        
        await streamText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: userMessage.text,
          image: userMessage.image,
          apiKey: currentApiKey,
          history: historyForAI,
          onChunk: (chunk: string) => {
            responseText += chunk;
            setStreamingMessage(prev => prev + chunk);
          },
          onComplete: async () => {
            setStreamingMessage('');
            setIsLoading(false);
            
            // Add new version to the AI message with correlated version number
            await addResponseVersion(conversation.id, aiMessageIndex, responseText, selectedProvider, correlatedVersionNumber);
            
            // Reload conversation to show new version
            const updated = await loadConversation(conversation.id);
            if (updated) {
              setConversation(updated);
              setChatHistory(updated.messages || []);
            }
          },
          onError: async (error: Error) => {
            console.error('Streaming API Error for version:', error);
            setIsLoading(false);
            setStreamingMessage('');
            
            // Fallback to non-streaming
            try {
              const text = await generateText({
                provider: selectedProvider,
                model: selectedModel,
                prompt: userMessage.text,
                image: userMessage.image,
                apiKey: currentApiKey,
                history: historyForAI,
              });
              
              await addResponseVersion(conversation.id, aiMessageIndex, text, selectedProvider, correlatedVersionNumber);
              
              const updated = await loadConversation(conversation.id);
              if (updated) {
                setConversation(updated);
                setChatHistory(updated.messages || []);
              }
            } catch (fallbackError) {
              console.error('Fallback also failed for version:', fallbackError);
              Alert.alert('Error', `Failed to get response: ${fallbackError.message}`);
            }
          }
        });
      } else {
        // Non-streaming mode
        const text = await generateText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: userMessage.text,
          image: userMessage.image,
          apiKey: currentApiKey,
          history: historyForAI,
        });
        
        await addResponseVersion(conversation.id, aiMessageIndex, text, selectedProvider, correlatedVersionNumber);
        setIsLoading(false);
        
        // Reload conversation to show new version
        const updated = await loadConversation(conversation.id);
        if (updated) {
          setConversation(updated);
          setChatHistory(updated.messages || []);
        }
      }
    } catch (error) {
      console.error('Failed to generate response version:', error);
      Alert.alert('Error', `Failed to get response: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  }, [currentApiKey, conversation, selectedProvider, selectedModel, useStreaming, setStreamingMessage]);

  const handleDeleteEditingMessage = useCallback(async () => {
    if (!editingMessage) return;
    
    try {
      await handleDeleteMessage(editingMessage.index);
      setEditingMessage(null);
    } catch (error) {
      console.error('Failed to delete message from editor:', error);
      throw error;
    }
  }, [editingMessage, handleDeleteMessage]);

  const handleSendMessage = async () => {
        if (!currentApiKey.trim()) {
            Alert.alert('API Key Required', `Please enter your ${selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key in Settings.`);
      return;
    }

    // Validate and sanitize user input
    const validation = validateAndSanitizeInput(userInput);
    if (!validation.isValid) {
      Alert.alert('Invalid Input', validation.error || 'Please enter a valid message.');
      return;
    }

    // Validate image if present
    if (selectedImage?.base64) {
      const imageValidation = validateImageSize(selectedImage.base64);
      if (!imageValidation.isValid) {
        Alert.alert('Invalid Image', imageValidation.error || 'Image is too large.');
        return;
      }
    }

    setIsLoading(true);
    const imageData = selectedImage ? {
      uri: selectedImage.uri,
      base64: selectedImage.base64,
      mimeType: selectedImage.mimeType || 'image/jpeg'
    } : undefined;
    
    const newUserMessage: ChatMessage = { 
      role: 'user', 
      text: validation.sanitized || userInput,
      image: imageData
    };
    setChatHistory(prevChat => [...prevChat, newUserMessage]);
    setUserInput('');
    setSelectedImage(null);

    try {
      if (useStreaming) {
        // Streaming mode
        setStreamingMessage('');
        const newAiMessage: ChatMessage = { role: 'model', text: '', provider: selectedProvider };
        setChatHistory(prevChat => [...prevChat, newAiMessage]);
        
        await streamText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: validation.sanitized || userInput,
          image: imageData,
          apiKey: currentApiKey,
          history: [...chatHistory, newUserMessage],
          onChunk: (chunk: string) => {
            setStreamingMessage(prev => prev + chunk);
            setChatHistory(prevChat => {
              const updated = [...prevChat];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage && lastMessage.role === 'model') {
                lastMessage.text += chunk;
              }
              return updated;
            });
          },
          onComplete: async () => {
            setStreamingMessage('');
            setIsLoading(false);
            
            // Save conversation for streaming mode - include both user and AI messages
            if (conversation) {
              setChatHistory(currentHistory => {
                const allMessages = [...currentHistory]; // This includes the AI message that was being streamed
                const updated: Conversation = {
                  ...conversation,
                  provider: selectedProvider,
                  model: selectedModel,
                  messages: allMessages,
                };
                setConversation(updated);
                if (!isConversationSaved) {
                  // First time saving this conversation
                  saveConversationForFirstTime(updated).then(() => {
                    setIsConversationSaved(true);
                  }).catch(e => {
                    console.warn('Failed to save conversation for first time', e);
                  });
                } else {
                  // Update existing conversation
                  saveConversation(updated).catch(e => {
                    console.warn('Failed to save conversation', e);
                  });
                }
                return allMessages;
              });
            }
          },
          onError: (error: Error) => {
            console.error('Streaming API Error:', error);
            console.log('Falling back to non-streaming mode...');
            setIsLoading(false);
            setStreamingMessage('');
            
            // Fallback to non-streaming mode
            generateText({
              provider: selectedProvider,
              model: selectedModel,
              prompt: validation.sanitized || userInput,
              image: imageData,
              apiKey: currentApiKey,
              history: [...chatHistory, newUserMessage],
            }).then(text => {
              const newAiMessage: ChatMessage = { role: 'model', text, provider: selectedProvider };
              setChatHistory(prevChat => {
                const updated = [...prevChat];
                updated[updated.length - 1] = newAiMessage; // Replace the empty AI message
                return updated;
              });
              
              // Save conversation
              if (conversation) {
                const updated: Conversation = {
                  ...conversation,
                  provider: selectedProvider,
                  model: selectedModel,
                  messages: [...chatHistory, newUserMessage, newAiMessage],
                };
                setConversation(updated);
                if (!isConversationSaved) {
                  // First time saving this conversation
                  saveConversationForFirstTime(updated).then(() => {
                    setIsConversationSaved(true);
                  }).catch(e => {
                    console.warn('Failed to save conversation for first time', e);
                  });
                } else {
                  // Update existing conversation
                  saveConversation(updated).catch(e => {
                    console.warn('Failed to save conversation', e);
                  });
                }
              }
            }).catch(fallbackError => {
              console.error('Fallback also failed:', fallbackError);
              Alert.alert('Error', `Failed to get response: ${fallbackError.message}`);
            });
          }
        });
      } else {
        // Non-streaming mode (original)
        const text = await generateText({
          provider: selectedProvider,
          model: selectedModel,
          prompt: validation.sanitized || userInput,
          image: imageData,
          apiKey: currentApiKey,
          history: [...chatHistory, newUserMessage],
        });
        const newAiMessage: ChatMessage = { role: 'model', text, provider: selectedProvider };
        setChatHistory(prevChat => [...prevChat, newAiMessage]);
        setIsLoading(false);
      }

      // persist conversation (only for non-streaming mode, streaming handles it in onComplete)
      if (!useStreaming && conversation) {
        const updated: Conversation = {
          ...conversation,
          provider: selectedProvider,
          model: selectedModel,
          messages: [...(conversation.messages ?? []), newUserMessage, { role: 'model', text, provider: selectedProvider }],
        };
        setConversation(updated);
        try {
          if (!isConversationSaved) {
            // First time saving this conversation
            await saveConversationForFirstTime(updated);
            setIsConversationSaved(true);
          } else {
            // Update existing conversation
            await saveConversation(updated);
          }
        } catch (e) {
          console.warn('Failed to save conversation', e);
        }
      }
    } catch (error) {
      if (!useStreaming) {
        console.error('API Error:', error);
        Alert.alert('Error', `Failed to get response: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ThemedView style={styles.innerContainer}>
        <ThemedView style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.favoritesButton}
            onPress={() => setShowFavorites(true)}
          >
            <ThemedText style={styles.favoritesButtonText}>⭐ Favorites</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Virtual Chat List */}
        <VirtualChatList
          messages={chatHistory}
          markdownStyles={markdownStyles}
          style={styles.chatContainer}
          scrollToEnd={true}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          conversationId={conversation?.id}
          isConversationSaved={isConversationSaved}
          onReactionUpdate={handleReactionUpdate}
          onVersionSwitch={handleVersionSwitch}
        />

        {/* Loading indicator */}
        {isLoading && (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={primaryColor} />
            <ThemedText style={styles.loadingText}>
              {`${selectedProvider === 'gemini' ? 'Gemini' : selectedProvider === 'openai' ? 'OpenAI' : 'Claude'} is thinking...`}
            </ThemedText>
          </ThemedView>
        )}

          {/* Favorites Viewer Modal */}
          <FavoritesViewer
            visible={showFavorites}
            onClose={() => setShowFavorites(false)}
          />

          {/* Message Editor Modal */}
          <MessageEditor
            visible={!!editingMessage}
            message={editingMessage?.message || null}
            onClose={() => setEditingMessage(null)}
            onSave={handleSaveEditedMessage}
            onDelete={handleDeleteEditingMessage}
          />

          <ThemedView style={styles.inputContainer}>
            {selectedImage && (
              <ThemedView style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <ThemedText style={styles.removeImageText}>×</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}
            <ThemedView style={styles.inputRow}>
              <TouchableOpacity 
                style={[styles.imageButton, !currentModelSupportsImages && styles.imageButtonDisabled]} 
                onPress={showImagePicker}
              >
                <ThemedText style={styles.imageButtonText}>📷</ThemedText>
              </TouchableOpacity>
              <ThemedTextInput
                style={styles.chatInput}
                placeholder="Type your message..."
                value={userInput}
                onChangeText={(text) => {
                  setUserInput(text);
                  // Scroll to bottom when user starts typing
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                multiline
                onSubmitEditing={handleSendMessage}
                onFocus={() => {
                  // Scroll to bottom when input is focused
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                placeholderTextColor={iconColor} // Use destructured iconColor
                blurOnSubmit={false}
                returnKeyType="send"
              />
              <ThemedButton title="Send" onPress={handleSendMessage} disabled={isLoading} />
            </ThemedView>
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
    innerContainer: { flex: 1, paddingTop: 15 },
    headerContainer: { 
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingHorizontal: 15,
    },
    favoritesButton: {
      backgroundColor: primaryColor,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      alignSelf: 'flex-start',
    },
    favoritesButtonText: {
      color: buttonTextColor,
      fontSize: 14,
      fontWeight: '600',
    },
    title: { textAlign: 'center', marginBottom: 10 },
    input: { marginBottom: 15, color: textColor, backgroundColor, borderColor },
    chatContainer: { flex: 1, backgroundColor, borderRadius: 8, paddingHorizontal: 8, borderWidth: 1, borderColor, marginHorizontal: 8 },
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
    inputContainer: { borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10, paddingBottom: Math.max(bottomInset, 10), paddingHorizontal: 15, backgroundColor },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    chatInput: { flex: 1, backgroundColor, borderWidth: 1, borderColor, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginRight: 10, fontSize: 16, maxHeight: 100, color: textColor },
    imageButton: { backgroundColor: primaryColor, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    imageButtonText: { fontSize: 20, color: buttonTextColor },
    imagePreviewContainer: { position: 'relative', marginBottom: 10 },
    imagePreview: { width: 100, height: 100, borderRadius: 8 },
    removeImageButton: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
    removeImageText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    messageImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 5 },
    imageButtonDisabled: { backgroundColor: borderColor, opacity: 0.5 },
  }), [backgroundColor, primaryColor, textColor, secondaryBgColor, buttonTextColor, borderColor, iconColor, bottomInset]);

  // Return the styles object and the specific colors needed in GeminiChatScreen
  const markdownStyles = useMemo(() => ({
    body: { color: textColor, fontSize: 16, width: '100%', flexShrink: 1 },
    strong: { fontWeight: 'bold' },
    code_block: { backgroundColor: secondaryBgColor, padding: 6, borderRadius: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: textColor },
    fence: { backgroundColor: secondaryBgColor, padding: 6, borderRadius: 6 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    paragraph: { marginVertical: 2, width: '100%', flexShrink: 1 },
    text: { width: '100%', flexShrink: 1 },
  }), [textColor, secondaryBgColor]);

  return { styles, iconColor, primaryColor, markdownStyles };
};
