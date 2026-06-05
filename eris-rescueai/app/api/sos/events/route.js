import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Pointing to the other team's database 'sos_alerts'
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Map 'sos_alerts' rows to the format expected by the RescueAI operator dashboard
    const mappedData = data.map((alert, index) => {
      const notesLower = (alert.notes || '').toLowerCase();
      
      // 1. Detect sensor flags based on notes content
      const crashDetected = notesLower.includes('crash') || notesLower.includes('accident');
      const fallDetected = notesLower.includes('fall') || notesLower.includes('chute');
      const inactivity = notesLower.includes('inactivity') || notesLower.includes('immobilit');
      const shakeDetected = notesLower.includes('shake') || notesLower.includes('secousse');

      let impact = 'none';
      if (notesLower.includes('extreme') || notesLower.includes('extrême')) {
        impact = 'extreme';
      } else if (notesLower.includes('high') || notesLower.includes('élevé') || crashDetected || fallDetected) {
        impact = 'high';
      } else if (notesLower.includes('low') || notesLower.includes('faible')) {
        impact = 'low';
      }

      // 2. Dynamic duplicate check (2-minute window for the same user)
      const twoMinutes = 2 * 60 * 1000;
      const isDuplicate = data.some((otherAlert, otherIndex) => {
        if (otherIndex === index) return false;
        if (otherAlert.user_id !== alert.user_id) return false;
        const timeDiff = Math.abs(new Date(alert.created_at) - new Date(otherAlert.created_at));
        return timeDiff < twoMinutes && new Date(otherAlert.created_at) < new Date(alert.created_at);
      });

      // 3. Rule-Based Triage Score Calculation
      let priorityScore = 15;
      const reasons = [];

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

      if (alert.battery_level !== null && alert.battery_level !== undefined && alert.battery_level < 20) {
        priorityScore += 15;
        reasons.push(`Batterie faible (${alert.battery_level}%)`);
      }

      priorityScore = Math.min(priorityScore, 100);

      // 4. Generate French AI Recommendation
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
        const sourceStr = shakeDetected ? 'secousse de l\'appareil' : 'bouton SOS';
        aiRecommendation = `🆘 SOS MANUEL : Alerte déclenchée volontairement par l'utilisateur via ${sourceStr}. Procéder aux appels de levée de doute et déployer les secours de secteur si injoignable.`;
      }

      if (alert.battery_level !== null && alert.battery_level !== undefined && alert.battery_level < 20) {
        aiRecommendation += ` (Note: Batterie critique à ${alert.battery_level}%. Risque de coupure de signal imminent.)`;
      }

      if (isDuplicate) {
        aiRecommendation = `[DOUBLON FILTRÉ] ` + aiRecommendation;
      }

      // Add medical metadata to recommendations if available
      if (alert.medical_conditions && alert.medical_conditions !== 'None') {
        aiRecommendation += ` [Médical: ${alert.medical_conditions}]`;
      }
      if (alert.blood_type && alert.blood_type !== 'Unknown') {
        aiRecommendation += ` [Groupe Sanguin: ${alert.blood_type}]`;
      }

      return {
        id: alert.id,
        device_id: `${alert.first_name || 'Abonné'} ${alert.last_name || (alert.user_id ? alert.user_id.slice(0, 8) : 'Unknown')}`,
        latitude: alert.latitude,
        longitude: alert.longitude,
        timestamp: alert.created_at,
        created_at: alert.created_at,
        raw_payload: {
          battery: alert.battery_level,
          altitude: alert.altitude,
          notes: alert.notes,
          first_name: alert.first_name,
          last_name: alert.last_name,
          blood_type: alert.blood_type,
          allergies: alert.allergies,
          medical_conditions: alert.medical_conditions,
          current_condition: alert.current_condition,
          transmission_method: alert.transmission_method
        },
        is_duplicate: isDuplicate,
        priority_score: priorityScore,
        status: alert.status,
        ai_recommendation: aiRecommendation
      };
    });

    return NextResponse.json({ success: true, data: mappedData }, { status: 200 });
  } catch (error) {
    console.error("Fetch Events Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing event ID' }, { status: 400 });
    }

    const allowedUpdates = {};
    if ('status' in updates) allowedUpdates.status = updates.status;

    const { data, error } = await supabase
      .from('sos_alerts')
      .update(allowedUpdates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Alert updated', data }, { status: 200 });
  } catch (error) {
    console.error("Update Event Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

