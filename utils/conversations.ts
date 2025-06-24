import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  provider?: string;
  image?: {
    uri: string;
    base64?: string;
    mimeType?: string;
  };
}

export interface Conversation {
  id: string; // uuid
  title?: string; // optional custom title
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  provider: string;
  model: string;
  messages: ChatMessage[];
}

const LIST_KEY = 'conversation_ids';

/*
 * Maintain a list of conversation ids in AsyncStorage so we can enumerate.
 */
async function addIdToList(id: string) {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  const arr: string[] = raw ? JSON.parse(raw) : [];
  if (!arr.includes(id)) {
    arr.push(id);
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify(arr));
  }
}

async function removeIdFromList(id: string) {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  if (!raw) return;
  const arr: string[] = JSON.parse(raw).filter((x: string) => x !== id);
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(arr));
}

function keyFor(id: string) {
  return `conversation_${id}`;
}

export function createNewConversationInMemory(initial: Partial<Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>> = {}): Conversation {
  const id = randomUUID();
  const now = new Date().toISOString();
  const convo: Conversation = {
    id,
    createdAt: now,
    updatedAt: now,
    provider: initial.provider ?? 'gemini',
    model: initial.model ?? 'gemini-1.5-flash-latest',
    messages: initial.messages ?? [],
  };
  return convo;
}

export async function createNewConversation(initial: Partial<Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>> = {}) {
  const convo = createNewConversationInMemory(initial);
  await AsyncStorage.setItem(keyFor(convo.id), JSON.stringify(convo));
  await addIdToList(convo.id);
  return convo;
}

export async function saveConversationForFirstTime(convo: Conversation) {
  // Only save if conversation has messages
  if (!convo.messages || convo.messages.length === 0) {
    console.log('[Conversations] Skipping save of empty conversation:', convo.id);
    return;
  }
  
  const updated = { ...convo, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(keyFor(convo.id), JSON.stringify(updated));
  await addIdToList(convo.id);
  console.log('[Conversations] Saved conversation for first time:', convo.id, 'Messages:', convo.messages.length);
}

export async function saveConversation(convo: Conversation) {
  const updated = { ...convo, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(keyFor(convo.id), JSON.stringify(updated));
  await addIdToList(convo.id);
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const raw = await AsyncStorage.getItem(keyFor(id));
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function listConversations(): Promise<Conversation[]> {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  if (!raw) return [];
  const ids: string[] = JSON.parse(raw);
  const convos: Conversation[] = [];
  for (const id of ids) {
    const c = await loadConversation(id);
    if (c) convos.push(c);
  }
  // newest first
  return convos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteConversation(id: string) {
  await AsyncStorage.removeItem(keyFor(id));
  await removeIdFromList(id);
}

export async function renameConversation(id: string, newTitle: string) {
  const convo = await loadConversation(id);
  if (!convo) throw new Error('Conversation not found');
  
  const updated = { ...convo, title: newTitle, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(keyFor(id), JSON.stringify(updated));
  return updated;
}

export function generateConversationTitle(conversation: Conversation): string {
  if (conversation.title) return conversation.title;
  
  // Try to extract meaningful title from first user message
  const firstUserMessage = conversation.messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    // Take first 30 characters and add ellipsis if needed
    const title = firstUserMessage.text.trim().substring(0, 30);
    return title.length === 30 ? title + '...' : title;
  }
  
  // Fallback to timestamp
  const date = new Date(conversation.createdAt);
  return `Chat ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export async function cleanupEmptyConversations(): Promise<number> {
  const conversations = await listConversations();
  let deletedCount = 0;
  
  for (const conv of conversations) {
    if (!conv.messages || conv.messages.length === 0) {
      console.log('[Conversations] Deleting empty conversation:', conv.id);
      await deleteConversation(conv.id);
      deletedCount++;
    }
  }
  
  console.log('[Conversations] Cleaned up', deletedCount, 'empty conversations');
  return deletedCount;
}

export async function deleteAllConversations(): Promise<number> {
  const conversations = await listConversations();
  let deletedCount = 0;
  
  for (const conv of conversations) {
    console.log('[Conversations] Deleting conversation:', conv.id);
    await deleteConversation(conv.id);
    deletedCount++;
  }
  
  console.log('[Conversations] Deleted all', deletedCount, 'conversations');
  return deletedCount;
}
