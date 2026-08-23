#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey, hashApiKey } from '../lib/auth/apiKey.js';

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

async function createDevKey() {
  try {
    console.log('🔑 Creating development API key...\n');

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    console.log(`Generated Key: ${apiKey}`);
    console.log(`Key Hash:      ${keyHash}\n`);

    const { data, error } = await supabase
      .from('api_keys')
      .insert([
        {
          client_name: 'localhost-dashboard-dev',
          key_hash: keyHash,
          is_active: true,
          rate_limit: 5000,
        },
      ])
      .select();

    if (error) {
      console.error('❌ Failed to save to database:', error.message);
      console.log('\n📝 You can still use the key manually. Add this to your .env.local:');
      console.log(`NEXT_PUBLIC_DASHBOARD_API_KEY=${apiKey}\n`);
      process.exit(1);
    }

    console.log('✅ Key saved to database!\n');
    console.log('📝 Add this to your .env.local:\n');
    console.log(`NEXT_PUBLIC_DASHBOARD_API_KEY=${apiKey}\n`);
    console.log('Then restart your dev server: npm run dev\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createDevKey();
