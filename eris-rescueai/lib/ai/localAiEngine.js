 // Calcul de la priorité (0-100) selon les capteurs et l'historique médical
export function calculatePriorityScore(sensorData, batteryLevel, medicalConditions) {
  let score = 15;

  const impact = sensorData.impact || 'none';
  const crashDetected = sensorData.crash_detected === true || sensorData.crash_detected === 'true';
  const fallDetected = sensorData.fall_detected === true || sensorData.fall_detected === 'true';
  const inactivity = sensorData.inactivity === true || sensorData.inactivity === 'true';

  // 1. Capteurs physiques (accéléromètre, chute, etc.)
  if (impact === 'low') {
    score += 5;
  } else if (impact === 'high') {
    score += 20;
  } else if (impact === 'extreme') {
    score += 35;
  }

  if (crashDetected) score += 35;
  if (fallDetected) score += 25;
  if (inactivity) score += 15;

  // 2. Bonus si la batterie est critique
  if (batteryLevel !== null && batteryLevel !== undefined && batteryLevel < 20) {
    score += 15;
  }

  // 3. Boost de priorité pour les pathologies à risque
  if (medicalConditions && medicalConditions !== 'None' && medicalConditions !== 'Unknown') {
    const medLower = medicalConditions.toLowerCase();
    if (
      medLower.includes('cardiaque') ||
      medLower.includes('coeur') ||
      medLower.includes('avc') ||
      medLower.includes('asthme') ||
      medLower.includes('diabète') ||
      medLower.includes('diabetes')
    ) {
      score += 15; 
    } else {
      score += 5; 
    }
  }

  return Math.min(score, 100);
}

