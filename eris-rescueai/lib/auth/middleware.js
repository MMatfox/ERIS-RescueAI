import { NextResponse } from 'next/server';
import { validateApiKey } from './apiKey';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Middleware pour authentifier les requêtes API avec une clé API
 * @param {Request} request - La requête Next.js
 * @returns {Object} {isValid: boolean, error?: NextResponse}
 */
export async function authenticateApiKey(request) {
  // Valider la présence et le format de la clé
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

  try {
    // Vérifier la clé dans Supabase
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

    // Clé valide
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
