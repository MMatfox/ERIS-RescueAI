# ERIS-RescueAI — Rapport Technique Final

## 1. Introduction

Ce rapport décrit le travail réalisé sur le projet **ERIS-RescueAI — Intelligent SOS Data Processing and Emergency Coordination Platform**.

Le problème de départ : pendant une situation d'urgence, de nombreux signaux SOS peuvent être émis en même temps par différents appareils ou utilisateurs. Ces signaux peuvent être redondants, bruités ou incomplets, ce qui ralentit la réponse des secours. L'idée du projet est de construire un backend intelligent capable de recevoir ces données, de filtrer le bruit, de prioriser les cas critiques et de fournir des recommandations d'intervention.

ERIS-RescueAI est la partie backend et dashboard du projet ERIS. Il fonctionne en complément de l'application mobile développée par la deuxième équipe (SOSMap), qui gère l'envoi des alertes et les profils médicaux des utilisateurs. Les deux équipes partagent la même base de données Supabase.


## 2. Objectifs du sujet et réalisation

Le sujet définissait 6 objectifs principaux. Voici comment chacun a été traité :

| # | Objectif | Implémentation | Statut |
|---|----------|---------------|--------|
| 1 | Concevoir et implémenter un serveur backend pour ingérer les données SOS depuis plusieurs sources | API REST Next.js avec endpoint `POST /api/sos/ingest` acceptant les données de n'importe quel appareil/app | ✅ |
| 2 | Développer des modules pour filtrer les alertes bruitées/dupliquées et valider les données | Module de détection de doublons (fenêtre de 2 min), validation des champs obligatoires, nettoyage des données capteurs | ✅ |
| 3 | Créer un système de scoring IA pour évaluer chaque événement SOS | Moteur IA hybride : LLM cloud (Gemini/OpenRouter) + régression logistique locale en fallback | ✅ |
| 4 | Fournir des endpoints API RESTful pour les clients frontend | 3 endpoints REST : ingestion (POST), lecture (GET), mise à jour (PATCH) | ✅ |
| 5 | Implémenter un dashboard pour visualiser les clusters SOS, niveaux de priorité et métriques | Dashboard React avec carte Leaflet, KPIs, filtres, modale de détail, simulateur intégré | ✅ |
| 6 | Tester le système avec des données synthétiques et réelles | Simulateur de scénarios (données synthétiques) + données réelles de la BDD SOSMap | ✅ |


## 3. Scope & Expected Outcomes — Correspondance

Le sujet listait les livrables attendus :

| Livrable attendu | Ce qui a été livré |
|------------------|-------------------|
| Backend application with SOS ingestion APIs | Serveur Next.js avec API d'ingestion, lecture et mise à jour |
| Data processing pipeline (filtering, deduplication, scoring) | Pipeline complet : validation → détection doublons → scoring IA → recommandation |
| Priority ranking models and rescue recommendation logic | Régression logistique (scoring 0-100) + générateur de recommandations contextuelles |
| Web-based Dashboard for real-time situational awareness | Dashboard avec carte, KPIs, filtres, polling temps réel (6s) |
| Documentation for APIs, data models, and system architecture | `API_AI_DOCUMENTATION.md`, `SECURITY.md`, ce rapport |
| Test dataset and evaluation report | `EVALUATION_REPORT.md` avec scénarios synthétiques et données réelles |


## 4. Stack technique

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| Framework | Next.js (App Router) | 16.2.6 | Frontend + backend dans le même projet |
| Frontend | React | 19.2.4 | Imposé par Next.js |
| CSS | Tailwind CSS | 4.x | Prototypage rapide du dashboard |
| Base de données | Supabase (PostgreSQL) | — | Partagée avec l'équipe SOSMap |
| Cartographie | Leaflet | 1.9.4 | Open-source, léger, bien documenté |
| IA (LLM) | Google Gemini / OpenRouter | — | Scoring et recommandations en langage naturel |
| IA (local) | Régression logistique | — | Fallback hors-ligne |
| Auth | Clé API + SHA-256 | — | Sécurisation des endpoints |


## 5. Architecture système

