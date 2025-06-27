import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

export interface MessageReaction {
  emoji: string;
  timestamp: string;
}

export interface MessageVersion {
  text: string;
  provider?: string;
  timestamp: string;
  version: number;
  isActive: boolean; // Which version is currently being displayed
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  provider?: string;
  image?: {
    uri: string;
    base64?: string;
    mimeType?: string;
  };
  reactions?: MessageReaction[];
  isFavorite?: boolean;
  id?: string; // Unique identifier for the message
  versions?: MessageVersion[]; // All versions of this message
  editHistory?: { // Track when messages were edited
    originalText: string;
    editedAt: string;
    editCount: number;
  };
}

export interface ConversationFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string; // uuid
  title?: string; // optional custom title
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  provider: string;
  model: string;
  messages: ChatMessage[];
  folderId?: string; // reference to folder
  tags?: string[]; // conversation tags
}

const LIST_KEY = 'conversation_ids';
const FOLDERS_KEY = 'conversation_folders';

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

// Folder management functions
export async function createFolder(name: string, color?: string): Promise<ConversationFolder> {
  const folder: ConversationFolder = {
    id: randomUUID(),
    name,
    color,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const existing = await listFolders();
  existing.push(folder);
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(existing));
  
  return folder;
}

export async function listFolders(): Promise<ConversationFolder[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function updateFolder(id: string, updates: Partial<Pick<ConversationFolder, 'name' | 'color'>>): Promise<ConversationFolder | null> {
  const folders = await listFolders();
  const folderIndex = folders.findIndex(f => f.id === id);
  
  if (folderIndex === -1) return null;
  
  const updated = {
    ...folders[folderIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  folders[folderIndex] = updated;
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  
  return updated;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const folders = await listFolders();
  const filtered = folders.filter(f => f.id !== id);
  
  if (filtered.length === folders.length) return false; // Not found
  
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(filtered));
  
  // Remove folder reference from conversations
  const conversations = await listConversations();
  for (const conv of conversations) {
    if (conv.folderId === id) {
      await updateConversationFolder(conv.id, undefined);
    }
  }
  
  return true;
}

export async function updateConversationFolder(conversationId: string, folderId?: string): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) return false;
  
  const updated = {
    ...conversation,
    folderId,
    updatedAt: new Date().toISOString(),
  };
  
  await saveConversation(updated);
  return true;
}

export async function updateConversationTags(conversationId: string, tags: string[]): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) return false;
  
  const updated = {
    ...conversation,
    tags,
    updatedAt: new Date().toISOString(),
  };
  
  await saveConversation(updated);
  return true;
}

export async function listConversationsByFolder(folderId?: string): Promise<Conversation[]> {
  const allConversations = await listConversations();
  return allConversations.filter(conv => {
    if (folderId === undefined) {
      return !conv.folderId; // Conversations not in any folder
    }
    return conv.folderId === folderId;
  });
}

export async function listConversationsByTag(tag: string): Promise<Conversation[]> {
  const allConversations = await listConversations();
  return allConversations.filter(conv => 
    conv.tags && conv.tags.includes(tag)
  );
}

export function getAllTags(conversations: Conversation[]): string[] {
  const tagSet = new Set<string>();
  conversations.forEach(conv => {
    if (conv.tags) {
      conv.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
}

// Message editing and deletion functions
export async function editMessage(
  conversationId: string,
  messageIndex: number,
  newText: string
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation || !conversation.messages[messageIndex]) {
    return false;
  }

  conversation.messages[messageIndex] = {
    ...conversation.messages[messageIndex],
    text: newText,
  };
  
  conversation.updatedAt = new Date().toISOString();
  await saveConversation(conversation);
  return true;
}

export async function deleteMessage(
  conversationId: string,
  messageIndex: number
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation || !conversation.messages[messageIndex]) {
    return false;
  }

  conversation.messages.splice(messageIndex, 1);
  conversation.updatedAt = new Date().toISOString();
  await saveConversation(conversation);
  return true;
}

export async function deleteMessageRange(
  conversationId: string,
  startIndex: number,
  endIndex: number
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) {
    return false;
  }

  if (startIndex < 0 || endIndex >= conversation.messages.length || startIndex > endIndex) {
    return false;
  }

  conversation.messages.splice(startIndex, endIndex - startIndex + 1);
  conversation.updatedAt = new Date().toISOString();
  await saveConversation(conversation);
  return true;
}

