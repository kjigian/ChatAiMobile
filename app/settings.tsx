import React, { useEffect, useState, useMemo } from 'react';
import { Alert, StyleSheet, Platform, KeyboardAvoidingView, ScrollView, Vibration } from 'react-native';
import { getSecureItem, setSecureItem } from '@/utils/storage';
import { sanitizeApiKey } from '@/utils/validation';
import DropDownPicker from 'react-native-dropdown-picker';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useProviderModel } from '@/context/ProviderModelContext';
import { modelOptions, ModelOption } from '@/constants/modelOptions';
import { deleteAllConversations } from '@/utils/conversations';
import { EnhancedSettings } from '@/components/EnhancedSettings';

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
          getSecureItem('gemini_api_key'),
          getSecureItem('openai_api_key'),
          getSecureItem('anthropic_api_key'),
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
      // Validate and sanitize API keys before saving
      const keys = [
        { key: geminiKey.trim(), name: 'Gemini' },
        { key: openaiKey.trim(), name: 'OpenAI' },
        { key: anthropicKey.trim(), name: 'Anthropic' }
      ];

      const sanitizedKeys: string[] = [];
      for (const { key, name } of keys) {
        if (key) {
          const validation = sanitizeApiKey(key);
          if (!validation.isValid) {
            Alert.alert('Invalid API Key', `${name} API key is invalid: ${validation.error}`);
            return;
          }
          sanitizedKeys.push(validation.sanitized || key);
        } else {
          sanitizedKeys.push('');
        }
      }

      await Promise.all([
        setSecureItem('gemini_api_key', sanitizedKeys[0]),
        setSecureItem('openai_api_key', sanitizedKeys[1]),
        setSecureItem('anthropic_api_key', sanitizedKeys[2]),
      ]);
      Alert.alert('Saved', 'API Keys have been saved successfully.');
    } catch (e) {
      console.error('Failed to save API key', e);
      Alert.alert('Error', 'Failed to save API Key.');
    }
  };

  const handleDeleteAllChats = () => {
    // First scary warning with vibration
    Vibration.vibrate([100, 50, 100, 50, 100]);
    
    Alert.alert(
      '💀🚨 NUCLEAR OPTION ACTIVATED 🚨💀',
      'YOU ARE ABOUT TO COMMIT DATA GENOCIDE!\n\n🔥 This will OBLITERATE every single conversation\n💣 DESTROY all your precious memories\n☠️ ANNIHILATE months of chat history\n\n😱 ARE YOU ABSOLUTELY, POSITIVELY, 100% CERTAIN YOU WANT TO PROCEED WITH THIS DIGITAL ARMAGEDDON?',
      [
        {
          text: '🏃‍♂️ RUN AWAY!',
          style: 'cancel',
        },
        {
          text: '🔥 BRING THE APOCALYPSE',
          style: 'destructive',
          onPress: () => showSecondWarning(),
        },
      ],
      { cancelable: true }
    );
  };

  const showSecondWarning = () => {
    // Second warning with more vibration
    Vibration.vibrate([200, 100, 200, 100, 200]);
    
    Alert.alert(
      '😈 FINAL WARNING BEFORE DIGITAL DEATH 😈',
      'WAIT! THINK ABOUT WHAT YOU\'RE DOING!\n\n💭 Remember that funny conversation?\n🥰 That sweet AI response?\n🤓 Those brilliant insights?\n\nTHEY WILL ALL BE GONE FOREVER!\n\n🚨 LAST CHANCE TO SAVE YOUR DIGITAL SOUL! 🚨',
      [
        {
          text: '🙏 SPARE MY DATA!',
          style: 'cancel',
        },
        {
          text: '💀 EXECUTE ORDER 66',
          style: 'destructive',
          onPress: () => showFinalCountdown(),
        },
      ],
      { cancelable: false } // No backing out now!
    );
  };

  const showFinalCountdown = () => {
    // Final dramatic warning
    Vibration.vibrate([500, 200, 500, 200, 500]);
    
    Alert.alert(
      '☠️ THE POINT OF NO RETURN ☠️',
      'YOU HAVE CHOSEN... POORLY.\n\n🔥 Initiating TOTAL DATA ANNIHILATION\n💣 Preparing CONVERSATION CREMATORIUM\n⚙️ Loading MEMORY DESTRUCTION PROTOCOL\n\nPress COMMIT DIGITAL SUICIDE to finalize your doom, or FLEE FOR YOUR LIFE to escape this madness!',
      [
        {
          text: '🏃‍♀️ FLEE FOR YOUR LIFE!',
          style: 'cancel',
        },
        {
          text: '💀 COMMIT DIGITAL SUICIDE',
          style: 'destructive',
          onPress: async () => {
            try {
              Vibration.vibrate(1000); // Long scary vibration
              const deletedCount = await deleteAllConversations();
              Alert.alert(
                '☠️ MISSION ACCOMPLISHED ☠️',
                `💥 BOOM! 💥\n\nYou have successfully OBLITERATED ${deletedCount} conversation${deletedCount !== 1 ? 's' : ''}.\n\n🔥 Your digital past has been INCINERATED!\n💀 Hope you don\'t regret this...`,
                [{ text: '😭 I\'VE MADE A HUGE MISTAKE' }]
              );
            } catch (error) {
              console.error('Failed to delete conversations:', error);
              Alert.alert('😱 DESTRUCTION FAILED!', 'Even the apocalypse has bugs! Try again if you dare...');
            }
          },
        },
      ],
      { cancelable: false }
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>Settings</ThemedText>
        
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Default AI Provider</ThemedText>
          <ThemedText style={styles.label}>Provider</ThemedText>
          <DropDownPicker
            open={providerOpen}
            value={selectedProvider}
            items={providerItems}
            setOpen={setProviderOpen}
            setValue={(callback) => {
              if (typeof callback === 'function') {
                setSelectedProvider(callback(selectedProvider));
              } else {
                setSelectedProvider(callback);
              }
            }}
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
            setValue={(callback) => {
              if (typeof callback === 'function') {
                setSelectedModel(callback(selectedModel));
              } else {
                setSelectedModel(callback);
              }
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            textStyle={styles.dropdownText}
            zIndex={1000}
            zIndexInverse={2000}
          />
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Customization</ThemedText>
          <EnhancedSettings />
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
        
        <ThemedView style={styles.dangerSection}>
          <ThemedText style={styles.dangerSectionTitle}>⚠️ DANGER ZONE ⚠️</ThemedText>
          <ThemedText style={styles.warningText}>
            The following action is IRREVERSIBLE and will PERMANENTLY destroy all your data!
          </ThemedText>
          <ThemedButton 
            title="💀 NUCLEAR DELETE ALL CHATS 💀" 
            onPress={handleDeleteAllChats} 
            style={styles.nuclearDeleteButton}
          />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useThemedStyles = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor },
    scrollView: { flex: 1 },
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
    dangerSection: {
      marginBottom: 30, 
      paddingHorizontal: 20,
      backgroundColor: '#1a0000',
      borderWidth: 3,
      borderColor: '#FF0000',
      borderRadius: 15,
      marginHorizontal: 20,
      paddingVertical: 20,
      shadowColor: '#FF0000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 10,
    },
    dangerSectionTitle: {
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 15,
      color: '#FF0000',
      textAlign: 'center',
      textShadowColor: '#FF0000',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 5,
    },
    warningText: {
      fontSize: 14,
      color: '#FF6B6B',
      textAlign: 'center',
      marginBottom: 20,
      fontWeight: '600',
      lineHeight: 20,
    },
    nuclearDeleteButton: {
      backgroundColor: '#8B0000',
      alignSelf: 'center',
      paddingHorizontal: 30,
      paddingVertical: 15,
      marginHorizontal: 20,
      marginBottom: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#FF0000',
      shadowColor: '#FF0000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 15,
      elevation: 15,
    },
  }), [backgroundColor, textColor, borderColor]);

  return { styles };
};