// Génère la recommandation d'urgence (en français) pour les secouristes
export function generateRecommendation(alert) {
  const sensorData = alert.raw_payload || {};
  const notesLower = (alert.notes || '').toLowerCase();
  
  const crashDetected = 
    sensorData.crash_detected === true || 
    sensorData.crash_detected === 'true' || 
    notesLower.includes('crash') || 
    notesLower.includes('accident');

  const fallDetected = 
    sensorData.fall_detected === true || 
    sensorData.fall_detected === 'true' || 
    notesLower.includes('fall') || 
    notesLower.includes('chute');

  const inactivity = 
    sensorData.inactivity === true || 
    sensorData.inactivity === 'true' || 
    notesLower.includes('inactivity') || 
    notesLower.includes('immobilit');

  const shakeDetected = 
    sensorData.shake_detected === true || 
    notesLower.includes('shake') || 
    notesLower.includes('secousse');

  const impact = sensorData.impact || alert.impact || 'none';
  const battery = alert.battery_level !== undefined && alert.battery_level !== null ? alert.battery_level : (sensorData.battery || 100);
  
  const bloodType = alert.blood_type || sensorData.blood_type || 'Unknown';
  const allergies = alert.allergies || sensorData.allergies || 'None';
  const medicalConditions = alert.medical_conditions || sensorData.medical_conditions || 'None';
  
  const lat = alert.latitude !== undefined ? Number(alert.latitude) : 0;
  const lng = alert.longitude !== undefined ? Number(alert.longitude) : 0;

  const parts = [];

  // 1. Diagnostic de base selon les capteurs
  if (crashDetected) {
    let crashMsg = "🚨 URGENCE CRASH : Décélération violente détectée.";
    if (impact === 'extreme') {
      crashMsg += " Choc d'intensité extrême (>10G). Risque de polytraumatisme très élevé.";
    } else {
      crashMsg += " Choc important sur véhicule en mouvement.";
    }
    parts.push(crashMsg);
  } else if (fallDetected && inactivity) {
    parts.push("⚠️ URGENCE CHUTE & IMMOBILITÉ : Impact de chute détecté suivi d'une perte totale de mouvement. Risque élevé de perte de connaissance ou de traumatisme crânien.");
  } else if (fallDetected) {
    parts.push("⚠️ ALERTE CHUTE : Une chute a été détectée par l'appareil. Le porteur est actif mais peut présenter des traumatismes.");
  } else if (inactivity) {
    parts.push("ℹ️ ANOMALIE D'INACTIVITÉ : Absence prolongée de mouvements détectée. Perte de conscience possible ou appareil égaré.");
  } else {
    const sourceStr = shakeDetected ? "secousse de l'appareil" : "bouton d'urgence";
    parts.push(`🆘 SOS MANUEL : Alerte déclenchée volontairement par le porteur depuis son ${sourceStr}.`);
  }

  // 2. Instructions spécifiques à son dossier médical
  if (medicalConditions && medicalConditions !== 'None' && medicalConditions !== 'Unknown') {
    const medLower = medicalConditions.toLowerCase();
    let medInstruction = "";

    if (medLower.includes('diabète') || medLower.includes('diabetes') || medLower.includes('diabetique')) {
      medInstruction = "⚠️ PROTOCOLE DIABÈTE : Antécédents de diabète signalés. L'équipe d'intervention doit prévoir un contrôle glycémique rapide et du sucre d'urgence (risque d'hypoglycémie).";
    } else if (medLower.includes('cardiaque') || medLower.includes('coeur') || medLower.includes('hypertension')) {
      medInstruction = "🚨 ALERTE CARDIAQUE : Antécédents cardiovasculaires majeurs. Dépêcher impérativement un défibrillateur (DSA) et préparer une surveillance cardiaque continue.";
    } else if (medLower.includes('asthme') || medLower.includes('respiratoire') || medLower.includes('poumon')) {
      medInstruction = "⚠️ RISQUE RESPIRATOIRE : Asthme ou insuffisance respiratoire. Prévoir inhalateurs/bronchodilatateurs et bouteille d'oxygène.";
    } else {
      medInstruction = `🩺 ANTÉCÉDENTS MÉDICAUX : Pathologie signalée (${medicalConditions}). Adapter la prise en charge médicale.`;
    }
    
    parts.push(medInstruction);
  }

  // Attention aux allergies
  if (allergies && allergies !== 'None' && allergies !== 'Unknown') {
    parts.push(`🚫 ALERTE ALLERGIE : Antécédent d'allergie signalé (${allergies}). Alerter le médecin régulateur avant toute injection ou prescription.`);
  }

  // Groupe sanguin
  if (bloodType && bloodType !== 'Unknown' && bloodType !== 'None') {
    parts.push(`🩸 GROUPE SANGUIN : Patient enregistré sous le groupe ${bloodType}.`);
  }

  // 3. Guidage et spécificités selon la région (Vietnam)
  if (lat !== 0 && lng !== 0) {
    let locStr = "";
    if (lat >= 15.9 && lat <= 16.2 && lng >= 108.0 && lng <= 108.3) {
      locStr = "📍 ZONE : Secteur Centre (Da Nang / littoral). Trafic modéré, accès rapide possible par les axes maritimes ou routiers côtiers.";
    } else if (lat >= 20.8 && lat <= 21.2 && lng >= 105.6 && lng <= 106.0) {
      locStr = "📍 ZONE : Secteur Nord (Hanoi / Métropole). Densité urbaine très élevée, privilégier les patrouilles motos pour franchir les axes saturés.";
    } else if (lat >= 10.6 && lat <= 10.9 && lng >= 106.5 && lng <= 107.0) {
      locStr = "📍 ZONE : Secteur Sud (Ho Chi Minh City). Secteur urbain dense. Prévoir un temps d'acheminement accru en heures de pointe.";
    } else {
      locStr = `📍 ZONE : Position hors zones métropolitaines prioritaires (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}). Utiliser le guidage GPS Rescue par coordonnées brutes.`;
    }
    parts.push(locStr);
  }

  // 4. Alerte batterie faible
  if (battery !== null && battery !== undefined && battery < 20) {
    parts.push(`🔋 BATTERIE CRITIQUE (${battery}%) : Risque imminent d'extinction de l'appareil. Le signal GPS et la transmission des capteurs pourraient cesser d'ici quelques minutes. Lancer immédiatement l'appel téléphonique de secours sur l'appareil.`);
  }

  if (alert.is_duplicate) {
    return "[DOUBLON FILTRÉ] " + parts.join(' ');
  }

  return parts.join(' ');
}

