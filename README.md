Résumé de la première intéraction :

On fait un autre projet indépendant et quand on le finit, on le connecte au projet de andhy etc...

Consignes :

Un système boosté à l'IA qui prend en entré des Informations liées aux SOS de l'app d'andhy
et qui renvoi des informations réelles et des recommandation a suivre selon les signaux

Technologies utilisées :

Dashboard : NextJS, Supabase

AI : Rule-based, Machine Learning Local Model, LLM Cloud-based Model
Pour l'instant : Moteur RescueAI Local (Arbre de décision, Heuristiques pondérées, Analyse multi-facteurs)

Firt week work

- We look how to receive SOSApp Infos
- We Create API to receive the informations

# ERIS-RescueAI

> Plateforme backend d'ingestion, de filtrage, d'analyse et de priorisation des alertes SOS — composant d'intelligence du projet ERIS (Emergency Response & Intelligence System).

---

## Vue d'ensemble du projet

Ce projet constitue la plateforme centrale de traitement des signaux d'urgence envoyés par l'application mobile et les boîtiers matériels du projet ERIS. Il propose :

1. **Une API REST robuste** pour ingérer en temps réel les données de géolocalisation et les mesures de capteurs des appareils.
2. **Un moteur d'évaluation automatisé** (IA à base de règles) qui détermine la priorité des alertes, filtre les doublons et formule des recommandations d'urgence actionnables pour les secouristes.
3. **Un tableau de bord opérateur** pour visualiser, filtrer et gérer les alertes en cours.
4. **Un simulateur d'API intégré** permettant de tester l'intégration bout en bout sans nécessiter d'appareil physique.

---

## Fonctionnalités Clés

### 1. Ingestion de Données (API)

- **Point d'accès** : `POST /api/sos/ingest`
- Reçoit l'identifiant de l'appareil (`device_id`), la position géographique (`lat`, `lng`) et les données brutes des capteurs (`sensor_data` contenant la batterie, la détection de chute, de crash routier et d'inactivité).

### 2. Filtrage des Doublons

- Si le même appareil émet plusieurs alertes successives dans un intervalle de **2 minutes**, l'API marque automatiquement le signal comme doublon (`is_duplicate: true`) afin d'éviter la surcharge d'alertes inutiles sur la console de contrôle.

### 3. Moteur de Priorisation & Analyse d'Urgence (Rule-based AI)

- Chaque SOS est évalué sur un score de priorité de **0 à 100** selon les critères suivants :
  - **Force d'impact** : Léger, Élevé (+20), Extrême (+35).
  - **Crash automobile** : Détection G-Sensor de choc routier (+35).
  - **Chute brutale** : Détectée par accéléromètre (+25).
  - **Inactivité prolongée** : Absence de mouvement de l'utilisateur (+15).
  - **État de batterie** : Niveau critique inférieur à 20% (+15).
- Génération automatique de **recommandations d'action en français** spécifiques aux signaux de détresse (ex: déploiement de secours routier, ambulance pour traumatisme crânien, appel de levée de doute).

### 4. Console Opérateur (Dashboard)

- Statuts de traitement : **En attente (Pending)**, **En cours (In Progress)**, et **Résolu (Resolved)**.
- Tri et recherche textuelle avancée par ID d'appareil ou contenu analytique.
- Visualisation instantanée de l'état technique de l'alerte (batterie, force de choc, type d'accident).
- Liens de géolocalisation directe vers Google Maps.

### 5. Simulateur SOS Interactif

- Formulaire d'envoi SOS intégré pour tester l'API.
- Préréglages d'urgences types : **Chute grave**, **Accident automobile majeur**, et **SOS manuel**.

---

## Guide d'Installation et Lancement

### Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- Fichier `.env.local` configuré dans le dossier `eris-rescueai` contenant les variables d'accès Supabase :
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```

### Lancement en local

1. Ouvrez votre terminal et placez-vous dans le répertoire du projet Next.js :
   ```bash
   cd eris-rescueai
   ```
2. Installez les dépendances du projet :
   ```bash
   npm install
   ```
3. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```
4. Accédez au tableau de bord via votre navigateur sur [http://localhost:3000](http://localhost:3000).

---

## Architecture de l'API SOS

### 1. Ingestion de Signal (POST `/api/sos/ingest`)

Exemple de payload envoyé par l'application cliente :

```json
{
  "device_id": "device-mobile-xyz",
  "lat": 16.0544,
  "lng": 108.2022,
  "sensor_data": {
    "battery": 15,
    "impact": "high",
    "fall_detected": true,
    "crash_detected": false,
    "inactivity": true
  }
}
```

### 2. Gestion de Flux (GET/PATCH `/api/sos/events`)

- **GET** : Récupère la liste ordonnée de tous les signaux enregistrés.
- **PATCH** : Met à jour le statut ou le flag de doublon d'un signal spécifique via son ID UUID.

---

## Architecture & Évolution de l'IA

Toute la logique d'analyse et de génération de recommandations personnalisées du système est centralisée dans **un seul fichier** :
👉 [localAiEngine.js](./eris-rescueai/lib/ai/localAiEngine.js)

Cette centralisation offre une grande flexibilité pour les étapes futures du projet :
1. **Facilité de modification** : La logique actuelle d'arbre de décision et d'heuristiques locales peut être ajustée rapidement dans ce fichier unique.
2. **Intégration d'un LLM existant** : Nous prévoyons d'expérimenter avec un modèle de langage (LLM) externe déjà existant (comme Gemini ou OpenAI) pour générer des diagnostics encore plus fluides.
3. **Création de notre propre IA** : À terme, nous souhaitons concevoir et entraîner notre propre modèle d'IA local.

Grâce à cette abstraction, toute modification ou changement complet de technologie d'IA se fera uniquement dans ce fichier, sans nécessiter de retoucher aux API d'ingestion, à la base de données Supabase ou à l'interface graphique.

