#!/usr/bin/env node

// Import required modules
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_BASE = 'http://localhost:3000/api';

// Simple fetch polyfill for Node.js
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (options.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testChatbot() {
  console.log('🚀 Testing Enhanced AI Chatbot System\n');

  try {
    // Step 1: Seed knowledge base
    console.log('1. Seeding knowledge base...');
    const seedResponse = await fetch(`${API_BASE}/admin/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const seedResult = await seedResponse.json();
    console.log('✅ Knowledge base seeded:', seedResult.success ? 'Success' : 'Failed');

    // Step 2: Create session
    console.log('\n2. Creating chat session...');
    const sessionResponse = await fetch(`${API_BASE}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' })
    });
    const sessionResult = await sessionResponse.json();
    const sessionId = sessionResult.sessionId;
    console.log('✅ Session created:', sessionId);

    // Step 3: Test different types of queries
    const testQueries = [
      {
        name: 'Greeting',
        message: 'Hello, how are you?',
        expectedIntent: 'greeting'
      },
      {
        name: 'Flight Information',
        message: 'What is the status of flight WY123?',
        expectedIntent: 'flight_inquiry'
      },
      {
        name: 'Airport Services',
        message: 'Where can I find WiFi at the airport?',
        expectedIntent: 'airport_services'
      },
      {
        name: 'Transportation',
        message: 'How do I get a taxi from the airport?',
        expectedIntent: 'transportation'
      },
      {
        name: 'Knowledge Base Query',
        message: 'How do I check my flight status?',
        expectedIntent: 'knowledge_base'
      },
      {
        name: 'General Question',
        message: 'What are the airport operating hours?',
        expectedIntent: 'general_info'
      }
    ];

    console.log('\n3. Testing different query types:\n');

    for (const query of testQueries) {
      console.log(`📝 Testing: ${query.name}`);
      console.log(`   Query: "${query.message}"`);
      
      const chatResponse = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.message,
          sessionId: sessionId
        })
      });

      const chatResult = await chatResponse.json();
      
      if (chatResult.success) {
        console.log(`   ✅ Intent: ${chatResult.intent} (Expected: ${query.expectedIntent})`);
        console.log(`   ✅ Confidence: ${(chatResult.confidence * 100).toFixed(1)}%`);
        console.log(`   ✅ Response Time: ${chatResult.responseTime}ms`);
        console.log(`   ✅ Sources: ${chatResult.sources?.length || 0}`);
        console.log(`   ✅ Suggested Actions: ${chatResult.suggestedActions?.length || 0}`);
        console.log(`   📖 Response: ${chatResult.response.substring(0, 100)}...`);
      } else {
        console.log(`   ❌ Error: ${chatResult.error}`);
      }
      console.log('');
    }

    // Step 4: Test context awareness
    console.log('4. Testing context awareness:\n');
    
    const contextQueries = [
      'Tell me about airport restaurants',
      'What about the prices?',
      'Are they open 24/7?'
    ];

    for (const query of contextQueries) {
      console.log(`📝 Context Query: "${query}"`);
      
      const chatResponse = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          sessionId: sessionId
        })
      });

      const chatResult = await chatResponse.json();
      
      if (chatResult.success) {
        console.log(`   ✅ Intent: ${chatResult.intent}`);
        console.log(`   ✅ Confidence: ${(chatResult.confidence * 100).toFixed(1)}%`);
        console.log(`   📖 Response: ${chatResult.response.substring(0, 150)}...`);
      }
      console.log('');
    }

    // Step 5: Check knowledge base statistics
    console.log('5. Knowledge base statistics:');
    const statsResponse = await fetch(`${API_BASE}/admin/seed`);
    const statsResult = await statsResponse.json();
    
    if (statsResult.success) {
      console.log(`   ✅ English categories: ${statsResult.statistics.englishCategories}`);
      console.log(`   ✅ Arabic categories: ${statsResult.statistics.arabicCategories}`);
      console.log(`   ✅ Total categories: ${statsResult.statistics.totalCategories}`);
      console.log(`   📋 Categories: ${statsResult.statistics.categories.english.join(', ')}`);
    }

    console.log('\n🎉 Enhanced AI System Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testChatbot(); 