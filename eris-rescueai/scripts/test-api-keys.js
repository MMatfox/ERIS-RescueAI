#!/usr/bin/env node

/**
 * Test des endpoints API avec authentification par clé API
 * 
 * Usage: node scripts/test-api-keys.js
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function testApiEndpoints() {
  console.log('\n📡 Testing Protected API Endpoints\n');
  console.log(`API Base: ${API_BASE}\n`);
  console.log('='.repeat(80));

  // Test 1 : Sans clé API
  console.log('\n❌ TEST 1: Requête SANS clé API');
  console.log('---');
  try {
    const response = await fetch(`${API_BASE}/api/sos/events`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Test 2 : Avec clé API valide (simulation)
  console.log('\n✅ TEST 2: Requête AVEC clé API valide');
  console.log('---');
  const validApiKey = process.env.TEST_API_KEY || 'sos_INVALID_FOR_DEMO';
  console.log(`Using API Key: ${validApiKey.substring(0, 10)}...`);
  
  try {
    const response = await fetch(`${API_BASE}/api/sos/events`, {
      headers: {
        'X-API-Key': validApiKey,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response (first 2 events):`, 
      data.data?.slice(0, 2) || data
    );
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Test 3 : Ingest avec clé API
  console.log('\n✅ TEST 3: POST /api/sos/ingest avec clé API');
  console.log('---');
  
  const testPayload = {
    device_id: 'test-device-001',
    lat: 48.8566,
    lng: 2.3522,
    sensor_data: {
      battery: 85,
      fall_detected: false,
      crash_detected: false,
      inactivity: false,
      impact: 'none'
    }
  };

  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(`${API_BASE}/api/sos/ingest`, {
      method: 'POST',
      headers: {
        'X-API-Key': validApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Test 4 : Avec clé invalide
  console.log('\n❌ TEST 4: Requête avec clé API INVALIDE');
  console.log('---');
  try {
    const response = await fetch(`${API_BASE}/api/sos/events`, {
      headers: {
        'X-API-Key': 'sos_INVALID_KEY_XXXX',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
  } catch (err) {
    console.error('Error:', err.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Tests complètés !\n');
}

// Run tests
testApiEndpoints().catch(console.error);
