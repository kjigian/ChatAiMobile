import { Provider } from '@/ai/generateText';

export interface ModelOption {
  label: string;
  value: string;
  supportsImages?: boolean;
}

export const modelOptions: Record<Provider, ModelOption[]> = {
  gemini: [
    { label: 'Gemini 1.5 Flash (Latest)', value: 'gemini-1.5-flash-latest', supportsImages: true },
    { label: 'Gemini 1.5 Pro (Latest)', value: 'gemini-1.5-pro-latest', supportsImages: true },
    { label: 'Gemini 1.0 Pro', value: 'gemini-pro', supportsImages: false },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o', supportsImages: true },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini', supportsImages: true },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', supportsImages: true },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', supportsImages: false },
  ],
  anthropic: [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022', supportsImages: true },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229', supportsImages: true },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022', supportsImages: true },
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229', supportsImages: true },
    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307', supportsImages: true },
  ],
};

export function modelSupportsImages(provider: Provider, model: string): boolean {
  const providerModels = modelOptions[provider];
  const modelInfo = providerModels.find(m => m.value === model);
  return modelInfo?.supportsImages ?? false;
}
