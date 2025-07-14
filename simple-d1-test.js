#!/usr/bin/env node

/**
 * Simple D1 API Test
 * Tests basic connectivity to Cloudflare D1 API
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        process.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.log('⚠️  No .env.local file found.');
  }
}

async function testD1Connection() {
  loadEnvFile();
  
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  console.log('🔧 Simple D1 API Connection Test\n');
  
  console.log('Environment Variables:');
  console.log(`Account ID: ${accountId ? '✅ Set' : '❌ Missing'}`);
  console.log(`Database ID: ${databaseId ? '✅ Set' : '❌ Missing'}`);
  console.log(`API Token: ${apiToken ? '✅ Set (length: ' + apiToken.length + ')' : '❌ Missing'}\n`);
  
  if (!accountId || !databaseId || !apiToken) {
    console.log('❌ Cannot proceed without all environment variables.\n');
    return;
  }
  
  // Test 1: Simple query
  console.log('🔍 Testing basic D1 query...');
  
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const body = JSON.stringify({ sql: "SELECT 1 as test" });
    
    console.log(`API URL: ${url}`);
    console.log(`Request body: ${body}\n`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ D1 API connection successful!');
      console.log('✅ Your credentials are working correctly.');
    } else {
      console.log('\n❌ D1 API returned an error:');
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`   - ${error.message} (Code: ${error.code})`);
        });
      }
    }
    
  } catch (error) {
    console.log('\n❌ Connection failed:');
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('unable to get local issuer certificate')) {
      console.log('\n💡 SSL Certificate Issue:');
      console.log('This is common in Windows environments. Try:');
      console.log('set NODE_TLS_REJECT_UNAUTHORIZED=0 && node simple-d1-test.js');
    }
  }
}

testD1Connection().catch(console.error);
