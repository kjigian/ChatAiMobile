import { Provider } from '@/ai/generateText';
import { TokenEstimator } from './tokenizer';

const TOKEN_LIMITS: Record<Provider, number> = {
  gemini: 1000000, // Gemini 1.5 models have very high context
  openai: 128000,  // GPT-4 Turbo and GPT-4o
  anthropic: 200000, // Claude 3.5 Sonnet
};

const SAFETY_MARGIN = 0.8; // Use 80% of limit to leave room for response

export function estimateTokens(text: string, provider: Provider = 'openai'): number {
  return TokenEstimator.smartEstimate(text, provider);
}

export function getContextLimit(provider: Provider): number {
  return Math.floor(TOKEN_LIMITS[provider] * SAFETY_MARGIN);
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  image?: any;
}

export function trimContextByTokens(
  history: ChatTurn[],
  newPrompt: string,
  provider: Provider,
  newImage?: any
): ChatTurn[] {
  const contextLimit = getContextLimit(provider);
  const promptTokens = estimateTokens(newPrompt, provider);
  const imageTokens = newImage ? TokenEstimator.estimateConversationTokens([{ text: '', image: newImage }], provider) : 0;
  
  // Reserve tokens for the new prompt and image
  const availableTokens = contextLimit - promptTokens - imageTokens;
  
  if (availableTokens <= 0) {
    // If prompt itself is too large, return empty history
    return [];
  }
  
  let totalTokens = 0;
  const trimmedHistory: ChatTurn[] = [];
  
  // Add messages from most recent backwards until we hit the limit
  for (let i = history.length - 1; i >= 0; i--) {
    const messageTokens = history[i].image 
      ? TokenEstimator.estimateConversationTokens([history[i]], provider)
      : estimateTokens(history[i].text, provider);
    
    if (totalTokens + messageTokens > availableTokens) {
      break;
    }
    
    totalTokens += messageTokens;
    trimmedHistory.unshift(history[i]);
  }
  
  return trimmedHistory;
}

export function getModelContextInfo(provider: Provider, model: string): { limit: number; usableLimit: number } {
  // Some models have different limits - this could be expanded
  let limit = TOKEN_LIMITS[provider];
  
  // Adjust for specific models if needed
  if (provider === 'openai') {
    if (model.includes('gpt-3.5')) {
      limit = 16385;
    } else if (model.includes('gpt-4o-mini')) {
      limit = 128000;
    }
  } else if (provider === 'anthropic') {
    if (model.includes('claude-3-haiku')) {
      limit = 200000;
    }
  }
  
  return {
    limit,
    usableLimit: Math.floor(limit * SAFETY_MARGIN)
  };
}