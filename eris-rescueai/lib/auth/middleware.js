import { NextResponse } from 'next/server';
import { validateApiKey } from './apiKey';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Auth via clé API ou token Bearer
export async function authenticateApiKey(request) {
  
  const validation = validateApiKey(request);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: validation.error },
        { status: 401 }
      ),
    };
  }

  const incomingKey = request.headers.get('x-api-key') || 
                      request.headers.get('Authorization')?.replace('Bearer ', '');

  // Chemin rapide : évite un appel BDD si c'est la clé globale dev/prod
  if (process.env.API_KEY && incomingKey === process.env.API_KEY) {
    return {
      isValid: true,
      clientId: 'shared-client',
      clientName: 'shared-client',
      rateLimit: 1000
    };
  }

  // Sinon, check dans Supabase
  try {
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: apiKeyRecord, error } = await supabase
      .from('api_keys')
      .select('id, client_name, is_active, rate_limit')
      .eq('key_hash', validation.apiKeyHash)
      .eq('is_active', true)
      .single();

    if (error || !apiKeyRecord) {
      return {
        isValid: false,
        error: NextResponse.json(
          { error: 'Invalid or inactive API key' },
          { status: 401 }
        ),
      };
    }

    return {
      isValid: true,
      clientId: apiKeyRecord.id,
      clientName: apiKeyRecord.client_name,
      rateLimit: apiKeyRecord.rate_limit,
    };
  } catch (err) {
    console.error('API Key validation error:', err);
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      ),
    };
  }
}
