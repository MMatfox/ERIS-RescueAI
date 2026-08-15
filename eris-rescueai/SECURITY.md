# Sécurité API — ERIS-RescueAI

## Comment ça marche

Tous les endpoints de l'API sont protégés par une clé API. Le principe :
1. Le client envoie sa clé dans le header `X-API-Key` (ou `Authorization: Bearer`)
2. Le serveur hash la clé en SHA-256 et cherche le hash dans la table `api_keys` de Supabase
3. Si le hash correspond à une clé active → accès autorisé
4. Sinon → erreur 401

Il y a aussi un raccourci : si la clé correspond à `API_KEY` dans le `.env.local`, on skip la vérification en BDD (utile en dev).

## Fichiers

- `lib/auth/apiKey.js` — fonctions de base : génération de clé, hash SHA-256, validation
- `lib/auth/middleware.js` — middleware qui vérifie la clé avant chaque requête
- `scripts/setup-api-keys.js` — crée les clés initiales pour les 3 clients
- `scripts/manage-api-keys.js` — list/create/revoke/delete
- `scripts/create-dev-key.js` — raccourci pour créer une clé de dev
- `scripts/test-api-keys.js` — teste les endpoints avec et sans clé

## Table Supabase

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(255) NOT NULL UNIQUE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  rate_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
```

## Commandes

```bash
npm run api:setup           # Génère les clés pour les 3 clients par défaut
npm run api:list            # Liste les clés actives
npm run api:create          # Crée une nouvelle clé
npm run api:revoke          # Désactive une clé
npm run api:test            # Teste les endpoints protégés
npm run api:create-dev-key  # Crée une clé de dev rapide
```

## Utilisation

```bash
# Avec X-API-Key
curl -H "X-API-Key: sos_VOTRE_CLE" http://localhost:3000/api/sos/events

# Avec Bearer
curl -H "Authorization: Bearer sos_VOTRE_CLE" http://localhost:3000/api/sos/events
```

## Endpoints protégés

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/sos/ingest` | Ingestion d'une alerte SOS |
| GET | `/api/sos/events` | Récupération des alertes |
| PATCH | `/api/sos/events` | Mise à jour du statut |

## Erreurs d'auth

| Code | Message | Quand |
|------|---------|-------|
| 401 | Missing API key | Pas de header X-API-Key |
| 401 | Invalid or inactive API key | Clé pas trouvée ou désactivée |
| 503 | Authentication service unavailable | Supabase pas joignable |

## Règles de base

- Le `.env.local` est dans le `.gitignore`, ne jamais le commit
- Utiliser HTTPS en prod
- Révoquer une clé compromise immédiatement via `npm run api:revoke`
