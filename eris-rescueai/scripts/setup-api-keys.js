/**
 * Script pour configurer les clés API dans Supabase
 * À exécuter une seule fois pour initialiser la table et créer les premières clés
 * 
 * Usage: npm run api:setup
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Charger .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

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

    // 1. Vérifier que la table api_keys existe
    console.log('📋 Checking api_keys table...');
    const { data: tableCheck, error: checkError } = await supabase
      .from('api_keys')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === 'PGRST116') {
      console.error('❌ ERROR: api_keys table does not exist!');
      console.error('\n📝 Please create the table first using the SQL below in your Supabase dashboard:\n');
      console.error(`
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
      `);
      console.error('\n👉 Steps:');
      console.error('1. Go to https://app.supabase.com/');
      console.error('2. Select your project (eoksxgxaonteologfnzq)');
      console.error('3. Go to SQL Editor');
      console.error('4. Create a new query and paste the SQL above');
      console.error('5. Run it');
      console.error('6. Then run this script again\n');
      process.exit(1);
    }

    console.log('✅ api_keys table exists\n');

    // 2. Générer des clés API pour les clients principaux
    console.log('🔑 Generating API Keys...\n');

    const clients = [
      { name: 'rescue-ai-mobile', rateLimit: 1000 },
      { name: 'rescue-ai-dashboard', rateLimit: 500 },
      { name: 'rescue-ai-partner', rateLimit: 200 },
    ];

    const generatedKeys = [];

    for (const client of clients) {
      const apiKey = await generateApiKey();
      const keyHash = await hashApiKey(apiKey);

      // Toujours ajouter la clé à la liste (même si l'insertion échoue)
      const keyInfo = {
        client: client.name,
        apiKey: apiKey,
        keyHash: keyHash,
        rateLimit: client.rateLimit,
      };
      generatedKeys.push(keyInfo);

      // Essayer d'insérer dans Supabase
      try {
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
          console.error(`⚠️  Generated key for ${client.name} but NOT saved to database:`);
          console.error(`   Error: ${error.message}`);
          console.error(`   Code: ${error.code}\n`);
        } else {
          console.log(`✅ Created API key for: ${client.name}`);
        }
      } catch (err) {
        console.error(`⚠️  Generated key for ${client.name} but failed to save:`);
        console.error(`   Error: ${err.message}\n`);
      }
    }

    // 3. Afficher les clés (ATTENTION: À stocker de manière sécurisée!)
    console.log('\n' + '='.repeat(80));
    console.log('🔐 GENERATED API KEYS - STORE THESE SECURELY!');
    console.log('='.repeat(80));
    
    if (generatedKeys.length === 0) {
      console.log('\n⚠️  No keys were generated. Check the errors above.');
      process.exit(1);
    }

    console.log('\nThese keys have been generated and must be kept secret!');
    console.log('Share them securely with your clients/applications.\n');

    generatedKeys.forEach((key) => {
      console.log(`Client: ${key.client}`);
      console.log(`API Key: ${key.apiKey}`);
      console.log(`Rate Limit: ${key.rateLimit}`);
      console.log('---');
    });

    console.log('\n✅ API Keys setup completed!\n');
    
    // Vérifier si les clés ont été sauvegardées
    const { data: savedKeys } = await supabase
      .from('api_keys')
      .select('client_name')
      .in('client_name', clients.map(c => c.name));
    
    if (savedKeys && savedKeys.length === clients.length) {
      console.log('✅ All keys have been saved to the database!');
    } else {
      console.log('⚠️  WARNING: Keys were generated but NOT all saved to database!');
      console.log('📝 Please verify your Supabase connection and try again.');
    }

    console.log('\n📝 Next steps:');
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
