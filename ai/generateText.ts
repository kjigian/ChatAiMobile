import { trimContextByTokens } from '@/utils/tokenUtils';
import { modelSupportsImages } from '@/constants/modelOptions';
import { ResponseCache } from '@/utils/responseCache';
import { logger } from '@/utils/logger';
import { loadAISDK } from '@/utils/dynamicAI';

function stripImagesFromHistory(history: ChatTurn[]): ChatTurn[] {
  return history.map(turn => ({
    ...turn,
    image: undefined
  }));
}

export type Provider = 'gemini' | 'openai' | 'anthropic';

export interface ChatTurn { 
  role: 'user' | 'model'; 
  text: string;
  image?: {
    uri: string;
    base64?: string;
    mimeType?: string;
  };
}

export interface GenerateTextParams {
  provider: Provider;
  model: string;
  prompt: string;
  apiKey: string;
  history?: ChatTurn[]; // optional prior turns, oldest first
  image?: {
    uri: string;
    base64?: string;
    mimeType?: string;
  };
}

export interface StreamTextParams extends GenerateTextParams {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Minimal adapter that hides SDK differences between AI providers.
 * Non-streaming version; returns full text once available.
 */
export async function generateText({ provider, model, prompt, apiKey, history = [], image }: GenerateTextParams): Promise<string> {
  const supportsImages = modelSupportsImages(provider, model);
  
  // Check if model supports images when image is provided
  if (image && !supportsImages) {
    throw new Error(`Model ${model} does not support image inputs. Please switch to a vision-capable model or send text only.`);
  }
  
  // Strip images from history if model doesn't support them
  const processedHistory = supportsImages ? history : stripImagesFromHistory(history);
  const processedImage = supportsImages ? image : undefined;
  
  // Smart context trimming based on token limits
  const trimmedHistory = trimContextByTokens(processedHistory, prompt, provider, processedImage);

  // Check cache first
  const cacheRequest = {
    prompt,
    provider,
    model,
    imageHash: ResponseCache.generateImageHash(processedImage),
    historyHash: ResponseCache.generateHistoryHash(trimmedHistory),
  };

  const cachedResponse = await ResponseCache.getCached(cacheRequest);
  if (cachedResponse) {
    logger.log('Using cached response for prompt:', prompt.substring(0, 50));
    return cachedResponse;
  }

  switch (provider) {
    case 'gemini': {
      const GoogleGenerativeAI = await loadAISDK('gemini');
      const genAI = new GoogleGenerativeAI(apiKey);
                  const geminiModel = genAI.getGenerativeModel({ model });
      const historyForGemini = trimmedHistory.map(h => {
        const parts: any[] = [{ text: h.text }];
        if (h.image && h.image.base64) {
          parts.push({
            inlineData: {
              data: h.image.base64,
              mimeType: h.image.mimeType || 'image/jpeg'
            }
          });
        }
        return {
          role: h.role,
          parts
        };
      });
      const chatSession = geminiModel.startChat({ history: historyForGemini });
      
      const messageParts: any[] = [{ text: prompt }];
      if (processedImage && processedImage.base64) {
        messageParts.push({
          inlineData: {
            data: processedImage.base64,
            mimeType: processedImage.mimeType || 'image/jpeg'
          }
        });
      }
      
      const result = await chatSession.sendMessage(messageParts);
      const responseText = result.response.text();
      
      // Cache the response for future use
      if (responseText) {
        await ResponseCache.setCached(cacheRequest, responseText);
      }
      
      return responseText;
    }
    case 'openai': {
      const OpenAI = await loadAISDK('openai');
      const client = new OpenAI({ apiKey });
      const messages = [
        ...trimmedHistory.map(h => {
          const content: any[] = [{ type: 'text', text: h.text }];
          if (h.image && h.image.base64) {
            content.push({
              type: 'image_url',
              image_url: {
                url: `data:${h.image.mimeType || 'image/jpeg'};base64,${h.image.base64}`
              }
            });
          }
          return { role: h.role === 'model' ? 'assistant' : 'user', content };
        }),
      ];
      
      const userContent: any[] = [{ type: 'text', text: prompt }];
      if (processedImage && processedImage.base64) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${processedImage.mimeType || 'image/jpeg'};base64,${processedImage.base64}`
          }
        });
      }
      messages.push({ role: 'user', content: userContent });
      
      const completion = await client.chat.completions.create({
        model,
        messages: messages as any,
      });
      const responseText = completion.choices?.[0]?.message?.content ?? '';
      
      // Cache the response for future use
      if (responseText) {
        await ResponseCache.setCached(cacheRequest, responseText);
      }
      
      return responseText;
    }
    case 'anthropic': {
      const Anthropic = await loadAISDK('anthropic');
      const anthropic = new Anthropic({ apiKey });
      const messages = [
        ...trimmedHistory.map(h => {
          const content: any[] = [{ type: 'text', text: h.text }];
          if (h.image && h.image.base64) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: h.image.mimeType || 'image/jpeg',
                data: h.image.base64
              }
            });
          }
          return { role: h.role === 'model' ? 'assistant' : 'user', content };
        }),
      ];
      
      const userContent: any[] = [{ type: 'text', text: prompt }];
      if (processedImage && processedImage.base64) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: processedImage.mimeType || 'image/jpeg',
            data: processedImage.base64
          }
        });
      }
      messages.push({ role: 'user', content: userContent });
      
      const response: any = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        messages: messages as any,
      });
      const result = (response?.content?.[0]?.text ?? '') as string;
      
      // Cache the response for future use
      if (result) {
        await ResponseCache.setCached(cacheRequest, result);
      }
      
      return result;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Streaming version of generateText that calls onChunk for each piece of text.
 */
export async function streamText({ provider, model, prompt, apiKey, history = [], onChunk, onComplete, onError, image }: StreamTextParams): Promise<void> {
  const supportsImages = modelSupportsImages(provider, model);
  
  // Check if model supports images when image is provided
  if (image && !supportsImages) {
    onError(new Error(`Model ${model} does not support image inputs. Please switch to a vision-capable model or send text only.`));
    return;
  }
  
  // Strip images from history if model doesn't support them
  const processedHistory = supportsImages ? history : stripImagesFromHistory(history);
  const processedImage = supportsImages ? image : undefined;
  
  const trimmedHistory = trimContextByTokens(processedHistory, prompt, provider);

  // For React Native compatibility, fall back to non-streaming for now
  try {
    const text = await generateText({ provider, model, prompt, apiKey, history: processedHistory, image: processedImage });
    // Simulate streaming by sending the text in chunks
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onChunk(words[i] + (i < words.length - 1 ? ' ' : ''));
      // Add a small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    onComplete();
    return;
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return;
  }

  // Original streaming implementation (kept for future use when React Native supports it better)
  try {
    switch (provider) {
      case 'gemini': {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });
        const historyForGemini = trimmedHistory.map(h => ({
          role: h.role,
          parts: [{ text: h.text }],
        }));
        const chatSession = geminiModel.startChat({ history: historyForGemini });
        const result = await chatSession.sendMessageStream(prompt);
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            onChunk(chunkText);
          }
        }
        onComplete();
        break;
      }
      case 'openai': {
        const client = new OpenAI({ apiKey });
        const messages = [
          ...trimmedHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
          { role: 'user', content: prompt },
        ];
        const stream = await client.chat.completions.create({
          model,
          messages: messages as any,
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        }
        onComplete();
        break;
      }
      case 'anthropic': {
        const anthropic = new Anthropic({ apiKey });
        const messages = [
          ...trimmedHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
          { role: 'user', content: prompt },
        ];
        const stream = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          messages: messages as any,
          stream: true,
        });
        
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            onChunk(chunk.delta.text);
          }
        }
        onComplete();
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
