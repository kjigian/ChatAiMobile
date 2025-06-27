import { Provider } from '@/ai/generateText';
import { logger } from './logger';

// Cache for loaded SDKs to avoid multiple imports
const sdkCache = new Map<Provider, any>();

export async function loadAISDK(provider: Provider): Promise<any> {
  // Return cached SDK if already loaded
  if (sdkCache.has(provider)) {
    return sdkCache.get(provider);
  }

  logger.log('Dynamically loading AI SDK for provider:', provider);

  let sdk: any;
  
  try {
    switch (provider) {
      case 'gemini': {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        sdk = GoogleGenerativeAI;
        break;
      }
      case 'openai': {
        const OpenAI = await import('openai');
        sdk = OpenAI.default || OpenAI;
        break;
      }
      case 'anthropic': {
        const Anthropic = await import('@anthropic-ai/sdk');
        sdk = Anthropic.default || Anthropic;
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Cache the loaded SDK
    sdkCache.set(provider, sdk);
    logger.log('Successfully loaded and cached SDK for:', provider);
    
    return sdk;
  } catch (error) {
    logger.error('Failed to load AI SDK for provider:', provider, error);
    throw new Error(`Failed to load AI SDK for ${provider}: ${error}`);
  }
}

// Preload SDK for a provider without blocking
export async function preloadAISDK(provider: Provider): Promise<void> {
  try {
    await loadAISDK(provider);
  } catch (error) {
    logger.warn('Failed to preload SDK for:', provider, error);
  }
}

// Preload commonly used SDKs
export async function preloadCommonSDKs(): Promise<void> {
  const providers: Provider[] = ['gemini', 'openai', 'anthropic'];
  
  // Load in parallel but don't wait for completion
  providers.forEach(provider => {
    preloadAISDK(provider).catch(() => {
      // Silently handle failures in background preloading
    });
  });
}

// Get cache status for debugging
export function getSDKCacheStatus(): Record<Provider, boolean> {
  return {
    gemini: sdkCache.has('gemini'),
    openai: sdkCache.has('openai'),
    anthropic: sdkCache.has('anthropic'),
  };
}