#!/usr/bin/env node

/**
 * Guide d'intégration pour les clients API
 * Comment s'authentifier et utiliser les endpoints SOS
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   ERIS-RescueAI API Integration Guide                      ║
║                       🔐 API Key Authentication                            ║
╚════════════════════════════════════════════════════════════════════════════╝

## 1️⃣ OBTENIR UNE CLÉ API

Contactez l'administrateur pour recevoir votre clé API unique.
Format: sos_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

## 2️⃣ AUTHENTIFIER VOS REQUÊTES

Ajoutez le header à CHAQUE requête:

  X-API-Key: sos_VOTRE_CLE_API

Ou (alternative):

  Authorization: Bearer sos_VOTRE_CLE_API

## 3️⃣ ENDPOINTS DISPONIBLES

### 📤 POST /api/sos/ingest
Soumettre une alerte SOS

Exemple cURL:
\`\`\`bash
curl -X POST https://rescueai.example.com/api/sos/ingest \\
  -H "X-API-Key: sos_XXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "device-123",
    "lat": 48.8566,
    "lng": 2.3522,
    "sensor_data": {
      "battery": 85,
      "fall_detected": false,
      "crash_detected": true,
      "inactivity": false,
      "impact": "high"
    }
  }'
\`\`\`

Réponse (200 OK):
\`\`\`json
{
  "success": true,
  "data": [{
    "id": "uuid-here",
    "device_id": "Simulated device-123",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "timestamp": "2026-06-08T12:34:56Z",
    "priority_score": 85,
    "ai_recommendation": "Dispatch emergency services immediately"
  }]
}
\`\`\`

### 📥 GET /api/sos/events
Récupérer tous les événements SOS

Exemple cURL:
\`\`\`bash
curl -X GET https://rescueai.example.com/api/sos/events \\
  -H "X-API-Key: sos_XXXXX"
\`\`\`

Réponse (200 OK):
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "device_id": "Abonné Device123",
      "latitude": 48.8566,
      "longitude": 2.3522,
      "timestamp": "2026-06-08T12:34:56Z",
      "priority_score": 95,
      "status": "pending",
      "ai_recommendation": "Critical - Medical response needed"
    }
  ]
}
\`\`\`

## 4️⃣ CODES DE STATUT HTTP

| Code | Situation | Actions |
|------|-----------|---------|
| 200 | ✅ Succès | Traiter normalement |
| 401 | ❌ Authentification échouée | Vérifier votre clé API |
| 503 | ⚠️ Service indisponible | Réessayer après 30s |

## 5️⃣ GESTION DES ERREURS

Réponse d'erreur (401):
\`\`\`json
{
  "error": "Missing API key. Provide it via X-API-Key header or Authorization header."
}
\`\`\`

Réponse d'erreur (401):
\`\`\`json
{
  "error": "Invalid or inactive API key"
}
\`\`\`

## 6️⃣ EXEMPLES D'INTÉGRATION

### JavaScript/Node.js

\`\`\`javascript
const apiKey = process.env.ERIS_API_KEY;

async function reportSOS(sensorData) {
  const response = await fetch('https://rescueai.example.com/api/sos/ingest', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_id: sensorData.deviceId,
      lat: sensorData.latitude,
      lng: sensorData.longitude,
      sensor_data: {
        battery: sensorData.battery,
        fall_detected: sensorData.fallDetected,
        crash_detected: sensorData.crashDetected,
        inactivity: sensorData.inactivity
      }
    })
  });

  if (response.status === 401) {
    throw new Error('API authentication failed');
  }

  return await response.json();
}
\`\`\`

### Python

\`\`\`python
import requests
import os

api_key = os.getenv('ERIS_API_KEY')

def report_sos(device_id, lat, lng, sensor_data):
    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'device_id': device_id,
        'lat': lat,
        'lng': lng,
        'sensor_data': sensor_data
    }
    
    response = requests.post(
        'https://rescueai.example.com/api/sos/ingest',
        json=payload,
        headers=headers
    )
    
    if response.status_code == 401:
        raise Exception('API authentication failed')
    
    return response.json()
\`\`\`

### React/TypeScript

\`\`\`typescript
const apiKey = process.env.REACT_APP_ERIS_API_KEY!;

async function reportEmergency(
  sensorData: SensorData
): Promise<SOSAlert> {
  const response = await fetch(
    'https://rescueai.example.com/api/sos/ingest',
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: sensorData.deviceId,
        lat: sensorData.latitude,
        lng: sensorData.longitude,
        sensor_data: sensorData,
      }),
    }
  );

  if (response.status === 401) {
    throw new Error('Invalid API key');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data[0];
}
\`\`\`

## 7️⃣ BONNES PRATIQUES

✅ À FAIRE:
- Stocker la clé API dans les variables d'environnement
- Vérifier les erreurs 401 et 503
- Mettre en place un retry avec backoff exponentiel
- Logger les erreurs pour le monitoring
- Utiliser HTTPS en production (obligatoire!)

❌ À ÉVITER:
- Hardcoder les clés API dans le code
- Committer les clés dans Git
- Partager les clés via email ou chat
- Utiliser HTTP en production
- Réessayer infiniment sans délai

## 8️⃣ SUPPORT

Problèmes fréquents:

❓ "Missing API key"
   → Vérifier que le header X-API-Key est présent

❓ "Invalid or inactive API key"  
   → Vérifier la clé (typo?)
   → Contactez l'admin si clé compromise

❓ "Authentication service unavailable"
   → Service temporairement indisponible
   → Réessayer après 30 secondes

═════════════════════════════════════════════════════════════════════════════
Pour la documentation complète, voir: SECURITY.md
═════════════════════════════════════════════════════════════════════════════
`);