```
┌──────────────────────────────────────────────────────────┐
│                       SOURCES SOS                         │
│   ┌──────────┐  ┌──────────┐  ┌───────────────────┐     │
│   │ App      │  │ Boîtier  │  │ Simulateur        │     │
│   │ Mobile   │  │ IoT SOS  │  │ (intégré au       │     │
│   │ (SOSMap) │  │          │  │  dashboard)       │     │
│   └────┬─────┘  └────┬─────┘  └─────────┬─────────┘     │
└────────┼──────────────┼──────────────────┼───────────────┘
         │              │                  │
         ▼              ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│              API NEXT.JS (Backend)                        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │         Middleware Auth (clé API SHA-256)        │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │          DATA PROCESSING PIPELINE               │     │
│  │                                                  │     │
│  │  1. Validation des données entrantes             │     │
│  │  2. Détection et marquage des doublons           │     │
│  │  3. Scoring de priorité (IA hybride)             │     │
│  │  4. Génération de recommandations                │     │
│  │  5. Stockage en base                             │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │            MOTEUR IA HYBRIDE                     │     │
│  │                                                  │     │
│  │  Niveau 1 : Gemini API (cloud)                   │     │
│  │       ↓ échec                                    │     │
│  │  Niveau 2 : OpenRouter (modèles gratuits)        │     │
│  │       ↓ échec                                    │     │
│  │  Niveau 3 : Régression logistique (local)        │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │POST /ingest │  │GET /events   │  │PATCH /events │    │
│  │(ingestion)  │  │(lecture)     │  │(triage)      │    │
│  └─────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────────┬────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────┐
│           SUPABASE (PostgreSQL)       │
│                                       │
│  ┌─────────────┐  ┌──────────────┐   │
│  │ sos_alerts  │  │ api_keys     │   │
│  │ (partagée   │  │ (auth)       │   │
│  │  SOSMap)    │  │              │   │
│  └─────────────┘  └──────────────┘   │
└──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  DASHBOARD WEB                            │
│                                                           │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ KPIs      │ │ Carte    │ │ Filtres  │ │ Modale    │  │
│  │ (métriques│ │ Leaflet  │ │ statut/  │ │ détail    │  │
│  │  clés)    │ │ (clusters│ │ priorité │ │ + triage  │  │
│  │           │ │  SOS)    │ │          │ │           │  │
│  └───────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                           │
│  Polling temps réel (6 secondes)                          │
└──────────────────────────────────────────────────────────┘
```


## 6. Structure du projet

```
eris-rescueai/
├── app/
│   ├── api/sos/
│   │   ├── ingest/route.js       # Endpoint d'ingestion + pipeline de traitement
│   │   └── events/route.js       # Lecture des alertes + mise à jour statut
│   ├── page.js                   # Dashboard principal (interface opérateur)
│   ├── layout.js                 # Layout racine
│   └── globals.css               # Thème Tailwind
├── components/
│   └── AlertsMap.js              # Carte interactive Leaflet (clusters SOS)
├── lib/
│   ├── ai/
│   │   └── localAiEngine.js      # Moteur IA : scoring + recommandations
│   └── auth/
│       ├── apiKey.js             # Utilitaires clé API (hash SHA-256)
│       └── middleware.js         # Middleware d'authentification
├── scripts/
│   ├── setup-api-keys.js        # Initialisation des clés
│   ├── manage-api-keys.js       # Gestion CRUD des clés
│   ├── create-dev-key.js        # Clé de dev rapide
│   └── test-api-keys.js         # Tests des endpoints
├── API_AI_DOCUMENTATION.md      # Documentation API et IA
├── EVALUATION_REPORT.md         # Rapport d'évaluation
├── SECURITY.md                  # Documentation sécurité
└── TECHNICAL_REPORT.md          # Ce rapport
```


## 7. Data processing pipeline

Le pipeline de traitement des données est le cœur du backend. Quand une alerte SOS arrive sur `POST /api/sos/ingest`, elle passe par les étapes suivantes :

### 7.1. Validation des données

On vérifie que les champs obligatoires sont présents (`device_id`, `lat`, `lng`). Les valeurs manquantes reçoivent des valeurs par défaut (`battery: 100`, `impact: 'none'`). Les booléens des capteurs acceptent les valeurs `true`, `false`, `"true"`, `"false"` pour être compatible avec différents formats d'envoi.

### 7.2. Filtrage et déduplication

