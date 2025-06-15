import React, { useEffect, useState, useMemo } from 'react';
import { Alert, StyleSheet, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const { styles } = useThemedStyles();

  useEffect(() => {
    const loadKey = async () => {
      try {
        const key = await SecureStore.getItemAsync('gemini_api_key');
        if (key) setApiKey(key);
      } catch (e) {
        console.error('Failed to load API key', e);
      }
    };
    loadKey();
  }, []);

  const handleSave = async () => {
    try {
      await SecureStore.setItemAsync('gemini_api_key', apiKey.trim());
      Alert.alert('Saved', 'API Key has been saved successfully.');
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
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="Enter Google Gemini API Key"
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
