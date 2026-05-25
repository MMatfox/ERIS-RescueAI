import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sos_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
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
    if ('is_duplicate' in updates) allowedUpdates.is_duplicate = updates.is_duplicate;
    if ('priority_score' in updates) allowedUpdates.priority_score = updates.priority_score;
    if ('ai_recommendation' in updates) allowedUpdates.ai_recommendation = updates.ai_recommendation;

    const { data, error } = await supabase
      .from('sos_events')
      .update(allowedUpdates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Event updated', data }, { status: 200 });
  } catch (error) {
    console.error("Update Event Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
