import React, { useState } from 'react';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { View } from 'react-native';
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

  const providers: { label: string; value: Provider }[] = [
    { label: 'Gemini', value: 'gemini' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
  ];

  const availableModels = modelOptions[selectedProvider];

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title" style={{ marginBottom: 12 }}>Settings</ThemedText>

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
        <ThemedText onPress={() => navigation.navigate('(tabs)')} style={{ marginVertical: 8 }}>Chat</ThemedText>
        <ThemedText onPress={() => navigation.navigate('conversations')} style={{ marginVertical: 8 }}>Saved Chats</ThemedText>
        <ThemedText onPress={() => navigation.navigate('settings')} style={{ marginVertical: 8 }}>API Keys</ThemedText>
      </View>
    </ThemedView>
  );
}
