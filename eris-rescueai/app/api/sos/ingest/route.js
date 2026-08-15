import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAlertPriorityAndRecommendation } from '@/lib/ai/localAiEngine';
import { authenticateApiKey } from '@/lib/auth/middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    // Auth requise
    const auth = await authenticateApiKey(request);
    if (!auth.isValid) {
      return auth.error;
    }

    const body = await request.json();
    const deviceId = body.device_id || 'unknown-device';
    const lat = body.lat || 0;
    const lng = body.lng || 0;
    const sensorData = body.sensor_data || {};

    // Anti-spam/doublon de l'appareil (fenêtre de 2min)
    let isDuplicate = false;
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentAlerts } = await supabase
        .from('sos_alerts')
        .select('id')
        .eq('last_name', deviceId)
        .gt('created_at', twoMinutesAgo)
        .limit(1);

      if (recentAlerts && recentAlerts.length > 0) {
        isDuplicate = true;
      }
    } catch (err) {
      console.warn("Failed to check duplicate events:", err);
    }

    const battery = sensorData.battery !== undefined ? Number(sensorData.battery) : 100;
    const fallDetected = sensorData.fall_detected === true || sensorData.fall_detected === 'true';
    const crashDetected = sensorData.crash_detected === true || sensorData.crash_detected === 'true';
    const inactivity = sensorData.inactivity === true || sensorData.inactivity === 'true';

    // Génère une note auto selon les triggers reçus
    let notes = 'Manual SOS alert triggered';
    if (crashDetected) {
      notes = 'AUTOMATIC SOS: VEHICLE CRASH CONFIRMED';
    } else if (fallDetected && inactivity) {
      notes = 'AUTOMATIC SOS: FALL & PROLONGED INACTIVITY DETECTED';
    } else if (fallDetected) {
      notes = 'AUTOMATIC SOS: FALL CONFIRMED';
    } else if (inactivity) {
      notes = 'AUTOMATIC SOS: PROLONGED IMMOBILITY';
    }

    if (sensorData.impact && sensorData.impact !== 'none') {
      notes += ` (Impact: ${sensorData.impact})`;
    }

    const preparedAlert = {
      latitude: lat,
      longitude: lng,
      battery_level: battery,
      is_duplicate: isDuplicate,
      notes: notes,
      blood_type: 'O+',
      allergies: 'None',
      medical_conditions: 'None',
      raw_payload: sensorData
    };

    const { priority_score: priorityScore, ai_recommendation: aiRecommendation } = 
      await getAlertPriorityAndRecommendation(preparedAlert);

    // On réutilise la table sos_alerts de l'équipe SOSMap, donc on mappe
    // le device_id dans last_name (pas de colonne dédiée dans leur schéma)
    const { data, error } = await supabase
      .from('sos_alerts')
      .insert([
        {
          user_id: 'd9999999-e999-f999-a999-b99999999999', // UUID factice pour les alertes simulées
          latitude: lat,
          longitude: lng,
          altitude: 0,
          battery_level: battery,
          notes: notes,
          status: 'pending',
          transmission_method: 'INTERNET',
          first_name: 'Simulated',
          last_name: deviceId,
          blood_type: 'O+',
          allergies: 'None',
          medical_conditions: 'None',
          current_condition: 'Healthy'
        }
      ])
      .select();

    if (error) {
      throw error;
    }

    const mappedData = data.map(alert => ({
      id: alert.id,
      device_id: `${alert.first_name} ${alert.last_name}`,
      latitude: alert.latitude,
      longitude: alert.longitude,
      raw_payload: sensorData,
      is_duplicate: isDuplicate,
      priority_score: priorityScore,
      status: alert.status,
      ai_recommendation: aiRecommendation,
      created_at: alert.created_at
    }));

    return NextResponse.json({ success: true, message: 'SOS received & classified (sos_alerts)', data: mappedData }, { status: 201 });
    
  } catch (error) {
    console.error("Ingestion Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
