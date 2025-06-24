import React, { useEffect, useState, useMemo } from 'react';
import { Alert, StyleSheet, Platform, View, KeyboardAvoidingView } from 'react-native';
import { getItem, setItem } from '@/utils/storage';
import DropDownPicker from 'react-native-dropdown-picker';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useProviderModel } from '@/context/ProviderModelContext';
import { modelOptions, ModelOption } from '@/constants/modelOptions';
import { deleteAllConversations } from '@/utils/conversations';

export default function SettingsScreen() {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const { selectedProvider, setSelectedProvider, selectedModel, setSelectedModel } = useProviderModel();
  
  // Dropdown states
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  
  const { styles } = useThemedStyles();

  useEffect(() => {
        const loadKeys = async () => {
      try {
                        const [gKey, oKey, aKey] = await Promise.all([
          getItem('gemini_api_key'),
          getItem('openai_api_key'),
          getItem('anthropic_api_key'),
        ]);
        if (gKey) setGeminiKey(gKey);
        if (oKey) setOpenaiKey(oKey);
        if (aKey) setAnthropicKey(aKey);
      } catch (e) {
        console.error('Failed to load API key', e);
      }
    };
        loadKeys();
  }, []);

    const handleSave = async () => {
    try {
                await Promise.all([
      setItem('gemini_api_key', geminiKey.trim()),
      setItem('openai_api_key', openaiKey.trim()),
      setItem('anthropic_api_key', anthropicKey.trim()),
    ]);
          Alert.alert('Saved', 'API Keys have been saved successfully.');
    } catch (e) {
      console.error('Failed to save API key', e);
      Alert.alert('Error', 'Failed to save API Key.');
    }
  };

  const handleDeleteAllChats = () => {
    Alert.alert(
      '🚨 Delete All Chats',
      'This will permanently delete ALL your conversations. This action cannot be undone.\n\nAre you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await deleteAllConversations();
              Alert.alert(
                'Chats Deleted',
                `Successfully deleted ${deletedCount} conversation${deletedCount !== 1 ? 's' : ''}.`
              );
            } catch (error) {
              console.error('Failed to delete conversations:', error);
              Alert.alert('Error', 'Failed to delete conversations. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const providerItems = [
    { label: 'Google Gemini', value: 'gemini' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic Claude', value: 'anthropic' },
  ];

  const currentModelItems = (modelOptions[selectedProvider] || []).map((item: ModelOption) => ({
    label: item.supportsImages ? `${item.label} 📷` : item.label,
    value: item.value
  }));

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>Settings</ThemedText>
        
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Default AI Provider</ThemedText>
          <ThemedText style={styles.label}>Provider</ThemedText>
          <DropDownPicker
            open={providerOpen}
            value={selectedProvider}
            items={providerItems}
            setOpen={setProviderOpen}
            setValue={setSelectedProvider}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            textStyle={styles.dropdownText}
            zIndex={2000}
            zIndexInverse={1000}
          />
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.label}>Model</ThemedText>
          <DropDownPicker
            open={modelOpen}
            value={selectedModel}
            items={currentModelItems}
            setOpen={setModelOpen}
            setValue={setSelectedModel}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            textStyle={styles.dropdownText}
            zIndex={1000}
            zIndexInverse={2000}
          />
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>API Keys</ThemedText>
          <ThemedText style={styles.label}>Google Gemini API Key</ThemedText>
          <ThemedTextInput
            value={geminiKey}
            onChangeText={setGeminiKey}
            placeholder="Enter Google Gemini API Key"
            secureTextEntry
            style={styles.input}
          />
          <ThemedText style={styles.label}>OpenAI API Key</ThemedText>
          <ThemedTextInput
            value={openaiKey}
            onChangeText={setOpenaiKey}
            placeholder="Enter OpenAI API Key"
            secureTextEntry
            style={styles.input}
          />
          <ThemedText style={styles.label}>Anthropic API Key</ThemedText>
          <ThemedTextInput
            value={anthropicKey}
            onChangeText={setAnthropicKey}
            placeholder="Enter Anthropic API Key"
            secureTextEntry
            style={styles.input}
          />
        </ThemedView>

        <ThemedButton title="Save Settings" onPress={handleSave} style={styles.saveButton} />
        
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>
          <ThemedButton 
            title="🗑️ Delete All Chats" 
            onPress={handleDeleteAllChats} 
            style={styles.deleteButton}
          />
        </ThemedView>
      </View>
    </KeyboardAvoidingView>
  );
}

const useThemedStyles = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor },
    content: { flexGrow: 1 },
    title: { textAlign: 'center', marginBottom: 20, color: textColor, paddingHorizontal: 20, paddingTop: 20 },
    section: { marginBottom: 30, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, color: textColor },
    label: { marginBottom: 8, color: textColor, fontSize: 14, fontWeight: '500' },
    input: { marginBottom: 20, backgroundColor, borderColor, color: textColor },
    saveButton: { 
      alignSelf: 'center', 
      paddingHorizontal: 40, 
      paddingVertical: 12, 
      marginHorizontal: 20,
      marginBottom: 20,
      ...(Platform.OS === 'ios' ? {} : { marginTop: 10 }) 
    },
    dropdown: {
      backgroundColor,
      borderColor,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 15,
    },
    dropdownContainer: {
      backgroundColor,
      borderColor,
      borderWidth: 1,
      borderRadius: 8,
    },
    dropdownText: {
      color: textColor,
      fontSize: 16,
    },
    deleteButton: {
      backgroundColor: '#FF3B30',
      alignSelf: 'center',
      paddingHorizontal: 40,
      paddingVertical: 12,
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 8,
    },
  }), [backgroundColor, textColor, borderColor]);

  return { styles };
};
