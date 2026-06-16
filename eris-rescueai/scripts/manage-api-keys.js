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
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listKeys() {
  console.log('\n📋 Active API Keys\n');
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, client_name, is_active, rate_limit, created_at, last_used_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data?.length) {
    console.log('No API keys found');
    return;
  }

  data.forEach((key) => {
    const status = key.is_active ? '✅' : '❌';
    const lastUsed = key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never';
    
    console.log(`${status} ${key.client_name}`);
    console.log(`   ID: ${key.id}`);
    console.log(`   Rate Limit: ${key.rate_limit}`);
    console.log(`   Created: ${new Date(key.created_at).toLocaleString()}`);
    console.log(`   Last Used: ${lastUsed}`);
    console.log('');
  });
}

async function createKey(name, rateLimit = 1000) {
  console.log(`\n🔑 Creating API key for: ${name}\n`);
  
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);

  const { data, error } = await supabase
    .from('api_keys')
    .insert([
      {
        client_name: name,
        key_hash: keyHash,
        is_active: true,
        rate_limit: rateLimit,
      },
    ])
    .select();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ API key created successfully!\n');
  console.log('⚠️  STORE THIS KEY SECURELY - YOU WON\'T SEE IT AGAIN!\n');
  console.log(`Client: ${name}`);
  console.log(`API Key: ${apiKey}`);
  console.log(`Rate Limit: ${rateLimit}`);
  console.log('\n');
}

async function revokeKey(clientName) {
  console.log(`\n⛔ Revoking key for: ${clientName}\n`);
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('client_name', clientName);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Key revoked successfully!\n');
}

async function deleteKey(clientName) {
  console.log(`\n🗑️  Deleting key for: ${clientName}\n`);
  
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('client_name', clientName);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Key deleted successfully!\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Usage: node scripts/manage-api-keys.js <command> [options]

Commands:
  list                    List all API keys
  create <name> [limit]   Create a new API key
  revoke <name>           Revoke an API key
  delete <name>           Delete an API key
    `);
    return;
  }

  try {
    switch (command) {
      case 'list':
        await listKeys();
        break;
      case 'create':
        if (!args[1]) {
          console.error('❌ Client name required');
          process.exit(1);
        }
        await createKey(args[1], parseInt(args[2]) || 1000);
        break;
      case 'revoke':
        if (!args[1]) {
          console.error('❌ Client name required');
          process.exit(1);
        }
        await revokeKey(args[1]);
        break;
      case 'delete':
        if (!args[1]) {
          console.error('❌ Client name required');
          process.exit(1);
        }
        await deleteKey(args[1]);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
