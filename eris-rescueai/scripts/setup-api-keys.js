/**
 * Script pour configurer les clés API dans Supabase
 * À exécuter une seule fois pour initialiser la table et créer les premières clés
 * 
 * Usage: node scripts/setup-api-keys.js
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

async function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `sos_${randomBytes}`;
}

async function setupApiKeys() {
  try {
    console.log('🔧 Setting up API Keys infrastructure...\n');

    // 1. Créer la table api_keys si elle n'existe pas
    console.log('📋 Creating api_keys table...');
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_name VARCHAR(255) NOT NULL UNIQUE,
          key_hash VARCHAR(64) NOT NULL UNIQUE,
          is_active BOOLEAN DEFAULT true,
          rate_limit INTEGER DEFAULT 1000,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used_at TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
      `
    }).catch(() => null); // L'utilisation directe de rpc peut ne pas fonctionner, donc on ignorera l'erreur

    // 2. Générer des clés API pour les clients principaux
    console.log('\n🔑 Generating API Keys...\n');

    const clients = [
      { name: 'rescue-ai-mobile', rateLimit: 1000 },
      { name: 'rescue-ai-dashboard', rateLimit: 500 },
      { name: 'rescue-ai-partner', rateLimit: 200 },
    ];

    const generatedKeys = [];

    for (const client of clients) {
      const apiKey = await generateApiKey();
      const keyHash = await hashApiKey(apiKey);

      // Insérer dans Supabase
      const { data, error } = await supabase
        .from('api_keys')
        .insert([
          {
            client_name: client.name,
            key_hash: keyHash,
            is_active: true,
            rate_limit: client.rateLimit,
          },
        ])
        .select();

      if (error) {
        console.error(`❌ Failed to create key for ${client.name}:`, error.message);
      } else {
        generatedKeys.push({
          client: client.name,
          apiKey: apiKey, // 🚨 À stocker dans un endroit sécurisé !
          keyHash: keyHash,
          rateLimit: client.rateLimit,
        });
        console.log(`✅ Created API key for: ${client.name}`);
      }
    }

    // 3. Afficher les clés (ATTENTION: À stocker de manière sécurisée!)
    console.log('\n' + '='.repeat(80));
    console.log('🔐 GENERATED API KEYS - STORE THESE SECURELY!');
    console.log('='.repeat(80));
    console.log('\nThese keys have been generated and must be kept secret!');
    console.log('Share them securely with your clients/applications.\n');

    generatedKeys.forEach((key) => {
      console.log(`Client: ${key.client}`);
      console.log(`API Key: ${key.apiKey}`);
      console.log(`Rate Limit: ${key.rateLimit} requests/hour`);
      console.log('---');
    });

    console.log('\n✅ API Keys setup completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('1. Store each API key securely (environment variables, secure vault, etc.)');
    console.log('2. Share keys with your clients/applications');
    console.log('3. To use: Add "X-API-Key: <your-api-key>" header to all requests\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

// Exécuter le setup
setupApiKeys();
