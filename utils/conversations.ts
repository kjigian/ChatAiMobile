import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  provider?: string;
}

export interface Conversation {
  id: string; // uuid
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

export async function createNewConversation(initial: Partial<Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>> = {}) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const convo: Conversation = {
    id,
    createdAt: now,
    updatedAt: now,
    provider: initial.provider ?? 'gemini',
    model: initial.model ?? 'gemini-1.5-flash-latest',
    messages: initial.messages ?? [],
  };
  await AsyncStorage.setItem(keyFor(id), JSON.stringify(convo));
  await addIdToList(id);
  return convo;
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