// Version history functions
export async function editMessageWithVersions(
  conversationId: string,
  messageIndex: number,
  newText: string
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation || !conversation.messages[messageIndex]) {
    return false;
  }

  const message = conversation.messages[messageIndex];
  const now = new Date().toISOString();

  // Initialize versions array if it doesn't exist
  if (!message.versions) {
    message.versions = [
      {
        text: message.text,
        provider: message.provider,
        timestamp: conversation.createdAt,
        version: 1,
        isActive: false, // No longer active since we're creating a new version
      }
    ];
  }

  // Add new version
  const newVersion: MessageVersion = {
    text: newText,
    provider: message.provider,
    timestamp: now,
    version: message.versions.length + 1,
    isActive: true,
  };

  // Set all previous versions to inactive
  message.versions.forEach(v => v.isActive = false);
  message.versions.push(newVersion);

  // Update the main message text to the new version
  message.text = newText;

  // Update edit history
  if (!message.editHistory) {
    message.editHistory = {
      originalText: message.versions[0].text,
      editedAt: now,
      editCount: 1,
    };
  } else {
    message.editHistory.editedAt = now;
    message.editHistory.editCount++;
  }

  conversation.updatedAt = now;
  await saveConversation(conversation);
  return true;
}

export async function addResponseVersion(
  conversationId: string,
  messageIndex: number,
  newResponseText: string,
  provider: string,
  correlatedVersion?: number
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation || !conversation.messages[messageIndex]) {
    return false;
  }

  const message = conversation.messages[messageIndex];
  const now = new Date().toISOString();

  // Initialize versions array if it doesn't exist
  if (!message.versions) {
    message.versions = [
      {
        text: message.text,
        provider: message.provider,
        timestamp: conversation.createdAt,
        version: 1,
        isActive: false,
      }
    ];
  }

  // Add new response version
  const versionNumber = correlatedVersion || (message.versions.length + 1);
  const newVersion: MessageVersion = {
    text: newResponseText,
    provider: provider,
    timestamp: now,
    version: versionNumber,
    isActive: true,
  };

  // Set all previous versions to inactive
  message.versions.forEach(v => v.isActive = false);
  message.versions.push(newVersion);

  // Update the main message text and provider
  message.text = newResponseText;
  message.provider = provider;

  conversation.updatedAt = now;
  await saveConversation(conversation);
  return true;
}

export async function switchToMessageVersion(
  conversationId: string,
  messageIndex: number,
  versionNumber: number
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation || !conversation.messages[messageIndex]) {
    return false;
  }

  const message = conversation.messages[messageIndex];
  if (!message.versions) {
    return false;
  }

  const targetVersion = message.versions.find(v => v.version === versionNumber);
  if (!targetVersion) {
    return false;
  }

  // Set all versions to inactive
  message.versions.forEach(v => v.isActive = false);
  // Set target version to active
  targetVersion.isActive = true;

  // Update the main message text
  message.text = targetVersion.text;
  message.provider = targetVersion.provider;

  // If this is a user message, also switch the corresponding AI response version
  if (message.role === 'user') {
    const nextMessageIndex = messageIndex + 1;
    if (nextMessageIndex < conversation.messages.length) {
      const nextMessage = conversation.messages[nextMessageIndex];
      
      // If the next message is an AI response and has versions
      if (nextMessage.role === 'model' && nextMessage.versions && nextMessage.versions.length > 0) {
        // Try to find a response version that corresponds to this user message version
        // We'll use the version number as a correlation (same version number = related)
        const correspondingResponse = nextMessage.versions.find(v => v.version === versionNumber);
        
        if (correspondingResponse) {
          // Switch to the corresponding AI response version
          nextMessage.versions.forEach(v => v.isActive = false);
          correspondingResponse.isActive = true;
          nextMessage.text = correspondingResponse.text;
          nextMessage.provider = correspondingResponse.provider;
        } else {
          // If no corresponding version exists, switch to the latest version
          const latestVersion = nextMessage.versions.reduce((latest, current) => 
            current.version > latest.version ? current : latest
          );
          nextMessage.versions.forEach(v => v.isActive = false);
          latestVersion.isActive = true;
          nextMessage.text = latestVersion.text;
          nextMessage.provider = latestVersion.provider;
        }
      }
    }
  }

  // If this is an AI message, we might want to also update any subsequent messages
  // that were generated based on this response, but for now we'll keep it simple

  conversation.updatedAt = new Date().toISOString();
  await saveConversation(conversation);
  return true;
}

export function getMessageVersions(message: ChatMessage): MessageVersion[] {
  return message.versions || [];
}

export function getActiveVersion(message: ChatMessage): MessageVersion | null {
  if (!message.versions) return null;
  return message.versions.find(v => v.isActive) || null;
}

export function hasMultipleVersions(message: ChatMessage): boolean {
  return (message.versions?.length || 0) > 1;
}
