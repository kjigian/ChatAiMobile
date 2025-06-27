import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const ENCRYPTION_KEY_SIZE = 32; // 256 bits
const IV_SIZE = 16; // 128 bits

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

async function deriveKey(password: string, salt: string): Promise<string> {
  // Simple key derivation - in production, use PBKDF2
  const combined = password + salt;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

export async function encryptForWeb(data: string): Promise<string> {
  if (Platform.OS !== 'web') {
    return data; // Only encrypt on web
  }

  try {
    // Generate random salt and IV
    const salt = await Crypto.getRandomBytesAsync(16);
    const iv = await Crypto.getRandomBytesAsync(IV_SIZE);
    
    // Use device-specific key for encryption
    const deviceKey = await getDeviceKey();
    const key = await deriveKey(deviceKey, Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    // For web, we'll use a simple XOR cipher with the derived key
    // In production, use Web Crypto API for proper AES encryption
    const encrypted = xorEncrypt(data, key);
    
    const encryptedData: EncryptedData = {
      encrypted: encrypted,
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
    };
    
    return JSON.stringify(encryptedData);
  } catch (error) {
    console.warn('Encryption failed, storing plaintext:', error);
    return data; // Fallback to plaintext
  }
}

export async function decryptForWeb(encryptedData: string): Promise<string> {
  if (Platform.OS !== 'web') {
    return encryptedData; // Only decrypt on web
  }

  try {
    const parsed: EncryptedData = JSON.parse(encryptedData);
    
    // Use device-specific key for decryption
    const deviceKey = await getDeviceKey();
    const key = await deriveKey(deviceKey, parsed.salt);
    
    // Decrypt using XOR
    const decrypted = xorDecrypt(parsed.encrypted, key);
    
    return decrypted;
  } catch (error) {
    console.warn('Decryption failed, assuming plaintext:', error);
    return encryptedData; // Fallback - might be plaintext
  }
}

async function getDeviceKey(): Promise<string> {
  // Generate a device-specific key based on available device info
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const timestamp = Date.now().toString();
  
  // Create a semi-persistent key - in production, store this securely
  let storedKey = localStorage.getItem('__device_key');
  if (!storedKey) {
    storedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      userAgent + timestamp,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    localStorage.setItem('__device_key', storedKey);
  }
  
  return storedKey;
}

function xorEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  return btoa(result); // Base64 encode
}

function xorDecrypt(encrypted: string, key: string): string {
  const decoded = atob(encrypted); // Base64 decode
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    const encryptedChar = decoded.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(encryptedChar ^ keyChar);
  }
  return result;
}