import { Provider } from '@/ai/generateText';

const TOKEN_LIMITS: Record<Provider, number> = {
  gemini: 1000000, // Gemini 1.5 models have very high context
  openai: 128000,  // GPT-4 Turbo and GPT-4o
  anthropic: 200000, // Claude 3.5 Sonnet
};

const SAFETY_MARGIN = 0.8; // Use 80% of limit to leave room for response

export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is a simplified approach; real tokenization would be more accurate
  return Math.ceil(text.length / 4);
}

export function getContextLimit(provider: Provider): number {
  return Math.floor(TOKEN_LIMITS[provider] * SAFETY_MARGIN);
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export function trimContextByTokens(
  history: ChatTurn[],
  newPrompt: string,
  provider: Provider
): ChatTurn[] {
  const contextLimit = getContextLimit(provider);
  const promptTokens = estimateTokens(newPrompt);
  
  // Reserve tokens for the new prompt
  const availableTokens = contextLimit - promptTokens;
  
  if (availableTokens <= 0) {
    // If prompt itself is too large, return empty history
    return [];
  }
  
  let totalTokens = 0;
  const trimmedHistory: ChatTurn[] = [];
  
  // Add messages from most recent backwards until we hit the limit
  for (let i = history.length - 1; i >= 0; i--) {
    const messageTokens = estimateTokens(history[i].text);
    
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