import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'gemini' | 'openai' | 'anthropic';

export interface ChatTurn { role: 'user' | 'model'; text: string }

export interface GenerateTextParams {
  provider: Provider;
  model: string;
  prompt: string;
  apiKey: string;
  history?: ChatTurn[]; // optional prior turns, oldest first
}

/**
 * Minimal adapter that hides SDK differences between Gemini and OpenAI.
 * Currently non-streaming; returns full text once available.
 */
export async function generateText({ provider, model, prompt, apiKey, history = [] }: GenerateTextParams): Promise<string> {
  // Helper: keep only the last 20 previous turns to cap context size
  const trimmedHistory = history.slice(-20);

  switch (provider) {
    case 'gemini': {
      const genAI = new GoogleGenerativeAI(apiKey);
                  const geminiModel = genAI.getGenerativeModel({ model });
      const historyForGemini = trimmedHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.text }],
      }));
      const chatSession = geminiModel.startChat({ history: historyForGemini });
      const result = await chatSession.sendMessage(prompt);
      return result.response.text();
    }
    case 'openai': {
      const client = new OpenAI({ apiKey });
            const messages = [
        ...trimmedHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: prompt },
      ];
      const completion = await client.chat.completions.create({
        model,
        messages: messages as any,
      });
      return completion.choices?.[0]?.message?.content ?? '';
    }
    case 'anthropic': {
      const anthropic = new Anthropic({ apiKey });
      const messages = [
        ...trimmedHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: prompt },
      ];
      const response: any = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        messages: messages as any,
      });
      return (response?.content?.[0]?.text ?? '') as string;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
