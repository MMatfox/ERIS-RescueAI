# 🔐 Résumé des changements de sécurité

## ✅ Déployé

Votre système d'authentification par clé API est **maintenant sécurisé**. Voici ce qui a été fait :

### Fichiers modifiés

1. **app/api/sos/ingest/route.js** ✅ Authentification ajoutée
2. **app/api/sos/events/route.js** ✅ Authentification ajoutée
3. **package.json** ✅ Scripts npm ajoutés

### Nouveaux fichiers

```
lib/auth/
  ├── apiKey.js          # Utilitaires pour gérer les clés
  └── middleware.js      # Middleware d'authentification

scripts/
  ├── setup-api-keys.js  # Initialisation des clés API
  ├── manage-api-keys.js # Gestion des clés
  └── test-api-keys.js   # Tests des endpoints

SECURITY.md             # Documentation complète
.env.api-keys.example   # Template de variables d'env
```

## 🚀 Prochaines étapes

### 1️⃣ Créer la table Supabase (IMPORTANT!)

Connectez-vous à Supabase et exécutez cette requête SQL:

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

### 2️⃣ Générer les clés API

```bash
npm run api:setup
```

Cela va créer 3 clés par défaut:
- `rescue-ai-mobile` (1000 requêtes/heure)
- `rescue-ai-dashboard` (500 requêtes/heure)
- `rescue-ai-partner` (200 requêtes/heure)

**⚠️ Copiez les clés qui s'affichent et stockez-les de manière sécurisée !**

### 3️⃣ Tester les endpoints

```bash
# Vérifier que l'API demande la clé
curl http://localhost:3000/api/sos/events
# Réponse: 401 "Missing API key"

# Avec la clé (remplacez par votre clé réelle)
curl -H "X-API-Key: sos_VOTRE_CLE" http://localhost:3000/api/sos/events
```

## 📚 Commandes utiles

```bash
npm run api:list      # Lister toutes les clés
npm run api:setup     # Générer les clés initiales
npm run api:create    # Créer une nouvelle clé
npm run api:revoke    # Désactiver une clé
npm run api:test      # Tester les endpoints
```

## 🔑 Utilisation des clés

### Dans votre app mobile:

```javascript
fetch('https://votre-api.com/api/sos/ingest', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.MOBILE_APP_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    device_id: 'device-123',
    lat: 48.8566,
    lng: 2.3522,
    sensor_data: { /* ... */ }
  })
})
```

### Dans votre dashboard:

```javascript
fetch('https://votre-api.com/api/sos/events', {
  headers: {
    'X-API-Key': process.env.DASHBOARD_API_KEY,
    'Content-Type': 'application/json'
  }
})
```

## 🛡️ Sécurité

- ✅ **Clés SHA256-hashées** en base de données
- ✅ **Authentification obligatoire** sur tous les endpoints
- ✅ **Support rate limiting** (configurable par client)
- ✅ **Tracking d'utilisation** (last_used_at)
- ✅ **Révocation instantanée** des clés
- ✅ **0 hardcoding** de clés

## 🚨 Important

- Ne commitez **JAMAIS** les clés dans Git
- Utilisez `.gitignore` pour `.env.local`
- En production, utilisez un gestionnaire de secrets
- Stockez les clés de manière sécurisée
- Rotationez les clés régulièrement

## ❓ Besoin d'aide?

Consultez [SECURITY.md](./SECURITY.md) pour la documentation complète.

---

**Vos données sont maintenant protégées par authentification par clé API !** 🎉
