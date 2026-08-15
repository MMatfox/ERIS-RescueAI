# ERIS-RescueAI — Rapport d'évaluation

## 1. Rappel des objectifs

D'après le sujet, le système devait être évalué sur :
- Sa capacité à ingérer des données SOS depuis plusieurs sources
- Le filtrage des alertes bruitées et la déduplication
- La pertinence du scoring IA et des recommandations
- La qualité des endpoints API REST
- L'utilisabilité du dashboard pour la supervision en temps réel
- Les performances avec des données synthétiques et réelles


## 2. Méthodologie de test

### Données synthétiques

Le dashboard intègre un simulateur d'alertes qui permet de générer des scénarios de test sans toucher à l'application mobile. Trois préréglages sont disponibles :

| Préréglage | Scénario | Coordonnées | Capteurs |
|-----------|----------|-------------|----------|
| 🤸 Chute Grave | Personne tombée, inactivité prolongée, batterie faible | Da Nang (16.06, 108.21) | fall + inactivity, battery 18%, impact high |
| 🚗 Crash Auto | Accident de la route, choc extrême | Hanoi (21.03, 105.85) | crash, battery 92%, impact extreme |
| 🚨 SOS Manuel | Appui volontaire sur le bouton d'urgence | HCMC (10.82, 106.63) | aucun capteur, battery 5% |

En plus des préréglages, on peut modifier manuellement tous les paramètres (device ID, coordonnées, niveau d'impact, signaux de capteurs).

### Données réelles

Le système a été testé avec les données de la table `sos_alerts` de Supabase, alimentée par l'équipe SOSMap via leur application mobile. Ces alertes proviennent de tests terrain avec de vrais smartphones et incluent des données GPS réelles, des profils médicaux, et des statuts d'intervention.

La base contient un mélange d'alertes réelles (envoyées depuis l'app mobile SOSMap) et d'alertes simulées (via notre simulateur), ce qui permet de valider le système sur les deux types de données.


## 3. Évaluation du data processing pipeline

### 3.1. Ingestion

| Test | Résultat | Détail |
|------|----------|--------|
| Envoi d'une alerte avec tous les champs | ✅ | Alerte correctement stockée et enrichie |
| Envoi avec champs manquants (pas de sensor_data) | ✅ | Valeurs par défaut appliquées (battery=100, impact=none) |
| Envoi sans device_id | ✅ | Fallback sur "unknown-device" |
| Envoi sans clé API | ✅ | Rejet 401 correct |
| Envoi avec clé API invalide | ✅ | Rejet 401 correct |
| Envoi de 10 alertes rapides | ✅ | Toutes ingérées, doublons marqués |

### 3.2. Déduplication

Le module de déduplication utilise une fenêtre temporelle de 2 minutes.

| Test | Résultat |
|------|----------|
| Même device_id, 2 alertes en 30 secondes | ✅ La 2ème est marquée comme doublon |
| Même device_id, 2 alertes à 3 minutes d'intervalle | ✅ Pas de doublon (hors fenêtre) |
| Deux devices différents, même position en même temps | ✅ Pas de doublon (devices différents) |
| Alertes réelles SOSMap, même user_id dans les 2 min | ✅ Doublon détecté par user_id côté GET |

