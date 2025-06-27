import * as ImagePicker from 'expo-image-picker';
import { logger } from './logger';

interface OptimizedImageResult {
  uri: string;
  base64?: string;
  mimeType?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

export class ImageOptimizer {
  // Default settings optimized for AI models
  private static readonly DEFAULT_SETTINGS = {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
    format: 'jpeg' as const,
    compressFormat: ImagePicker.ImageFormat.JPEG,
  };

  // Provider-specific optimizations
  private static readonly PROVIDER_SETTINGS = {
    openai: {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.9,
    },
    anthropic: {
      maxWidth: 1568,
      maxHeight: 1568,
      quality: 0.85,
    },
    gemini: {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.8,
    },
  };

  // Optimize image for specific AI provider
  static async optimizeForProvider(
    imageAsset: ImagePicker.ImagePickerAsset,
    provider: 'openai' | 'anthropic' | 'gemini' = 'openai'
  ): Promise<OptimizedImageResult> {
    const settings = {
      ...this.DEFAULT_SETTINGS,
      ...this.PROVIDER_SETTINGS[provider],
    };

    try {
      logger.log('Optimizing image for provider:', provider);
      
      const originalSize = imageAsset.fileSize || 0;
      
      // Check if image needs compression
      const needsCompression = this.needsCompression(imageAsset, settings);
      
      if (!needsCompression && imageAsset.base64) {
        logger.log('Image already optimized, using original');
        return {
          uri: imageAsset.uri,
          base64: imageAsset.base64,
          mimeType: imageAsset.mimeType || 'image/jpeg',
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
        };
      }

      // Perform compression
      const compressedAsset = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: settings.quality,
        base64: true,
        exif: false,
      });

      if (compressedAsset.canceled || !compressedAsset.assets[0]) {
        throw new Error('Image compression failed');
      }

      const compressed = compressedAsset.assets[0];
      const compressedSize = compressed.fileSize || 0;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1.0;

      logger.log('Image compression complete:', {
        originalSize,
        compressedSize,
        compressionRatio: (compressionRatio * 100).toFixed(1) + '%',
      });

      return {
        uri: compressed.uri,
        base64: compressed.base64,
        mimeType: compressed.mimeType || 'image/jpeg',
        originalSize,
        compressedSize,
        compressionRatio,
      };
    } catch (error) {
      logger.warn('Image optimization failed, using original:', error);
      
      // Fallback to original image
      return {
        uri: imageAsset.uri,
        base64: imageAsset.base64,
        mimeType: imageAsset.mimeType || 'image/jpeg',
        originalSize: imageAsset.fileSize || 0,
        compressedSize: imageAsset.fileSize || 0,
        compressionRatio: 1.0,
      };
    }
  }

  // Check if image needs compression
  private static needsCompression(
    imageAsset: ImagePicker.ImagePickerAsset,
    settings: typeof this.DEFAULT_SETTINGS
  ): boolean {
    const { width = 0, height = 0, fileSize = 0 } = imageAsset;
    
    // Check dimensions
    if (width > settings.maxWidth || height > settings.maxHeight) {
      return true;
    }

    // Check file size (5MB threshold)
    if (fileSize > 5 * 1024 * 1024) {
      return true;
    }

    // Check format
    if (imageAsset.mimeType && !imageAsset.mimeType.includes('jpeg')) {
      return true;
    }

    return false;
  }

  // Get optimal camera settings for provider
  static getCameraSettings(provider: 'openai' | 'anthropic' | 'gemini' = 'openai'): ImagePicker.ImagePickerOptions {
    const settings = {
      ...this.DEFAULT_SETTINGS,
      ...this.PROVIDER_SETTINGS[provider],
    };

    return {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: settings.quality,
      base64: true,
      allowsMultipleSelection: false,
      exif: false,
      cameraType: 'back',
    };
  }

  // Get optimal library picker settings
  static getLibrarySettings(provider: 'openai' | 'anthropic' | 'gemini' = 'openai'): ImagePicker.ImagePickerOptions {
    const settings = {
      ...this.DEFAULT_SETTINGS,
      ...this.PROVIDER_SETTINGS[provider],
    };

    return {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: settings.quality,
      base64: true,
      allowsMultipleSelection: false,
      exif: false,
    };
  }

  // Estimate token cost for image
  static estimateTokenCost(
    imageAsset: ImagePicker.ImagePickerAsset,
    provider: 'openai' | 'anthropic' | 'gemini' = 'openai'
  ): number {
    const { width = 1024, height = 1024 } = imageAsset;
    
    switch (provider) {
      case 'openai':
        // OpenAI charges based on image size
        if (width <= 512 && height <= 512) return 85;
        if (width <= 1024 && height <= 1024) return 170;
        return 765; // High detail
        
      case 'anthropic':
        // Claude has a fixed cost per image
        return 1568;
        
      case 'gemini':
        // Gemini has lower cost
        return 258;
        
      default:
        return 500; // Default estimate
    }
  }
}