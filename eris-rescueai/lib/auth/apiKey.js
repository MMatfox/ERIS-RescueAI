import crypto from 'crypto';

// Generates a cryptographically secure API key prefixed with "sos_"
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `sos_${randomBytes}`;
}

// Hashes an API key using SHA-256 for secure database storage
export function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

// Verifies if the provided plain API key matches the stored hash
export function verifyApiKey(apiKey, hash) {
  const computedHash = hashApiKey(apiKey);
  return computedHash === hash;
}

// Extracts and validates the presence of the API key from request headers
export function validateApiKey(request) {
  
  const apiKey = request.headers.get('x-api-key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      isValid: false,
      error: 'Missing API key. Provide it via X-API-Key header or Authorization header.',
    };
  }

  const keyHash = hashApiKey(apiKey);

  return {
    isValid: true,
    apiKeyHash: keyHash,
  };
}
