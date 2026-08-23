import crypto from 'crypto';

// Clé API sécurisée avec préfixe "sos_"
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `sos_${randomBytes}`;
}

// Hash SHA-256 pour stocker proprement en BDD
export function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

// Compare la clé reçue avec le hash stocké
export function verifyApiKey(apiKey, hash) {
  const computedHash = hashApiKey(apiKey);
  return computedHash === hash;
}

// Récupère et valide la clé dans les headers (x-api-key ou Bearer)
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