// Cache global pour éviter d'appeler l'API OpenRouter/Ollama en boucle sur les mêmes alertes
if (!global.aiCache) {
  global.aiCache = new Map();
}

// Modèle de neurone Perceptron local (Machine Learning L3)
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function classifyPriorityML(sensorData, batteryLevel, medicalConditions, notes) {
  const f_crash = (sensorData.crash_detected === true || sensorData.crash_detected === 'true' ? 1.0 : 0.0);
  const f_fall = (sensorData.fall_detected === true || sensorData.fall_detected === 'true' ? 1.0 : 0.0);
  const f_inactivity = (sensorData.inactivity === true || sensorData.inactivity === 'true' ? 1.0 : 0.0);
  const f_battery_crit = (batteryLevel !== null && batteryLevel !== undefined && batteryLevel < 20 ? 1.0 : 0.0);
  
  let f_medical_risk = 0.0;
  if (medicalConditions && medicalConditions !== 'None' && medicalConditions !== 'Unknown') {
    const med = medicalConditions.toLowerCase();
    if (med.includes('coeur') || med.includes('cardiaque') || med.includes('diab') || med.includes('asthme') || med.includes('avc')) {
      f_medical_risk = 1.0;
    } else {
      f_medical_risk = 0.3;
    }
  }

  let f_notes_critical = 0.0;
  if (notes) {
    const notesLower = notes.toLowerCase();
    const criticalWords = ['extrême', 'extreme', 'grave', 'sang', 'inconscient', 'fracture', 'douleur', 'accident', 'crash'];
    const count = criticalWords.filter(w => notesLower.includes(w)).length;
    f_notes_critical = Math.min(count * 0.4, 1.0);
  }

  // Poids du modèle entraînés heuristiquement
  const w_bias = -1.2; 
  const w_crash = 3.2;
  const w_fall = 2.0;
  const w_inactivity = 1.5;
  const w_battery = 1.0;
  const w_medical = 1.4;
  const w_notes = 1.6;

  const z = (f_crash * w_crash) + 
            (f_fall * w_fall) + 
            (f_inactivity * w_inactivity) + 
            (f_battery_crit * w_battery) + 
            (f_medical_risk * w_medical) + 
            (f_notes_critical * w_notes) + 
            w_bias;

  const priority = sigmoid(z);
  return Math.min(Math.max(Math.round(priority * 100), 0), 100);
}

