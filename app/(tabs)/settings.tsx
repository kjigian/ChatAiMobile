import React, { useEffect, useState, useMemo } from 'react';
import { Alert, StyleSheet, Platform } from 'react-native';
import { getItem, setItem } from '@/utils/storage';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function SettingsScreen() {
      const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
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

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Settings</ThemedText>
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
      <ThemedButton title="Save" onPress={handleSave} style={styles.saveButton} />
    </ThemedView>
  );
}

const useThemedStyles = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor },
    title: { textAlign: 'center', marginBottom: 20, color: textColor },
    label: { marginBottom: 8, color: textColor },
    input: { marginBottom: 20, backgroundColor, borderColor, color: textColor },
    saveButton: { alignSelf: 'center', paddingHorizontal: 40, paddingVertical: 12, ...(Platform.OS === 'ios' ? {} : { marginTop: 10 }) },
  }), [backgroundColor, textColor, primaryColor, borderColor]);

  return { styles };
};
