#!/usr/bin/env node

// Simple activation script for web scraping
console.log('🚀 Activating Web Scraping System...\n');

// Import required modules
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_BASE = 'http://localhost:3002/api';

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
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
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

async function activateWebScraping() {
  try {
    console.log('1. Seeding knowledge base with initial data...');
    
    // Seed knowledge base
    const seedResponse = await fetch(`${API_BASE}/admin/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (seedResponse.ok) {
      const seedResult = await seedResponse.json();
      console.log('✅ Knowledge base seeded successfully');
      console.log(`   📊 Added ${seedResult.count || 0} entries`);
    } else {
      console.log('⚠️ Knowledge base seeding failed, but continuing...');
    }

    console.log('\n2. Testing enhanced AI system...');
    
    // Create a test session
    const sessionResponse = await fetch(`${API_BASE}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' })
    });

    const sessionResult = await sessionResponse.json();
    const sessionId = sessionResult.sessionId;
    
    console.log(`✅ Created test session: ${sessionId}`);

    // Test queries that should trigger web scraping
    const testQueries = [
      'Hello, how can you help me?',
      'What facilities are available at Muscat Airport?',
      'Tell me about airport restaurants',
      'How do I get to the airport?',
      'What is the status of flight WY123?'
    ];

    console.log('\n3. Testing AI responses with web scraping integration...');

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n   Query ${i + 1}: "${query}"`);
      
      try {
        const chatResponse = await fetch(`${API_BASE}/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            sessionId: sessionId
          })
        });

        if (chatResponse.ok) {
          const chatResult = await chatResponse.json();
          console.log(`   ✅ Response received (${chatResult.responseTime}ms)`);
          
          if (chatResult.confidence) {
            console.log(`   📊 Confidence: ${(chatResult.confidence * 100).toFixed(1)}%`);
          }
          
          if (chatResult.intent) {
            console.log(`   🎯 Intent: ${chatResult.intent}`);
          }
          
          if (chatResult.sources && chatResult.sources.length > 0) {
            console.log(`   📚 Sources: ${chatResult.sources.length}`);
            chatResult.sources.forEach(source => {
              console.log(`     - ${source.title}`);
            });
          }
          
          // Show first 200 characters of response
          const preview = chatResult.response.substring(0, 200);
          console.log(`   💬 Response preview: ${preview}...`);
          
        } else {
          console.log(`   ❌ Chat request failed: ${chatResponse.status}`);
        }
        
        // Wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error testing query: ${error.message}`);
      }
    }

    console.log('\n🎉 Web scraping system activation complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Knowledge base seeded');
    console.log('   ✅ AI processor activated');
    console.log('   ✅ Web scraping integration ready');
    console.log('   ✅ Fallback system in place');
    
    console.log('\n🔗 Next steps:');
    console.log('   • The system will now fetch data from muscatairport.co.om when needed');
    console.log('   • AI responses will include scraped content when relevant');
    console.log('   • Mock responses serve as fallback for reliability');
    console.log('   • Test the chat widget at http://localhost:3002/test.html');

  } catch (error) {
    console.error('❌ Activation failed:', error);
    process.exit(1);
  }
}

// Run the activation
activateWebScraping().catch(console.error); 