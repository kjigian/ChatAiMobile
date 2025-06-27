import React, { useState } from 'react';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useProviderModel } from '@/context/ProviderModelContext';
import { modelOptions } from '@/constants/modelOptions';
import { Provider } from '@/ai/generateText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const { selectedProvider, setSelectedProvider, selectedModel, setSelectedModel } = useProviderModel();

  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');

  const providers: { label: string; value: Provider }[] = [
    { label: 'Gemini', value: 'gemini' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
  ];

  const availableModels = modelOptions[selectedProvider];

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title" style={{ marginTop: 30, marginBottom: 12 }}>Settings</ThemedText>

      {/* Provider Picker */}
      <ThemedText style={{ marginBottom: 4 }}>Provider</ThemedText>
      <DropDownPicker
        open={providerOpen}
        value={selectedProvider}
        items={providers}
        setOpen={setProviderOpen}
        setValue={(val: any) => setSelectedProvider(val as Provider)}
        placeholder="Select provider"
        style={{ backgroundColor, borderColor, borderWidth: 1, marginBottom: 12 }}
        textStyle={{ color: textColor }}
        dropDownContainerStyle={{ backgroundColor }}
        zIndex={3000}
      />

      {/* Model Picker */}
      <ThemedText style={{ marginBottom: 4 }}>Model</ThemedText>
      <DropDownPicker
        open={modelOpen}
        value={selectedModel}
        items={availableModels}
        setOpen={setModelOpen}
        setValue={(val: any) => setSelectedModel(val as string)}
        placeholder="Select model"
        style={{ backgroundColor, borderColor, borderWidth: 1, marginBottom: 12 }}
        textStyle={{ color: textColor }}
        dropDownContainerStyle={{ backgroundColor }}
        zIndex={2000}
      />

      {/* Navigation Links */}
      <View style={{ marginTop: 24 }}>
        <TouchableOpacity 
          onPress={() => {
            console.log('[Drawer] Chat pressed');
            navigation.navigate('index');
          }}
          style={[styles.navButton, { borderColor }]}
        >
          <ThemedText style={[styles.navButtonText, { color: textColor }]}>
            💬 Chat
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const ts = Date.now();
            console.log('[Drawer] New Chat pressed at', ts);
            navigation.navigate('index', { refreshTime: ts.toString() });
          }}
          style={[styles.navButton, { borderColor, backgroundColor: primaryColor + '20' }]}
        >
          <ThemedText style={[styles.navButtonText, { color: primaryColor }]}>
            ✨ New Chat
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            console.log('[Drawer] History pressed');
            navigation.navigate('conversations');
          }}
          style={[styles.navButton, { borderColor }]}
        >
          <ThemedText style={[styles.navButtonText, { color: textColor }]}>
            📚 History
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            console.log('[Drawer] Settings pressed');
            navigation.navigate('settings');
          }}
          style={[styles.navButton, { borderColor }]}
        >
          <ThemedText style={[styles.navButtonText, { color: textColor }]}>
            ⚙️ Settings
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
