import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { calculatePriorityScore, generateRecommendation, getAlertPriorityAndRecommendation } from '@/lib/ai/localAiEngine';
import { authenticateApiKey } from '@/lib/auth/middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    // Auth requise
    const auth = await authenticateApiKey(request);
    if (!auth.isValid) {
      return auth.error;
    }

    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Formatage des données pour le dashboard (évaluation asynchrone par LLM/Règles)
    const mappedDataPromises = data.map(async (alert, index) => {
      const notesLower = (alert.notes || '').toLowerCase();
      
      // Extraction du type d'incident à partir des notes
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

      // Évite les doublons : même user dans une fenêtre de 2 minutes
      const twoMinutes = 2 * 60 * 1000;
      const isDuplicate = data.some((otherAlert, otherIndex) => {
        if (otherIndex === index) return false;
        if (otherAlert.user_id !== alert.user_id) return false;
        const timeDiff = Math.abs(new Date(alert.created_at) - new Date(otherAlert.created_at));
        return timeDiff < twoMinutes && new Date(otherAlert.created_at) < new Date(alert.created_at);
      });

      const preparedAlert = {
        ...alert,
        is_duplicate: isDuplicate,
        raw_payload: {
          battery: alert.battery_level,
          impact: impact,
          fall_detected: fallDetected,
          crash_detected: crashDetected,
          inactivity: inactivity,
          shake_detected: shakeDetected
        }
      };

      const { priority_score: priorityScore, ai_recommendation: aiRecommendation } = 
        await getAlertPriorityAndRecommendation(preparedAlert);

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
        status: alert.status === 'delivered' ? 'pending' : (alert.status === 'revoked' ? 'resolved' : alert.status),
        ai_recommendation: aiRecommendation
      };
    });

    const mappedData = await Promise.all(mappedDataPromises);

    return NextResponse.json({ success: true, data: mappedData }, { status: 200 });
  } catch (error) {
    console.error("Fetch Events Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    // Auth requise
    const auth = await authenticateApiKey(request);
    if (!auth.isValid) {
      return auth.error;
    }

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
