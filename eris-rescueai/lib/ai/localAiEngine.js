 // Calcul de la priorité (0-100) selon les capteurs et l'historique médical
export function calculatePriorityScore(sensorData, batteryLevel, medicalConditions) {
  let score = 15; // Base score for any triggered SOS signal 

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
