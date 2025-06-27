import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export interface UserPreferences {
  // Theme preferences
  theme: 'system' | 'light' | 'dark';
  accentColor: string;
  
  // Typography preferences
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  fontFamily: 'system' | 'mono' | 'serif';
  
  // Chat preferences
  bubbleStyle: 'rounded' | 'square' | 'minimal';
  showTimestamps: boolean;
  showProviderBadges: boolean;
  compactMode: boolean;
  
  // Behavior preferences
  sendOnEnter: boolean;
  autoSave: boolean;
  streamingEnabled: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  
  // Privacy preferences
  analytics: boolean;
  crashReporting: boolean;
  
  // Advanced preferences
  maxTokens: number;
  temperature: number;
  cacheEnabled: boolean;
  
  // Accessibility
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Theme
  theme: 'system',
  accentColor: '#007AFF',
  
  // Typography
  fontSize: 'medium',
  fontFamily: 'system',
  
  // Chat
  bubbleStyle: 'rounded',
  showTimestamps: false,
  showProviderBadges: true,
  compactMode: false,
  
  // Behavior
  sendOnEnter: false,
  autoSave: true,
  streamingEnabled: true,
  imageQuality: 'high',
  
  // Privacy
  analytics: false,
  crashReporting: false,
  
  // Advanced
  maxTokens: 4096,
  temperature: 0.7,
  cacheEnabled: true,
  
  // Accessibility
  highContrast: false,
  reducedMotion: false,
  screenReaderOptimized: false,
};

export const PREFERENCE_STORAGE_KEY = 'user_preferences';

export class UserPreferencesManager {
  private static cachedPreferences: UserPreferences | null = null;

  // Load preferences from storage
  static async loadPreferences(): Promise<UserPreferences> {
    try {
      if (this.cachedPreferences) {
        return this.cachedPreferences;
      }

      const stored = await AsyncStorage.getItem(PREFERENCE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new preferences
        const preferences = { ...DEFAULT_PREFERENCES, ...parsed };
        this.cachedPreferences = preferences;
        logger.log('Loaded user preferences:', Object.keys(preferences));
        return preferences;
      }

      // First time - use defaults
      this.cachedPreferences = DEFAULT_PREFERENCES;
      await this.savePreferences(DEFAULT_PREFERENCES);
      logger.log('Created default preferences');
      return DEFAULT_PREFERENCES;
    } catch (error) {
      logger.error('Failed to load preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  // Save preferences to storage
  static async savePreferences(preferences: UserPreferences): Promise<boolean> {
    try {
      await AsyncStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
      this.cachedPreferences = preferences;
      logger.log('Saved user preferences');
      return true;
    } catch (error) {
      logger.error('Failed to save preferences:', error);
      return false;
    }
  }

  // Update specific preference
  static async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<boolean> {
    try {
      const current = await this.loadPreferences();
      const updated = { ...current, [key]: value };
      return await this.savePreferences(updated);
    } catch (error) {
      logger.error('Failed to update preference:', error);
      return false;
    }
  }

  // Update multiple preferences
  static async updatePreferences(updates: Partial<UserPreferences>): Promise<boolean> {
    try {
      const current = await this.loadPreferences();
      const updated = { ...current, ...updates };
      return await this.savePreferences(updated);
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      return false;
    }
  }

  // Reset to defaults
  static async resetPreferences(): Promise<boolean> {
    try {
      this.cachedPreferences = null;
      await AsyncStorage.removeItem(PREFERENCE_STORAGE_KEY);
      return await this.savePreferences(DEFAULT_PREFERENCES);
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      return false;
    }
  }

  // Get cached preferences (synchronous)
  static getCachedPreferences(): UserPreferences {
    return this.cachedPreferences || DEFAULT_PREFERENCES;
  }

  // Validate preferences
  static validatePreferences(preferences: any): UserPreferences {
    const validated: UserPreferences = { ...DEFAULT_PREFERENCES };

    // Theme validation
    if (['system', 'light', 'dark'].includes(preferences.theme)) {
      validated.theme = preferences.theme;
    }

    // Color validation (basic hex check)
    if (typeof preferences.accentColor === 'string' && /^#[0-9A-F]{6}$/i.test(preferences.accentColor)) {
      validated.accentColor = preferences.accentColor;
    }

    // Font size validation
    if (['small', 'medium', 'large', 'xl'].includes(preferences.fontSize)) {
      validated.fontSize = preferences.fontSize;
    }

    // Font family validation
    if (['system', 'mono', 'serif'].includes(preferences.fontFamily)) {
      validated.fontFamily = preferences.fontFamily;
    }

    // Bubble style validation
    if (['rounded', 'square', 'minimal'].includes(preferences.bubbleStyle)) {
      validated.bubbleStyle = preferences.bubbleStyle;
    }

    // Image quality validation
    if (['low', 'medium', 'high'].includes(preferences.imageQuality)) {
      validated.imageQuality = preferences.imageQuality;
    }

    // Boolean preferences
    const booleanKeys: (keyof UserPreferences)[] = [
      'showTimestamps', 'showProviderBadges', 'compactMode', 'sendOnEnter',
      'autoSave', 'streamingEnabled', 'analytics', 'crashReporting',
      'highContrast', 'reducedMotion', 'screenReaderOptimized', 'cacheEnabled'
    ];

    booleanKeys.forEach(key => {
      if (typeof preferences[key] === 'boolean') {
        (validated as any)[key] = preferences[key];
      }
    });

    // Number validation
    if (typeof preferences.maxTokens === 'number' && preferences.maxTokens >= 1000 && preferences.maxTokens <= 100000) {
      validated.maxTokens = preferences.maxTokens;
    }

    if (typeof preferences.temperature === 'number' && preferences.temperature >= 0 && preferences.temperature <= 2) {
      validated.temperature = preferences.temperature;
    }

    return validated;
  }

  // Export preferences
  static async exportPreferences(): Promise<string> {
    const preferences = await this.loadPreferences();
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      preferences,
    }, null, 2);
  }

  // Import preferences
  static async importPreferences(importData: string): Promise<boolean> {
    try {
      const data = JSON.parse(importData);
      if (data.preferences) {
        const validated = this.validatePreferences(data.preferences);
        return await this.savePreferences(validated);
      }
      return false;
    } catch (error) {
      logger.error('Failed to import preferences:', error);
      return false;
    }
  }

  // Get theme-specific styles
  static getThemeStyles(preferences: UserPreferences) {
    const fontSizes = {
      small: { base: 14, title: 18, subtitle: 16 },
      medium: { base: 16, title: 20, subtitle: 18 },
      large: { base: 18, title: 22, subtitle: 20 },
      xl: { base: 20, title: 24, subtitle: 22 },
    };

    const fontFamilies = {
      system: undefined, // Use system default
      mono: 'monospace',
      serif: 'serif',
    };

    return {
      fontSize: fontSizes[preferences.fontSize],
      fontFamily: fontFamilies[preferences.fontFamily],
      accentColor: preferences.accentColor,
      bubbleStyle: preferences.bubbleStyle,
      compactMode: preferences.compactMode,
    };
  }
}