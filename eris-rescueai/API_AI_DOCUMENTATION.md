# ERIS-RescueAI — Documentation API et Moteur IA

## Vue d'ensemble

ERIS-RescueAI est le backend intelligent de la plateforme ERIS. Il implémente :
- Une **API d'ingestion** pour recevoir les alertes SOS depuis les boîtiers IoT et l'application mobile
- Un **data processing pipeline** pour filtrer, dédupliquer et scorer les alertes
- Un **priority ranking model** hybride (LLM + régression logistique locale)
- Une **rescue recommendation logic** qui génère des instructions contextuelles pour les secouristes

Le système se connecte à une base Supabase partagée avec l'équipe SOSMap.


## API Endpoints

### POST `/api/sos/ingest`

Point d'entrée principal pour l'ingestion des données SOS.

**Headers :**
- `X-API-Key: <clé>` (obligatoire)
- `Content-Type: application/json`

**Body :**

```json
{
  "device_id": "device-sos-001",
  "lat": 16.0544,
  "lng": 108.2022,
  "sensor_data": {
    "battery": 85,
    "impact": "none",
    "fall_detected": false,
    "crash_detected": false,
    "inactivity": false
  }
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `device_id` | string | Non (défaut: "unknown-device") | ID de l'appareil |
| `lat` | float | Non (défaut: 0) | Latitude GPS |
| `lng` | float | Non (défaut: 0) | Longitude GPS |
| `sensor_data.battery` | int | Non (défaut: 100) | Batterie en % |
| `sensor_data.impact` | string | Non | `none`, `low`, `high`, `extreme` |
| `sensor_data.fall_detected` | bool | Non | Chute détectée |
| `sensor_data.crash_detected` | bool | Non | Crash véhicule |
| `sensor_data.inactivity` | bool | Non | Absence de mouvement |

**Traitement interne (data processing pipeline) :**
1. Vérification clé API (middleware auth)
2. Parsing et validation du body
3. Détection doublon (même device_id dans les 2 dernières min)
4. Scoring de priorité via moteur IA
5. Génération recommandation
6. Insertion dans `sos_alerts` (Supabase)

**Réponse 201 :**
```json
{
  "success": true,
  "message": "SOS received & classified (sos_alerts)",
  "data": [{
    "id": "uuid",
    "device_id": "Simulated device-sos-001",
    "latitude": 16.0544,
    "longitude": 108.2022,
    "priority_score": 45,
    "is_duplicate": false,
    "status": "pending",
    "ai_recommendation": "[IA ERIS-RescueAI] ...",
    "created_at": "2026-08-13T..."
  }]
}
```

---

### GET `/api/sos/events`

Récupère toutes les alertes, enrichies avec le scoring IA.

**Headers :**
- `X-API-Key: <clé>` (obligatoire)

Chaque alerte est traitée à la volée :
- Extraction du type d'incident à partir des notes (crash, chute, inactivité)
- Calcul de l'impact depuis les mots-clés
- Déduplication par `user_id` (pour les vraies alertes SOSMap)
- Scoring + recommandation via le moteur IA

**Mapping des statuts SOSMap :** `delivered` → `pending`, `revoked` → `resolved`

**Réponse 200 :**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "device_id": "Abonné Dupont",
    "latitude": 16.0544,
    "longitude": 108.2022,
    "timestamp": "...",
    "created_at": "...",
    "raw_payload": {
      "battery": 85,
      "altitude": 0,
      "notes": "...",
      "blood_type": "O+",
      "allergies": "None",
      "medical_conditions": "None",
      "transmission_method": "INTERNET"
    },
    "is_duplicate": false,
    "priority_score": 72,
    "status": "pending",
    "ai_recommendation": "..."
  }]
}
```

---

### PATCH `/api/sos/events`

Met à jour le statut d'une alerte (triage opérateur).

**Body :**
```json
{
  "id": "uuid-de-lalerte",
  "status": "in_progress"
}
```

Valeurs : `pending`, `in_progress`, `resolved`

**Réponse 200 :**
```json
{
  "success": true,
  "message": "Alert updated",
  "data": [{ ... }]
}
```


## Data Models

### Table `sos_alerts` (Supabase)

Table partagée avec l'équipe SOSMap. On n'a pas eu la main sur le schéma, certains champs sont utilisés de manière détournée pour nos simulations.

| Colonne | Type | Usage RescueAI |
|---------|------|----------------|
| `id` | UUID | Identifiant unique de l'alerte |
| `user_id` | UUID | ID utilisateur SOSMap (UUID factice pour nos simulations) |
| `latitude` | float | Position GPS |
| `longitude` | float | Position GPS |
| `altitude` | float | Altitude |
| `battery_level` | int | Niveau de batterie |
| `notes` | text | Description auto-générée du type d'incident |
| `status` | text | Statut de l'alerte |
| `transmission_method` | text | INTERNET, SMS, SATELLITE |
| `first_name` | text | Prénom (ou "Simulated" pour nos tests) |
| `last_name` | text | Nom (ou device_id pour nos simulations) |
| `blood_type` | text | Groupe sanguin |
| `allergies` | text | Allergies |
| `medical_conditions` | text | Antécédents médicaux |
| `current_condition` | text | État actuel |
| `created_at` | timestamp | Date de création |

