import crypto from 'crypto';

/**
 * Génère une clé API aléatoire et sécurisée
 * @returns {string} Une clé API au format: sos_XXXXXXXXXXXXXXXXXXXXXXXX
 */
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `sos_${randomBytes}`;
}

/**
 * Hash une clé API pour la stocker de manière sécurisée
 * @param {string} apiKey - La clé API en clair
 * @returns {string} La clé hashée
 */
export function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Compare une clé API avec son hash
 * @param {string} apiKey - La clé API en clair
 * @param {string} hash - Le hash stocké
 * @returns {boolean} true si la clé correspond au hash
 */
export function verifyApiKey(apiKey, hash) {
  const computedHash = hashApiKey(apiKey);
  return computedHash === hash;
}

/**
 * Middleware pour vérifier les clés API
 * @param {Request} request - La requête Next.js
 * @returns {Object} {isValid: boolean, apiKeyHash: string, error?: string}
 */
export function validateApiKey(request) {
  // Récupérer la clé API depuis les headers
  const apiKey = request.headers.get('x-api-key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      isValid: false,
      error: 'Missing API key. Provide it via X-API-Key header or Authorization header.',
    };
  }

  // Hasher la clé pour la comparaison
  const keyHash = hashApiKey(apiKey);

  return {
    isValid: true,
    apiKeyHash: keyHash,
  };
}