Le système détecte les doublons avec une fenêtre temporelle de 2 minutes. Si le même appareil a déjà envoyé une alerte dans les 2 dernières minutes, la nouvelle alerte est marquée comme doublon (`is_duplicate: true`). Elle est quand même stockée (on ne perd pas de données) mais elle est signalée visuellement dans le dashboard.

À la lecture (`GET /events`), une deuxième logique de déduplication s'applique par `user_id` pour couvrir les alertes réelles de SOSMap (qui n'utilisent pas `device_id`).

### 7.3. Scoring de priorité (AI scoring)

Le score de priorité (0-100) est calculé par le moteur IA hybride. Le détail de l'architecture IA est dans la section 8.

### 7.4. Génération de recommandations

Une recommandation textuelle en français est générée pour aider les secouristes au triage. Elle prend en compte le type d'incident, le dossier médical, la zone géographique et l'état de la batterie.

### 7.5. Stockage

L'alerte enrichie (score + recommandation + flag doublon) est insérée dans la table `sos_alerts` de Supabase. La table étant partagée avec SOSMap, on a dû adapter certains champs (le `device_id` est stocké dans `last_name`, un UUID factice est utilisé pour le `user_id` des simulations).


## 8. Priority ranking model — Moteur IA

### 8.1. Architecture hybride

Le moteur IA fonctionne en cascade avec trois niveaux de fallback. C'est un choix de conception lié au contexte d'utilisation : en situation d'urgence au Vietnam, la connexion Internet n'est pas toujours garantie. Le système doit pouvoir scorer les alertes même hors-ligne.

**Niveau 1 — LLM Google Gemini :** Si la clé `GEMINI_API_KEY` est configurée et que l'appareil transmet par Internet, on envoie un prompt structuré à l'API Gemini (modèles `gemini-2.5-flash` puis `gemini-2.0-flash` en fallback). Le LLM produit un score et une recommandation en langage naturel.

**Niveau 2 — LLM OpenRouter :** Si Gemini est indisponible, on essaie des modèles gratuits via OpenRouter (Llama, Hermes, Gemma).

**Niveau 3 — Régression logistique locale :** Si aucune API cloud n'est joignable, un classifieur local prend le relais. C'est une régression logistique à une couche avec 6 features et des poids calibrés manuellement.

### 8.2. Modèle local — Régression logistique

Le modèle local utilise une fonction sigmoïde pour mapper les features d'entrée sur un score entre 0 et 100.

**Features :**

| Feature | Poids | Description |
|---------|-------|-------------|
| `crash_detected` | 3.2 | Crash véhicule détecté par G-sensor |
| `fall_detected` | 2.0 | Chute détectée par accéléromètre |
| `inactivity` | 1.5 | Absence prolongée de mouvement |
| `battery_critical` | 1.0 | Batterie < 20% |
| `medical_risk` | 1.4 | Pathologie à risque dans le dossier médical |
| `notes_critical` | 1.6 | Mots-clés critiques dans les notes |
| biais | -1.2 | Seuil de base |

**Formule :**
```
z = Σ(feature_i × poids_i) + biais
score = sigmoid(z) × 100
sigmoid(x) = 1 / (1 + e^(-x))
```

Les poids n'ont pas été entraînés sur un dataset — ils ont été ajustés à la main pour correspondre aux cas d'usage du projet. Un crash routier seul donne un score > 70, un SOS manuel simple reste < 30.

### 8.3. Rescue recommendation logic

La fonction `generateRecommendation()` est un système expert à base de règles qui produit des instructions pour les secouristes :

- **Diagnostic d'incident** : crash → alerte polytraumatisme, chute + inactivité → risque de perte de connaissance, etc.
- **Protocole médical** : adapté aux antécédents (diabète → contrôle glycémique, cardiaque → défibrillateur)
- **Guidage géographique** : identification de la zone (Da Nang, Hanoi, HCMC) avec conseils d'acheminement
- **Alerte batterie** : si < 20%, prévient que le signal GPS va être perdu

### 8.4. Cache

Un cache en mémoire (`global.aiCache`) évite de rappeler les API pour des alertes déjà traitées. La clé de cache est l'ID de l'alerte.


## 9. Dashboard — Situational awareness

Le dashboard offre une vue temps réel de la situation d'urgence.

### Composants principaux