### Table `api_keys`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant |
| `client_name` | VARCHAR(255) | Nom du client (unique) |
| `key_hash` | VARCHAR(64) | Hash SHA-256 de la clé API |
| `is_active` | BOOLEAN | Clé active/révoquée |
| `rate_limit` | INTEGER | Limite requêtes/heure (pas encore implémenté côté serveur) |
| `created_at` | TIMESTAMP | Création |
| `last_used_at` | TIMESTAMP | Dernière utilisation |


## Priority Ranking Model

### Architecture hybride (3 niveaux de fallback)

```
Alerte SOS → Gemini API  →  Score + Recommandation
                 ↓ échec
             OpenRouter  →  Score + Recommandation
                 ↓ échec
             Local (σ)   →  Score + Recommandation (règles)
```

### Niveau 1 : LLM Google Gemini

Modèles essayés dans l'ordre : `gemini-2.5-flash`, `gemini-2.0-flash`

Le prompt inclut toutes les données capteurs, le dossier médical, et les règles de scoring. Le LLM retourne un JSON avec `priority_score` (0-100) et `ai_recommendation`.

### Niveau 2 : LLM OpenRouter

Modèles gratuits :
- `meta-llama/llama-3.2-3b-instruct:free`
- `nousresearch/hermes-3-llama-3.1-405b:free`
- `google/gemma-2-9b-it:free`

### Niveau 3 : Régression logistique locale

6 features → sigmoid → score 0-100

| Feature | Poids | Extraction |
|---------|-------|------------|
| crash_detected | 3.2 | Booléen capteur |
| fall_detected | 2.0 | Booléen capteur |
| inactivity | 1.5 | Booléen capteur |
| battery_critical | 1.0 | battery < 20 |
| medical_risk | 1.4 | Mots-clés dans medical_conditions |
| notes_critical | 1.6 | Mots-clés critiques dans les notes |
| biais | -1.2 | Constant |

```
score = sigmoid(Σ feature_i × poids_i + biais) × 100
```


## Rescue Recommendation Logic

Système expert à base de règles (`generateRecommendation()`).

### Règles de diagnostic

| Condition capteurs | Diagnostic généré |
|-------------------|-------------------|
| crash_detected | 🚨 URGENCE CRASH : décélération violente |
| fall + inactivity | ⚠️ URGENCE CHUTE & IMMOBILITÉ |
| fall seule | ⚠️ ALERTE CHUTE |
| inactivity seule | ℹ️ ANOMALIE D'INACTIVITÉ |
| aucun capteur | 🆘 SOS MANUEL |

### Règles médicales

| Pathologie détectée | Instruction |
|--------------------|-------------|
| Diabète | Contrôle glycémique + sucre d'urgence |
| Cardiaque / hypertension | Défibrillateur DSA + surveillance cardiaque |
| Asthme / respiratoire | Inhalateurs + bouteille O2 |
| Allergies signalées | Alerte médecin régulateur avant injection |
| Autre pathologie | Adapter la prise en charge |

### Zones géographiques (Vietnam)

| Zone | Coordonnées | Instruction |
|------|-------------|-------------|
| Da Nang (Centre) | 15.9-16.2 / 108.0-108.3 | Accès maritime ou routier côtier |
| Hanoi (Nord) | 20.8-21.2 / 105.6-106.0 | Patrouilles motos (axes saturés) |
| HCMC (Sud) | 10.6-10.9 / 106.5-107.0 | Temps accru en heures de pointe |
| Hors zone | Autres | Guidage GPS par coordonnées brutes |


## Authentification

Voir [SECURITY.md](./SECURITY.md) pour les détails complets.

Résumé :
- Clé API via header `X-API-Key` ou `Authorization: Bearer`
- Hash SHA-256 comparé en BDD (table `api_keys`)
- Raccourci : clé globale dans `API_KEY` du `.env.local` (skip la BDD)


## Codes d'erreur

| Code | Message | Cause |
|------|---------|-------|
| 200 | OK | Requête réussie |
| 201 | Created | Alerte ingérée |
| 400 | Missing event ID | PATCH sans champ `id` |
| 401 | Missing API key | Header absent |
| 401 | Invalid or inactive API key | Clé invalide ou désactivée |
| 500 | Internal error | Erreur serveur (Supabase, parsing, etc.) |
| 503 | Authentication service unavailable | Supabase inaccessible |
