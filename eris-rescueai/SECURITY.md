# 🔐 API Key Security - Guide d'implémentation

## Vue d'ensemble

Vous avez maintenant un système de sécurisation complet pour vos endpoints SOS. Voici ce qui a été mis en place :

## ✅ Nouveaux fichiers créés

### 1. **lib/auth/apiKey.js** - Utilitaires de gestion des clés
- `generateApiKey()` - Génère une clé API aléatoire et sécurisée (format: `sos_XXXXXXXX...`)
- `hashApiKey()` - Hache les clés pour stockage sécurisé
- `verifyApiKey()` - Vérifie qu'une clé correspond à son hash
- `validateApiKey()` - Valide la présence d'une clé API dans les headers

### 2. **lib/auth/middleware.js** - Middleware d'authentification
- `authenticateApiKey()` - Middleware principal qui:
  - Vérifie la présence d'une clé API
  - La valide contre la base de données Supabase
  - Retourne les infos du client (ID, nom, rate limit)
  - Rejette les requêtes non authentifiées avec HTTP 401

### 3. **scripts/setup-api-keys.js** - Script de configuration
- Crée la table `api_keys` dans Supabase
- Génère les premières clés API pour vos clients
- Affiche les clés (à stocker sécurisément !)

## 🚀 Étapes de configuration

### Étape 1 : Créer la table Supabase

Pour créer manuellement la table (si le script ne fonctionne pas), exécutez cette requête SQL dans Supabase :

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

### Étape 2 : Générer les clés API

Exécutez le script dans votre terminal :

```bash
npm run setup-api-keys
```

Ou directement :

```bash
node scripts/setup-api-keys.js
```

Le script affichera les clés générées. **SAUVEGARDEZ-LES** de manière sécurisée !

### Étape 3 : Stocker les clés

**Option A - Variables d'environnement** (Développement)
```bash
# .env.local
MOBILE_APP_API_KEY=sos_XXXXXXXXXXXXXXXXXXXXXXXX
DASHBOARD_API_KEY=sos_YYYYYYYYYYYYYYYYYYYYYYYYYYY
PARTNER_API_KEY=sos_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ
```

**Option B - Gestionnaire de secrets** (Production - Recommandé)
- AWS Secrets Manager
- HashiCorp Vault
- 1Password / LastPass
- Azure Key Vault

## 🔑 Utilisation des clés API

### Format de la requête

Envoyez votre clé API dans le header `X-API-Key` :

```bash
curl -X POST https://votre-domaine.com/api/sos/ingest \
  -H "X-API-Key: sos_XXXXXXXXXXXXXXXXXXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-123",
    "lat": 48.8566,
    "lng": 2.3522,
    "sensor_data": {
      "battery": 85,
      "fall_detected": false,
      "crash_detected": false
    }
  }'
```

### Alternatives

Vous pouvez aussi utiliser le header `Authorization: Bearer` :

```bash
curl -X POST https://votre-domaine.com/api/sos/ingest \
  -H "Authorization: Bearer sos_XXXXXXXXXXXXXXXXXXXXXXXX"
```

## 📋 Endpoints protégés

### ✅ POST /api/sos/ingest
**Authentification requise** : ✔️ OUI
**Description** : Ingest d'une alerte SOS

```bash
# Exemple réussi (401 sans clé valide)
curl -X POST https://votre-domaine.com/api/sos/ingest \
  -H "X-API-Key: sos_votre_cle_api"
```

### ✅ GET /api/sos/events
**Authentification requise** : ✔️ OUI
**Description** : Récupérer tous les événements SOS

```bash
curl -X GET https://votre-domaine.com/api/sos/events \
  -H "X-API-Key: sos_votre_cle_api"
```

## 🔄 Gestion des clés API

### Désactiver une clé (compromis/ancien client)

```sql
UPDATE api_keys 
SET is_active = false 
WHERE client_name = 'old-partner';
```

### Révoquer toutes les clés d'un client

```sql
DELETE FROM api_keys 
WHERE client_name = 'compromised-client';
```

### Voir les clés actives

```sql
SELECT client_name, is_active, rate_limit, created_at 
FROM api_keys 
WHERE is_active = true;
```

### Tracker l'utilisation

```sql
UPDATE api_keys 
SET last_used_at = CURRENT_TIMESTAMP 
WHERE id = 'client-id';

-- Voir l'utilisation
SELECT client_name, last_used_at 
FROM api_keys 
ORDER BY last_used_at DESC;
```

## 🚨 Codes d'erreur

| Code | Message | Solution |
|------|---------|----------|
| **401** | `Missing API key` | Ajoutez le header `X-API-Key` |
| **401** | `Invalid or inactive API key` | Vérifiez votre clé API (typo, expirée) |
| **503** | `Authentication service unavailable` | Supabase est down, réessayez plus tard |

## 🛡️ Bonnes pratiques de sécurité

### ✅ À FAIRE

- ✅ Stocker les clés API dans des variables d'environnement
- ✅ Utiliser un gestionnaire de secrets en production
- ✅ Rotationner les clés régulièrement
- ✅ Loguer les accès réussis/échoués
- ✅ Limiter les permissions par client (rate limiting)
- ✅ Utiliser HTTPS obligatoirement
- ✅ Désactiver les clés compromises immédiatement

### ❌ À NE PAS FAIRE

- ❌ Ne commitez JAMAIS les clés dans Git
- ❌ Ne les envoyez pas par email/Slack en clair
- ❌ N'exposez pas les clés dans les logs
- ❌ N'utilisez pas la même clé pour plusieurs clients/environnements
- ❌ Ne créez pas de clés avec une durée de vie infinie sans monitoring

## 📊 Next steps recommandés

1. **Rate limiting** - Ajouter un rate limiter par clé API
2. **Logging** - Tracker chaque requête authentifiée
3. **Expiration** - Ajouter une date d'expiration aux clés
4. **Webhook notifications** - Alerter en cas d'accès suspect
5. **Audit trail** - Garder un historique des modifications

## 🤔 Questions ?

- Besoin de générer une nouvelle clé ? Réexécutez le script
- Une clé a été compromise ? Désactivez-la en SQL immédiatement
- Besoin de limiter l'accès ? Utilisez le rate limit par client

---

**Sécurisé par :** Clés API SHA256-hashées + Base de données Supabase