- **KPIs** : 5 métriques (alertes actives, critiques ≥70, doublons, résolues, total ingestions)
- **Carte Leaflet** : visualisation des clusters SOS avec marqueurs colorés par statut (rouge = en attente, bleu = en cours, vert = résolu, gris = doublon). Filtrage par type d'incident, niveau de priorité et statut.
- **Flux de données** : liste des alertes avec recherche, filtres statut/doublons, score de priorité affiché
- **Modale de détail** : coordonnées GPS (+ lien Google Maps), score de tri, dossier médical, payload JSON brut, boutons de triage
- **Simulateur intégré** : envoi d'alertes synthétiques avec préréglages de scénarios (chute grave, crash auto, SOS manuel)

### Temps réel

Le dashboard interroge l'API toutes les 6 secondes (polling). Si l'événement sélectionné est mis à jour, la modale se rafraîchit automatiquement. La position de l'opérateur est aussi trackée via la géolocalisation du navigateur et affichée sur la carte.


## 10. Sécurité

Voir [SECURITY.md](./SECURITY.md) pour les détails.

Résumé : tous les endpoints sont protégés par clé API. Les clés sont hashées en SHA-256 avant stockage. Le middleware vérifie chaque requête. Des scripts de gestion (création, révocation, listing) sont fournis.


## 11. Work plan — Déroulement réel

Le sujet proposait un planning en 6 phases sur 10 semaines. En pratique, le déroulement a été un peu différent parce qu'on a itéré sur plusieurs aspects en parallèle plutôt que séquentiellement :

| Phase prévue | Ce qui s'est passé |
|-------------|---------------------|
| Phase 1 — Requirements & schema (1 sem.) | Le schéma de BDD était déjà défini par l'équipe SOSMap, on s'est adapté à leur table existante |
| Phase 2 — Backend & API (2 sem.) | Développement des routes API + intégration Supabase. S'est étendu sur plus longtemps à cause des adaptations au schéma SOSMap |
| Phase 3 — Filtering & processing (2 sem.) | Le module de déduplication et le pipeline de traitement ont été développés en même temps que les routes API, pas en phase séparée |
| Phase 4 — Scoring & recommendations (2 sem.) | Le moteur IA hybride (LLM + local) a été itéré progressivement. Les recommandations ont été affinées en continu |
| Phase 5 — Dashboard (2 sem.) | Le dashboard a évolué en parallèle du backend, pas après. La carte et les filtres ont été ajoutés au fur et à mesure |
| Phase 6 — Testing & report (1 sem.) | Tests manuels tout au long du développement + rédaction des rapports à la fin |

Le workplan linéaire n'a pas été strictement suivi — en pratique c'était plus itératif, mais toutes les phases ont été couvertes.


## 12. Intégration inter-équipes (SOSMap)

L'intégration avec l'équipe SOSMap a été un aspect important du projet. Quelques points :

- **Base de données partagée** : on utilise la même instance Supabase et la même table `sos_alerts`. Ça impose des contraintes sur le schéma qu'on ne contrôle pas.
- **Mapping de champs** : le `device_id` de nos simulations est stocké dans `last_name` (pas de champ dédié dans leur schéma). C'est un hack mais ça marche.
- **Harmonisation des statuts** : SOSMap utilise `delivered`/`revoked`, on les convertit en `pending`/`resolved` côté dashboard.
- **Données médicales** : les infos médicales (groupe sanguin, allergies, antécédents) sont renseignées côté SOSMap et exploitées côté RescueAI pour les recommandations.


## 13. Déploiement

```bash
# Dev
npm install
npm run dev            # http://localhost:3000

# Production
npm run build
npm start              # ou déploiement Vercel
```

Variables d'environnement requises dans `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_API_KEY=...
API_KEY=...
GEMINI_API_KEY=...            # optionnel
OPENROUTER_API_KEY=...        # optionnel
```


## 14. Conclusion

Le projet ERIS-RescueAI répond aux objectifs définis dans le sujet. Le backend reçoit les alertes SOS, les filtre, les score et les présente sur un dashboard de supervision. L'architecture IA hybride permet de fonctionner en conditions normales comme en mode dégradé. L'intégration avec SOSMap fonctionne malgré les contraintes de schéma partagé.

Les limites principales sont l'absence de rate limiting effectif, le polling au lieu de WebSocket, et les poids du modèle local ajustés manuellement. Ces points sont détaillés dans le rapport d'évaluation.
