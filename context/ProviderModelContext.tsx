import React, { createContext, useContext, useState, ReactNode } from 'react';
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
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash-latest');

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
