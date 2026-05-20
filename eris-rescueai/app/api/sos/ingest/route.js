import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Sécurité : Vérifier que les variables d'environnement existent
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERREUR CRITIQUE: Variables d'environnement Supabase manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const body = await request.json();
    
    // 2. Validation stricte des données entrantes
    if (!body.device_id || !body.lat || !body.lng) {
      return NextResponse.json(
        { success: false, error: "Données incomplètes : device_id, lat et lng sont obligatoires." }, 
        { status: 400 }
      );
    }
    
    // 3. Insertion en base de données
    const { data, error } = await supabase
      .from('sos_events')
      .insert([
        {
          device_id: body.device_id,
          latitude: body.lat,
          longitude: body.lng,
          raw_payload: body.sensor_data || {} // Évite d'insérer "undefined"
        }
      ])
      .select(); 

    if (error) {
      throw error;
    }

    // --- FUTURE ÉTAPE IA ---
    // const alertData = data[0];
    // const instructions = await genererInstructionsSecurite(alertData);
    // -----------------------

    return NextResponse.json({ 
      success: true, 
      message: 'SOS received and logged', 
      data: data,
      // instructions_securite: instructions (à renvoyer à l'App plus tard)
    }, { status: 201 });
    
  } catch (error) {
    console.error("Ingestion Error:", error);
    // On renvoie un status 500 pour indiquer que le serveur a eu un problème
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}