import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('sos_events')
      .insert([
        {
          device_id: body.device_id,
          latitude: body.lat,
          longitude: body.lng,
          raw_payload: body.sensor_data
        }
      ])
      .select(); 

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'SOS received', data: data }, { status: 201 });
    
  } catch (error) {
    console.error("Ingestion Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}