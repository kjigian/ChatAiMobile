import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { UserPreferences, UserPreferencesManager, DEFAULT_PREFERENCES } from '@/utils/userPreferences';
import DropDownPicker from 'react-native-dropdown-picker';

interface EnhancedSettingsProps {
  onPreferencesChange?: (preferences: UserPreferences) => void;
}

interface DropdownState {
  theme: boolean;
  fontSize: boolean;
  fontFamily: boolean;
  bubbleStyle: boolean;
  imageQuality: boolean;
}

export const EnhancedSettings = React.memo<EnhancedSettingsProps>(({ onPreferencesChange }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [dropdownOpen, setDropdownOpen] = useState<DropdownState>({
    theme: false,
    fontSize: false,
    fontFamily: false,
    bubbleStyle: false,
    imageQuality: false,
  });

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  // Load preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      const prefs = await UserPreferencesManager.loadPreferences();
      setPreferences(prefs);
    };
    loadPrefs();
  }, []);

  // Update preference helper
  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const success = await UserPreferencesManager.updatePreference(key, value);
    if (success) {
      const updatedPrefs = { ...preferences, [key]: value };
      setPreferences(updatedPrefs);
      onPreferencesChange?.(updatedPrefs);
    }
  }, [preferences, onPreferencesChange]);

  // Reset preferences
  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Preferences',
      'This will reset all preferences to their default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const success = await UserPreferencesManager.resetPreferences();
            if (success) {
              setPreferences(DEFAULT_PREFERENCES);
              onPreferencesChange?.(DEFAULT_PREFERENCES);
              Alert.alert('Reset Complete', 'All preferences have been reset to defaults.');
            }
          },
        },
      ]
    );
  }, [onPreferencesChange]);

  // Export preferences
  const handleExport = useCallback(async () => {
    const exportData = await UserPreferencesManager.exportPreferences();
    Alert.alert(
      'Export Preferences',
      'Your preferences have been exported. Copy the data below:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Show Data',
          onPress: () => {
            Alert.alert('Preferences Export', exportData.substring(0, 500) + '...');
          },
        },
      ]
    );
  }, []);

  // Import preferences
  const handleImport = useCallback(() => {
    Alert.prompt(
      'Import Preferences',
      'Paste your exported preferences data:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async (data) => {
            if (data) {
              const success = await UserPreferencesManager.importPreferences(data);
              if (success) {
                const newPrefs = await UserPreferencesManager.loadPreferences();
                setPreferences(newPrefs);
                onPreferencesChange?.(newPrefs);
                Alert.alert('Import Successful', 'Your preferences have been imported.');
              } else {
                Alert.alert('Import Failed', 'Invalid preferences data.');
              }
            }
          },
        },
      ],
      'plain-text'
    );
  }, [onPreferencesChange]);

  // Dropdown items
  const themeItems = [
    { label: 'System', value: 'system' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  const fontSizeItems = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
    { label: 'Extra Large', value: 'xl' },
  ];

  const fontFamilyItems = [
    { label: 'System', value: 'system' },
    { label: 'Monospace', value: 'mono' },
    { label: 'Serif', value: 'serif' },
  ];

  const bubbleStyleItems = [
    { label: 'Rounded', value: 'rounded' },
    { label: 'Square', value: 'square' },
    { label: 'Minimal', value: 'minimal' },
  ];

  const imageQualityItems = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    settingLabel: {
      fontSize: 16,
      color: textColor,
      flex: 1,
    },
    settingDescription: {
      fontSize: 14,
      color: textColor,
      opacity: 0.7,
      marginTop: 4,
    },
    dropdown: {
      backgroundColor: secondaryColor,
      borderColor,
      borderWidth: 1,
      borderRadius: 8,
      minHeight: 40,
      width: 150,
    },
    dropdownContainer: {
      backgroundColor: secondaryColor,
      borderColor,
    },
    sliderContainer: {
      width: 150,
      alignItems: 'center',
    },
    sliderValue: {
      fontSize: 14,
      color: primaryColor,
      fontWeight: '500',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 16,
      paddingVertical: 20,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    preview: {
      backgroundColor: secondaryColor,
      padding: 16,
      borderRadius: 8,
      marginTop: 8,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
    },
    previewBubble: {
      backgroundColor: primaryColor,
      padding: 12,
      borderRadius: preferences.bubbleStyle === 'rounded' ? 16 : preferences.bubbleStyle === 'square' ? 4 : 8,
      marginBottom: 8,
      alignSelf: 'flex-end',
      maxWidth: '80%',
    },
    previewText: {
      color: 'white',
      fontSize: preferences.fontSize === 'small' ? 14 : preferences.fontSize === 'medium' ? 16 : preferences.fontSize === 'large' ? 18 : 20,
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Theme Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>🎨 Appearance</ThemedText>
        
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Theme</ThemedText>
            <ThemedText style={styles.settingDescription}>Choose your preferred color scheme</ThemedText>
          </View>
          <DropDownPicker
            open={dropdownOpen.theme}
            value={preferences.theme}
            items={themeItems}
            setOpen={(open) => setDropdownOpen(prev => ({ ...prev, theme: open }))}
            setValue={(callback) => {
              const value = typeof callback === 'function' ? callback(preferences.theme) : callback;
              updatePreference('theme', value);
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={5000}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Font Size</ThemedText>
            <ThemedText style={styles.settingDescription}>Adjust text size throughout the app</ThemedText>
          </View>
          <DropDownPicker
            open={dropdownOpen.fontSize}
            value={preferences.fontSize}
            items={fontSizeItems}
            setOpen={(open) => setDropdownOpen(prev => ({ ...prev, fontSize: open }))}
            setValue={(callback) => {
              const value = typeof callback === 'function' ? callback(preferences.fontSize) : callback;
              updatePreference('fontSize', value);
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={4000}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Font Family</ThemedText>
            <ThemedText style={styles.settingDescription}>Choose your preferred font</ThemedText>
          </View>
          <DropDownPicker
            open={dropdownOpen.fontFamily}
            value={preferences.fontFamily}
            items={fontFamilyItems}
            setOpen={(open) => setDropdownOpen(prev => ({ ...prev, fontFamily: open }))}
            setValue={(callback) => {
              const value = typeof callback === 'function' ? callback(preferences.fontFamily) : callback;
              updatePreference('fontFamily', value);
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={3000}
          />
        </View>
      </View>

      {/* Chat Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>💬 Chat Interface</ThemedText>
        
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Bubble Style</ThemedText>
            <ThemedText style={styles.settingDescription}>Message bubble appearance</ThemedText>
          </View>
          <DropDownPicker
            open={dropdownOpen.bubbleStyle}
            value={preferences.bubbleStyle}
            items={bubbleStyleItems}
            setOpen={(open) => setDropdownOpen(prev => ({ ...prev, bubbleStyle: open }))}
            setValue={(callback) => {
              const value = typeof callback === 'function' ? callback(preferences.bubbleStyle) : callback;
              updatePreference('bubbleStyle', value);
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={2000}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Show Timestamps</ThemedText>
            <ThemedText style={styles.settingDescription}>Display message timestamps</ThemedText>
          </View>
          <Switch
            value={preferences.showTimestamps}
            onValueChange={(value) => updatePreference('showTimestamps', value)}
            trackColor={{ false: borderColor, true: primaryColor }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Provider Badges</ThemedText>
            <ThemedText style={styles.settingDescription}>Show AI provider names on messages</ThemedText>
          </View>
          <Switch
            value={preferences.showProviderBadges}
            onValueChange={(value) => updatePreference('showProviderBadges', value)}
            trackColor={{ false: borderColor, true: primaryColor }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Compact Mode</ThemedText>
            <ThemedText style={styles.settingDescription}>Reduce spacing for more content</ThemedText>
          </View>
          <Switch
            value={preferences.compactMode}
            onValueChange={(value) => updatePreference('compactMode', value)}
            trackColor={{ false: borderColor, true: primaryColor }}
          />
        </View>
      </View>

      {/* Behavior Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>⚙️ Behavior</ThemedText>
        
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Streaming</ThemedText>
            <ThemedText style={styles.settingDescription}>Show responses as they generate</ThemedText>
          </View>
          <Switch
            value={preferences.streamingEnabled}
            onValueChange={(value) => updatePreference('streamingEnabled', value)}
            trackColor={{ false: borderColor, true: primaryColor }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Auto Save</ThemedText>
            <ThemedText style={styles.settingDescription}>Automatically save conversations</ThemedText>
          </View>
          <Switch
            value={preferences.autoSave}
            onValueChange={(value) => updatePreference('autoSave', value)}
            trackColor={{ false: borderColor, true: primaryColor }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.settingLabel}>Image Quality</ThemedText>
            <ThemedText style={styles.settingDescription}>Quality for image uploads</ThemedText>
          </View>
          <DropDownPicker
            open={dropdownOpen.imageQuality}
            value={preferences.imageQuality}
            items={imageQualityItems}
            setOpen={(open) => setDropdownOpen(prev => ({ ...prev, imageQuality: open }))}
            setValue={(callback) => {
              const value = typeof callback === 'function' ? callback(preferences.imageQuality) : callback;
              updatePreference('imageQuality', value);
            }}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={1000}
          />
        </View>
      </View>

      {/* Preview Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>👀 Preview</ThemedText>
        <View style={styles.preview}>
          <ThemedText style={styles.previewTitle}>Message Preview</ThemedText>
          <View style={styles.previewBubble}>
            <ThemedText style={styles.previewText}>
              This is how your messages will look with current settings.
            </ThemedText>
          </View>
          {preferences.showTimestamps && (
            <ThemedText style={[styles.settingDescription, { textAlign: 'right', marginTop: 4 }]}>
              {new Date().toLocaleTimeString()}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <ThemedButton title="Reset" onPress={handleReset} style={styles.actionButton} />
        <ThemedButton title="Export" onPress={handleExport} style={styles.actionButton} />
        <ThemedButton title="Import" onPress={handleImport} style={styles.actionButton} />
      </View>
    </ScrollView>
  );
});

EnhancedSettings.displayName = 'EnhancedSettings';

export default EnhancedSettings;