// Analyse l'alerte à l'aide d'un LLM si connecté/configuré, sinon utilise le modèle ML Perceptron local
export async function getAlertPriorityAndRecommendation(alert) {
  const cacheKey = alert.id || `${alert.device_id || alert.last_name || 'dev'}-${alert.created_at || alert.timestamp || Date.now()}`;
  
  if (global.aiCache.has(cacheKey)) {
    return global.aiCache.get(cacheKey);
  }

  // 1. Calcul du repli local par défaut (ML Perceptron + Recommandations)
  const localScore = classifyPriorityML(
    alert.raw_payload || {},
    alert.battery_level !== undefined ? alert.battery_level : alert.raw_payload?.battery,
    alert.medical_conditions || alert.raw_payload?.medical_conditions,
    alert.notes || alert.raw_payload?.notes
  );
  
  const preparedAlert = {
    ...alert,
    raw_payload: alert.raw_payload || {
      battery: alert.battery_level,
      medical_conditions: alert.medical_conditions,
    }
  };
  const localRec = "[IA ERIS-RescueAI] " + generateRecommendation(preparedAlert);

  const hasConnection = (alert.transmission_method || alert.raw_payload?.transmission_method || 'INTERNET').toUpperCase() === 'INTERNET';
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const prompt = `
Vous êtes l'intelligence artificielle de ERIS RescueAI Hub. Votre rôle est d'évaluer la priorité d'une alerte d'urgence SOS (de 0 à 100) et de générer une recommandation courte et précise en français pour les secouristes.

Données de l'alerte :
- Device ID / Nom : ${alert.device_id || alert.last_name || 'Inconnu'}
- Transmission : ${alert.transmission_method || alert.raw_payload?.transmission_method || 'INTERNET'}
- Niveau de batterie : ${alert.battery_level !== undefined ? alert.battery_level : alert.raw_payload?.battery || 100}%
- Impact détecté : ${alert.raw_payload?.impact || 'aucun'}
- Chute détectée : ${alert.raw_payload?.fall_detected ? 'Oui' : 'Non'}
- Accident routier (Crash) : ${alert.raw_payload?.crash_detected ? 'Oui' : 'Non'}
- Inactivité : ${alert.raw_payload?.inactivity ? 'Oui' : 'Non'}
- Antécédents médicaux : ${alert.medical_conditions || alert.raw_payload?.medical_conditions || 'aucun'}
- Allergies : ${alert.allergies || alert.raw_payload?.allergies || 'aucune'}
- Groupe sanguin : ${alert.blood_type || alert.raw_payload?.blood_type || 'inconnu'}
- Notes : ${alert.notes || alert.raw_payload?.notes || ''}

Règles d'évaluation (pour guider votre score) :
- Crash routier ou chute grave suivie d'inactivité : score >= 70 (Critique).
- Batterie critique (<20%) augmente le score.
- Pathologies graves (cardiaque, asthme, diabète) augmentent le score.
- SOS manuel simple sans indicateur critique : 15 à 30.

Répondez STRICTEMENT au format JSON suivant (pas de texte additionnel, pas de markdown, pas de blocs \`\`\`json) :
{
  "priority_score": <nombre entier de 0 à 100>,
  "ai_recommendation": "<votre recommandation concise en français avec emojis>"
}
`;

  const geminiKey = process.env.GEMINI_API_KEY || (openRouterKey && (openRouterKey.startsWith("AIzaSy") || openRouterKey.startsWith("AQ.")) ? openRouterKey : null);

  // Option A : LLM officiel Google Gemini (via Google AI Studio, 100% gratuit et non partagé)
  if (hasConnection && geminiKey) {
    const geminiModels = [
      "gemini-3.5-flash",
      "gemini-2.0-flash"
    ];

    for (const model of geminiModels) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (response.ok) {
          const json = await response.json();
          const content = json.candidates[0].content.parts[0].text.trim();
          const cleanContent = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          const data = JSON.parse(cleanContent);

          const result = {
            priority_score: Math.min(Math.max(parseInt(data.priority_score) || localScore, 0), 100),
            ai_recommendation: data.ai_recommendation || localRec
          };
          global.aiCache.set(cacheKey, result);
          return result;
        } else {
          console.warn(`Gemini API model ${model} error response status: ${response.status}`);
        }
      } catch (err) {
        console.warn(`Échec de l'API Google Gemini avec le modèle ${model}, tentative de bascule...`, err);
      }
    }
  }

  // Option B : LLM via OpenRouter (avec clé API et basculement automatique de modèle gratuit)
  if (hasConnection && openRouterKey && !openRouterKey.startsWith("AIzaSy") && !openRouterKey.startsWith("AQ.")) {
    const freeModels = [
      "meta-llama/llama-3.2-3b-instruct:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "google/gemma-2-9b-it:free"
    ];

    for (const model of freeModels) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "ERIS RescueAI Hub"
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const json = await response.json();
          const content = json.choices[0].message.content.trim();
          const cleanContent = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          const data = JSON.parse(cleanContent);

          const result = {
            priority_score: Math.min(Math.max(parseInt(data.priority_score) || localScore, 0), 100),
            ai_recommendation: data.ai_recommendation || localRec
          };
          global.aiCache.set(cacheKey, result);
          return result;
        } else {
          console.warn(`OpenRouter model ${model} failed with status: ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.warn(`Error calling OpenRouter model ${model}:`, err);
      }
    }
    console.warn("All OpenRouter models failed or were rate-limited. Falling back to local ML model.");
  }

  // Option C : Modèle Machine Learning Perceptron local (100% gratuit, sans clé API, s'exécute pour tout le monde)
  const result = {
    priority_score: localScore,
    ai_recommendation: localRec
  };
  global.aiCache.set(cacheKey, result);
  return result;
}


