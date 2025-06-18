import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { modelOptions } from '@/constants/modelOptions';
import { Provider } from '@/ai/generateText';

interface ProviderModelContextProps {
  selectedProvider: Provider;
  setSelectedProvider: (p: Provider) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
}

const ProviderModelContext = createContext<ProviderModelContextProps | undefined>(undefined);

export const ProviderModelProvider = ({ children }: { children: ReactNode }) => {
  const [selectedProvider, setSelectedProvider] = useState<Provider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>(modelOptions['gemini'][0].value);

  // Whenever provider changes, reset model to that provider's first entry
  useEffect(() => {
    const first = modelOptions[selectedProvider][0]?.value;
    if (first) setSelectedModel(first);
  }, [selectedProvider]);

  return (
    <ProviderModelContext.Provider value={{ selectedProvider, setSelectedProvider, selectedModel, setSelectedModel }}>
      {children}
    </ProviderModelContext.Provider>
  );
};

export const useProviderModel = () => {
  const ctx = useContext(ProviderModelContext);
  if (!ctx) throw new Error('useProviderModel must be used within ProviderModelProvider');
  return ctx;
};
