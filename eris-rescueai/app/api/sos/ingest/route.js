import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const body = await request.json();
    const deviceId = body.device_id || 'unknown-device';
    const lat = body.lat || 0;
    const lng = body.lng || 0;
    const sensorData = body.sensor_data || {};

    // 1. Duplicate Detection (check if same device sent an alert in the last 2 minutes)
    let isDuplicate = false;
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentEvents } = await supabase
        .from('sos_events')
        .select('id')
        .eq('device_id', deviceId)
        .gt('created_at', twoMinutesAgo)
        .limit(1);

      if (recentEvents && recentEvents.length > 0) {
        isDuplicate = true;
      }
    } catch (err) {
      console.warn("Failed to check duplicate events:", err);
    }

    // 2. Rule-Based Triage / AI Priority Scoring
    let priorityScore = 15;
    const reasons = [];

    const impact = sensorData.impact || '';
    const battery = sensorData.battery !== undefined ? Number(sensorData.battery) : 100;
    const fallDetected = sensorData.fall_detected === true || sensorData.fall_detected === 'true';
    const crashDetected = sensorData.crash_detected === true || sensorData.crash_detected === 'true';
    const inactivity = sensorData.inactivity === true || sensorData.inactivity === 'true';

    if (impact === 'high') {
      priorityScore += 20;
      reasons.push("Impact élevé");
    } else if (impact === 'extreme') {
      priorityScore += 35;
      reasons.push("Impact extrême");
    }

    if (crashDetected) {
      priorityScore += 35;
      reasons.push("Crash véhicule");
    }

    if (fallDetected) {
      priorityScore += 25;
      reasons.push("Chute détectée");
    }

    if (inactivity) {
      priorityScore += 15;
      reasons.push("Inactivité prolongée");
    }

    if (battery < 20) {
      priorityScore += 15;
      reasons.push(`Batterie faible (${battery}%)`);
    }

    priorityScore = Math.min(priorityScore, 100);

    // 3. Generate Actionable AI Recommendations (French)
    let aiRecommendation = '';
    if (crashDetected) {
      aiRecommendation = `🚨 ALERTE CRASH VÉHICULE : Décélération violente détectée (${reasons.join(', ')}). Priorité maximale. Dépêcher immédiatement les services d'urgence routière avec équipement de désincarcération.`;
    } else if (fallDetected && inactivity) {
      aiRecommendation = `⚠️ URGENCE CHUTE & INACTIVITÉ : Chute brutale suivie d'une immobilité prolongée. Suspicion de traumatisme crânien ou perte de connaissance. Envoyer une ambulance en urgence absolue.`;
    } else if (fallDetected) {
      aiRecommendation = `⚠️ ALERTE CHUTE : Chute détectée. L'utilisateur bouge encore mais peut être blessé. Contacter l'utilisateur par téléphone pour confirmation ou envoyer une équipe de secours.`;
    } else if (inactivity) {
      aiRecommendation = `ℹ️ INACTIVITÉ SUSPECTE : Absence de mouvement. Vérifier l'état de santé du porteur ou s'il s'agit d'un oubli d'appareil.`;
    } else {
      aiRecommendation = `🆘 SOS MANUEL : Alerte déclenchée volontairement par l'utilisateur. Procéder aux appels de levée de doute et déployer les secours de secteur si injoignable.`;
    }

    if (battery < 20) {
      aiRecommendation += ` (Note: Batterie critique à ${battery}%. Risque de coupure de signal imminent.)`;
    }

    if (isDuplicate) {
      aiRecommendation = `[DOUBLON FILTRÉ] ` + aiRecommendation;
    }

    // 4. Insert into Supabase
    const { data, error } = await supabase
      .from('sos_events')
      .insert([
        {
          device_id: deviceId,
          latitude: lat,
          longitude: lng,
          raw_payload: sensorData,
          is_duplicate: isDuplicate,
          priority_score: priorityScore,
          status: 'pending',
          ai_recommendation: aiRecommendation
        }
      ])
      .select(); 

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'SOS received & classified', data: data }, { status: 201 });
    
  } catch (error) {
    console.error("Ingestion Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}