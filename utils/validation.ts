export interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  error?: string;
}

export const MAX_MESSAGE_LENGTH = 50000;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateAndSanitizeInput(input: string): ValidationResult {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Input must be a non-empty string' };
  }

  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { isValid: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  }

  // Remove potentially dangerous characters while preserving formatting
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\u0000/g, '') // Remove null bytes
    .substring(0, MAX_MESSAGE_LENGTH);

  return { isValid: true, sanitized };
}

export function validateImageSize(base64Data: string): ValidationResult {
  if (!base64Data) {
    return { isValid: false, error: 'Image data is required' };
  }

  // Estimate size from base64 (base64 is ~33% larger than binary)
  const estimatedSize = (base64Data.length * 3) / 4;
  
  if (estimatedSize > MAX_IMAGE_SIZE) {
    return { 
      isValid: false, 
      error: `Image too large (max ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB)` 
    };
  }

  return { isValid: true };
}

export function sanitizeApiKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: 'API key must be a string' };
  }

  const trimmed = key.trim();
  
  if (trimmed.length < 10) {
    return { isValid: false, error: 'API key too short' };
  }

  // Remove any non-alphanumeric characters except dashes and underscores
  const sanitized = trimmed.replace(/[^a-zA-Z0-9\-_]/g, '');
  
  return { isValid: true, sanitized };
}