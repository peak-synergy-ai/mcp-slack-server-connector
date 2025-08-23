#!/usr/bin/env node

/**
 * Setup Verification Script
 * 
 * This script helps verify that your Slack AI Service is configured correctly.
 * Run this after deploying to Vercel and setting up your Slack app.
 * 
 * Usage: node scripts/verify-setup.js [your-vercel-url]
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

async function verifySetup() {
  console.log('🚀 Slack AI Service Setup Verification\n');

  // Get the Vercel URL
  let vercelUrl = process.argv[2];
  if (!vercelUrl) {
    vercelUrl = await new Promise(resolve => {
      rl.question('Enter your Vercel deployment URL (e.g., https://my-app.vercel.app): ', resolve);
    });
  }

  // Ensure URL format
  if (!vercelUrl.startsWith('http')) {
    vercelUrl = 'https://' + vercelUrl;
  }

  console.log(`Checking deployment at: ${vercelUrl}\n`);

  // Test 1: Health Check
  console.log('1. 🏥 Testing health endpoint...');
  try {
    const health = await makeRequest(`${vercelUrl}/api/health`);
    if (health.status === 200) {
      console.log('   ✅ Health check passed');
      
      const checks = health.data.checks;
      console.log('   📋 Environment Variables:');
      console.log(`      Slack Bot Token: ${checks.slack.botToken ? '✅' : '❌'}`);
      console.log(`      Slack Signing Secret: ${checks.slack.signingSecret ? '✅' : '❌'}`);
      console.log(`      Slack App Token: ${checks.slack.appToken ? '✅' : '❌'}`);
      console.log(`      OpenAI API Key: ${checks.ai.openai ? '✅' : '❌'}`);
      console.log(`      Anthropic API Key: ${checks.ai.anthropic ? '✅' : '❌'}`);
      console.log(`      NextAuth Secret: ${checks.auth.nextAuthSecret ? '✅' : '❌'}`);
    } else {
      console.log(`   ❌ Health check failed (${health.status})`);
      if (health.data.error) {
        console.log(`   Error: ${health.data.error}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
  }

  console.log();

  // Test 2: Slack Events Endpoint
  console.log('2. 📱 Testing Slack events endpoint...');
  try {
    const events = await makeRequest(`${vercelUrl}/api/slack/events`);
    if (events.status === 405) {
      console.log('   ✅ Slack events endpoint is responding (GET not allowed as expected)');
    } else {
      console.log(`   ⚠️  Unexpected response: ${events.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Slack events endpoint failed: ${error.message}`);
  }

  console.log();

  // Test 3: Admin Panel
  console.log('3. 🔧 Testing admin panel...');
  try {
    const admin = await makeRequest(`${vercelUrl}/admin`);
    if (admin.status === 200) {
      console.log('   ✅ Admin panel is accessible');
    } else {
      console.log(`   ❌ Admin panel failed (${admin.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Admin panel failed: ${error.message}`);
  }

  console.log();

  // Instructions
  console.log('📝 Next Steps:\n');
  
  console.log('1. Slack App Configuration:');
  console.log(`   - Event Subscriptions URL: ${vercelUrl}/api/slack/events`);
  console.log(`   - Interactive Components URL: ${vercelUrl}/api/slack/interactivity`);
  console.log(`   - Slash Commands URL: ${vercelUrl}/api/slack/commands`);
  
  console.log('\n2. Required Slack App Scopes:');
  console.log('   - app_mentions:read');
  console.log('   - channels:history');
  console.log('   - channels:read');
  console.log('   - chat:write');
  console.log('   - im:history');
  console.log('   - im:read');
  console.log('   - im:write');
  console.log('   - users:read');
  
  console.log('\n3. Test Your Integration:');
  console.log('   - Invite your bot to a Slack channel');
  console.log('   - Send: @YourBot hello');
  console.log('   - Try the slash command: /ai-tools');
  console.log(`   - Configure channels at: ${vercelUrl}/admin`);

  console.log('\n4. Troubleshooting:');
  console.log('   - Check Vercel function logs for errors');
  console.log('   - Verify all environment variables are set');
  console.log('   - Ensure Slack app has proper scopes and event subscriptions');
  console.log('   - Test the /api/health endpoint regularly');

  const needsAttention = [];
  
  if (process.argv.includes('--check-env')) {
    console.log('\n🔍 Environment Variable Details:');
    const envVars = [
      'SLACK_BOT_TOKEN',
      'SLACK_SIGNING_SECRET', 
      'SLACK_APP_TOKEN',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];
    
    envVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`   ✅ ${envVar}: ${value.substring(0, 10)}...`);
      } else {
        console.log(`   ❌ ${envVar}: Not set`);
        needsAttention.push(envVar);
      }
    });
  }

  if (needsAttention.length > 0) {
    console.log(`\n⚠️  Missing environment variables: ${needsAttention.join(', ')}`);
  }

  console.log('\n🎉 Setup verification complete!');
  
  rl.close();
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/verify-setup.js [options] [vercel-url]

Options:
  --check-env    Check local environment variables
  --help, -h     Show this help message

Examples:
  node scripts/verify-setup.js https://my-app.vercel.app
  node scripts/verify-setup.js --check-env
  `);
  process.exit(0);
}

verifySetup().catch(console.error);