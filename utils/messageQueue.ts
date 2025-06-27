import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { ChatMessage } from './conversations';
import { logger } from './logger';

export interface QueuedMessage {
  id: string;
  conversationId: string;
  message: ChatMessage;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'sending' | 'failed' | 'sent';
  error?: string;
}

export interface SendMessageParams {
  provider: string;
  model: string;
  prompt: string;
  image?: {
    uri: string;
    base64?: string;
    mimeType?: string;
  };
  apiKey: string;
  history: ChatMessage[];
}

const QUEUE_KEY = 'message_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

class MessageQueueManager {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private listeners: Set<() => void> = new Set();

  async initialize() {
    await this.loadQueue();
    this.startProcessing();
  }

  private async loadQueue() {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
        logger.log('Loaded message queue:', this.queue.length, 'items');
      }
    } catch (error) {
      logger.error('Failed to load message queue:', error);
      this.queue = [];
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      logger.error('Failed to save message queue:', error);
    }
  }

  async addMessage(
    conversationId: string, 
    message: ChatMessage, 
    sendParams: SendMessageParams
  ): Promise<string> {
    const queuedMessage: QueuedMessage = {
      id: randomUUID(),
      conversationId,
      message: {
        ...message,
        id: message.id || randomUUID(),
      },
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      status: 'pending',
    };

    // Store send parameters separately for processing
    await AsyncStorage.setItem(`queue_params_${queuedMessage.id}`, JSON.stringify(sendParams));

    this.queue.push(queuedMessage);
    await this.saveQueue();
    this.notifyListeners();

    logger.log('Added message to queue:', queuedMessage.id);
    return queuedMessage.id;
  }

  async removeMessage(id: string): Promise<boolean> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(msg => msg.id !== id);
    
    if (this.queue.length < initialLength) {
      await this.saveQueue();
      await AsyncStorage.removeItem(`queue_params_${id}`);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  async updateMessageStatus(id: string, status: QueuedMessage['status'], error?: string) {
    const message = this.queue.find(msg => msg.id === id);
    if (message) {
      message.status = status;
      if (error) {
        message.error = error;
      }
      await this.saveQueue();
      this.notifyListeners();
    }
  }

  getQueue(): QueuedMessage[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.filter(msg => msg.status === 'pending' || msg.status === 'sending').length;
  }

  getFailedCount(): number {
    return this.queue.filter(msg => msg.status === 'failed').length;
  }

  addListener(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  private async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      try {
        const pendingMessages = this.queue.filter(msg => msg.status === 'pending');
        
        if (pendingMessages.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          continue;
        }

        for (const queuedMessage of pendingMessages) {
          if (queuedMessage.retryCount >= queuedMessage.maxRetries) {
            await this.updateMessageStatus(queuedMessage.id, 'failed', 'Max retries exceeded');
            continue;
          }

          try {
            await this.processSingleMessage(queuedMessage);
          } catch (error) {
            logger.error('Failed to process queued message:', error);
            queuedMessage.retryCount++;
            queuedMessage.error = error instanceof Error ? error.message : String(error);
            
            if (queuedMessage.retryCount >= queuedMessage.maxRetries) {
              await this.updateMessageStatus(queuedMessage.id, 'failed', queuedMessage.error);
            } else {
              await this.updateMessageStatus(queuedMessage.id, 'pending', queuedMessage.error);
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * queuedMessage.retryCount));
            }
          }
        }
      } catch (error) {
        logger.error('Error in message queue processing:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds on error
      }
    }
  }

  private async processSingleMessage(queuedMessage: QueuedMessage) {
    await this.updateMessageStatus(queuedMessage.id, 'sending');

    // Get send parameters
    const paramsRaw = await AsyncStorage.getItem(`queue_params_${queuedMessage.id}`);
    if (!paramsRaw) {
      throw new Error('Send parameters not found');
    }

    const sendParams: SendMessageParams = JSON.parse(paramsRaw);

    // Check if we're online (basic connectivity check)
    if (!await this.isOnline()) {
      throw new Error('No internet connection');
    }

    // Import the generateText function dynamically to avoid circular dependencies
    const { generateText } = await import('../ai/generateText');

    // Send the message
    const response = await generateText({
      provider: sendParams.provider as any,
      model: sendParams.model,
      prompt: sendParams.prompt,
      image: sendParams.image,
      apiKey: sendParams.apiKey,
      history: sendParams.history,
    });

    // If successful, update conversation and remove from queue
    const { loadConversation, saveConversation } = await import('./conversations');
    const conversation = await loadConversation(queuedMessage.conversationId);
    
    if (conversation) {
      const aiMessage: ChatMessage = {
        role: 'model',
        text: response,
        provider: sendParams.provider,
        id: randomUUID(),
      };

      conversation.messages.push(queuedMessage.message, aiMessage);
      conversation.updatedAt = new Date().toISOString();
      
      await saveConversation(conversation);
    }

    await this.updateMessageStatus(queuedMessage.id, 'sent');
    await this.removeMessage(queuedMessage.id);

    logger.log('Successfully processed queued message:', queuedMessage.id);
  }

  private async isOnline(): Promise<boolean> {
    try {
      // Simple connectivity test - try to fetch a small resource
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      return true; // If we get here, we have connectivity
    } catch {
      return false;
    }
  }

  async retryFailedMessages(): Promise<void> {
    const failedMessages = this.queue.filter(msg => msg.status === 'failed');
    for (const message of failedMessages) {
      message.status = 'pending';
      message.retryCount = 0;
      message.error = undefined;
    }
    await this.saveQueue();
    this.notifyListeners();
    logger.log('Retrying', failedMessages.length, 'failed messages');
  }

  async clearQueue(): Promise<void> {
    // Remove all parameter files
    for (const message of this.queue) {
      await AsyncStorage.removeItem(`queue_params_${message.id}`);
    }
    
    this.queue = [];
    await this.saveQueue();
    this.notifyListeners();
    logger.log('Cleared message queue');
  }
}

export const messageQueue = new MessageQueueManager();

// Initialize on import
messageQueue.initialize().catch(error => {
  logger.error('Failed to initialize message queue:', error);
});