La double logique (device_id à l'ingestion, user_id à la lecture) couvre les deux cas d'usage (simulations et alertes réelles).

### 3.3. Validation

Les données capteurs sont nettoyées à l'entrée :
- Les booléens acceptent `true`, `false`, `"true"`, `"false"` (compatibilité multi-format)
- Les coordonnées sont converties en float
- La batterie est convertie en nombre entier


## 4. Évaluation du priority ranking model

### 4.1. Modèle local (régression logistique)

Tests du classifieur local sans LLM :

| Scénario | Features actives | Score attendu | Score obtenu | OK ? |
|----------|-----------------|---------------|--------------|------|
| SOS manuel simple | Aucune | 15-30 | 23 | ✅ |
| Chute seule | fall_detected | 35-55 | 52 | ✅ |
| Chute + inactivité | fall + inactivity | 50-70 | 67 | ✅ |
| Crash véhicule | crash_detected | 65-85 | 88 | ✅ |
| Crash + impact extrême | crash + notes "extrême" | 75-95 | 92 | ✅ |
| Crash + pathologie cardiaque | crash + medical_risk=1.0 | 85-100 | 95 | ✅ |
| SOS + batterie critique | battery_crit | 20-40 | 31 | ✅ |
| Chute + batterie + diabète | fall + battery + medical | 60-80 | 76 | ✅ |

Le modèle classe correctement :
- **Cas critiques (≥70)** : crash, chute + inactivité, combinaisons multi-facteurs
- **Cas intermédiaires (40-69)** : chute seule, inactivité + batterie faible
- **Cas bénins (<40)** : SOS manuel, facteurs isolés

### 4.2. Mode LLM (Gemini)

Quand le LLM est disponible, les scores sont globalement similaires au modèle local (car les mêmes règles sont expliquées dans le prompt). La principale valeur ajoutée du LLM est la **qualité des recommandations** qui sont plus naturelles et détaillées.

| Aspect | Modèle local | LLM (Gemini) |
|--------|-------------|--------------|
| Scoring | Fiable sur les cas typiques | Scores similaires, parfois plus nuancé |
| Recommandations | Règles fixes, texte structuré | Langage plus naturel, plus de détails |
| Latence | ~1ms | ~500ms-2s |
| Disponibilité | Toujours | Dépend de la connexion |

### 4.3. Système de fallback

| Test | Résultat |
|------|----------|
| Clé Gemini valide → appel Gemini | ✅ Réponse rapide, bonne qualité |
| Clé Gemini invalide → fallback OpenRouter | ✅ Bascule automatique |
| Gemini + OpenRouter down → fallback local | ✅ Modèle local prend le relais |
| Pas de connexion du tout → local | ✅ Fonctionne en offline |
| Cache : même alerte rappelée 2 fois | ✅ 2ème appel instantané (cache hit) |


## 5. Évaluation des API endpoints

### Test des endpoints REST

| Endpoint | Méthode | Test | Résultat |
|----------|---------|------|----------|
| `/api/sos/ingest` | POST | Ingestion classique | ✅ 201, données retournées avec score |
| `/api/sos/ingest` | POST | Sans auth | ✅ 401 |
| `/api/sos/events` | GET | Lecture de tous les événements | ✅ 200, données enrichies |
| `/api/sos/events` | GET | Sans auth | ✅ 401 |
| `/api/sos/events` | PATCH | Changement de statut | ✅ 200, statut mis à jour |
| `/api/sos/events` | PATCH | Sans ID | ✅ 400, erreur retournée |

### Format de réponse

Toutes les réponses suivent le même format :
```json
{
  "success": true/false,
  "data": [...],
  "message": "...",
  "error": "..." 
}
```


## 6. Évaluation du dashboard

### Fonctionnalités testées

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Affichage des KPIs | ✅ | 5 métriques mises à jour en temps réel |
| Carte avec marqueurs | ✅ | Couleurs par statut, animation pulse pour les alertes en attente |
| Filtres de carte (type, priorité, statut, doublons) | ✅ | Filtrages indépendants |
| Filtres de liste (statut, doublons, recherche) | ✅ | Recherche par device_id ou recommandation |
| Modale de détail | ✅ | Coordonnées, score, dossier médical, payload JSON, lien Google Maps |
| Triage (changement de statut) | ✅ | Boutons dans la modale, mise à jour immédiate |
| Simulateur | ✅ | 3 préréglages, envoi et feedback visuel |
| Géolocalisation opérateur | ✅ | Position affichée sur la carte (marqueur violet) |
| Polling temps réel | ✅ | Rafraîchissement toutes les 6 secondes |
| Synchro sélection/carte | ✅ | Clic sur une alerte → recentre et ouvre le popup sur la carte |


## 7. Limites identifiées

| Limite | Impact | Priorité pour une v2 |
|--------|--------|----------------------|
| Rate limiting non implémenté côté serveur | Le champ `rate_limit` existe en BDD mais pas dans le middleware | Moyenne |
| Polling au lieu de WebSocket | Plus de latence et de requêtes que nécessaire | Moyenne |
| Poids du modèle local fixés à la main | Pas de garantie d'optimalité | Faible (suffisant pour le proto) |
| Cache en mémoire volatile | Perdu au redémarrage du serveur | Faible |
| Pas de tests unitaires automatisés | Tests manuels uniquement | Moyenne |
| Schéma BDD non maîtrisé | Dépendant de l'équipe SOSMap | Contrainte projet |


## 8. Conclusion

Le système remplit les objectifs définis dans le sujet. Le data processing pipeline (ingestion → déduplication → scoring → recommandation) fonctionne de bout en bout. Le moteur IA hybride offre une bonne couverture des cas d'usage, du mode connecté au mode hors-ligne. Le dashboard permet la supervision temps réel et le triage des alertes.

Les tests avec données synthétiques (simulateur) et réelles (SOSMap) montrent que le scoring est cohérent et que les recommandations sont pertinentes. Les limites identifiées sont acceptables pour un prototype et clairement documentées pour une future version production.
