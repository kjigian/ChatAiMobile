import { Provider } from '@/ai/generateText';

// More accurate tokenization patterns based on different providers' tokenizers
export class TokenEstimator {
  private static readonly PATTERNS = {
    // Common word boundaries and punctuation
    WORD_BOUNDARY: /\b\w+\b/g,
    // Special tokens (newlines, spaces, etc.)
    WHITESPACE: /\s+/g,
    // Punctuation clusters
    PUNCTUATION: /[^\w\s]+/g,
    // Unicode characters (each counts as multiple tokens often)
    UNICODE: /[^\x00-\x7F]/g,
    // Numbers with decimals
    NUMBERS: /\d+\.?\d*/g,
  };

  private static readonly PROVIDER_MULTIPLIERS = {
    openai: {
      word: 1.0,
      punctuation: 0.5,
      unicode: 2.0,
      number: 0.8,
      whitespace: 0.1,
    },
    anthropic: {
      word: 1.1,
      punctuation: 0.6,
      unicode: 2.2,
      number: 0.9,
      whitespace: 0.1,
    },
    gemini: {
      word: 0.9,
      punctuation: 0.4,
      unicode: 1.8,
      number: 0.7,
      whitespace: 0.1,
    },
  };

  static estimateTokens(text: string, provider: Provider = 'openai'): number {
    if (!text || text.length === 0) return 0;

    const multipliers = this.PROVIDER_MULTIPLIERS[provider];
    let totalTokens = 0;

    // Count words
    const words = text.match(this.PATTERNS.WORD_BOUNDARY) || [];
    totalTokens += words.length * multipliers.word;

    // Count punctuation clusters
    const punctuation = text.match(this.PATTERNS.PUNCTUATION) || [];
    totalTokens += punctuation.length * multipliers.punctuation;

    // Count unicode characters (often take multiple tokens)
    const unicode = text.match(this.PATTERNS.UNICODE) || [];
    totalTokens += unicode.length * multipliers.unicode;

    // Count numbers (often tokenized efficiently)
    const numbers = text.match(this.PATTERNS.NUMBERS) || [];
    totalTokens += numbers.length * multipliers.number;

    // Add base overhead for very short texts
    if (text.length > 0 && totalTokens < 1) {
      totalTokens = 1;
    }

    // Add 10% buffer for tokenizer variations
    return Math.ceil(totalTokens * 1.1);
  }

  // Fast estimation for very long texts (fallback to character-based)
  static estimateTokensFast(text: string, provider: Provider = 'openai'): number {
    if (!text) return 0;
    
    const baseRatio = provider === 'gemini' ? 3.5 : provider === 'anthropic' ? 4.2 : 4.0;
    return Math.ceil(text.length / baseRatio);
  }

  // Smart estimation that chooses method based on text length
  static smartEstimate(text: string, provider: Provider = 'openai'): number {
    if (!text) return 0;
    
    // For very long texts, use fast estimation
    if (text.length > 10000) {
      return this.estimateTokensFast(text, provider);
    }
    
    // For normal texts, use accurate estimation
    return this.estimateTokens(text, provider);
  }

  // Estimate tokens for a conversation with images
  static estimateConversationTokens(
    messages: Array<{ text: string; image?: any }>,
    provider: Provider = 'openai'
  ): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Text tokens
      totalTokens += this.smartEstimate(message.text, provider);

      // Image tokens (vision models)
      if (message.image) {
        // Base image cost varies by provider
        const imageCost = provider === 'gemini' ? 258 : provider === 'anthropic' ? 1568 : 765;
        totalTokens += imageCost;
      }
    }

    // Add conversation structure overhead
    const structureOverhead = Math.ceil(messages.length * 0.5);
    return totalTokens + structureOverhead;
  }
}