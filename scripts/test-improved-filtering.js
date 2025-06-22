// Test script for improved content filtering
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testImprovedFiltering() {
  console.log('🧪 Testing Improved Content Filtering...\n');

  try {
    // Test 1: Check scraper health
    console.log('1. Checking scraper health...');
    const healthResponse = await axios.get(`${API_BASE}/admin/scraper?action=health`);
    console.log('✅ Scraper health:', healthResponse.data);

    // Test 2: Test parking rate query
    console.log('\n2. Testing parking rate query...');
    const sessionResponse = await axios.post(`${API_BASE}/chat/session`, {
      language: 'en'
    });
    const sessionId = sessionResponse.data.sessionId;
    console.log('✅ Session created:', sessionId);

    // Test parking query
    const parkingQuery = 'What are the parking rates at Muscat airport?';
    console.log(`\n📝 Query: "${parkingQuery}"`);
    
    const chatResponse = await axios.post(`${API_BASE}/chat/send`, {
      message: parkingQuery,
      sessionId: sessionId
    });

    console.log('\n📋 Response:');
    console.log(chatResponse.data.response);
    console.log('\n📊 Response confidence:', chatResponse.data.confidence || 'N/A');
    console.log('⏱️ Response time:', chatResponse.data.responseTime || 'N/A', 'ms');

    // Test 3: Test transportation query
    console.log('\n3. Testing transportation query...');
    const transportQuery = 'How can I get a taxi from the airport?';
    console.log(`\n📝 Query: "${transportQuery}"`);
    
    const transportResponse = await axios.post(`${API_BASE}/chat/send`, {
      message: transportQuery,
      sessionId: sessionId
    });

    console.log('\n📋 Response:');
    console.log(transportResponse.data.response);

    // Test 4: Check cache stats
    console.log('\n4. Checking cache statistics...');
    const cacheResponse = await axios.get(`${API_BASE}/admin/scraper?action=cache_stats`);
    console.log('📊 Cache stats:', cacheResponse.data);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testImprovedFiltering(); 