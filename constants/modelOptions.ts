import { Provider } from '@/ai/generateText';

export const modelOptions: Record<Provider, { label: string; value: string }[]> = {
  gemini: [
    { label: 'Gemini 1.5 Flash (Latest)', value: 'gemini-1.5-flash-latest' },
    { label: 'Gemini 1.0 Pro', value: 'gemini-pro' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4 Turbo', value: 'gpt-4o-mini' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  ],
  anthropic: [
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
  ],
};
