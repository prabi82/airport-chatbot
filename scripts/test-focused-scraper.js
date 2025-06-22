// Test script for focused Muscat Airport scraper
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testFocusedScraper() {
  console.log('🧪 Testing Focused Muscat Airport Scraper...\n');

  try {
    // Test 1: Create a session
    console.log('1. Creating chat session...');
    const sessionResponse = await axios.post(`${API_BASE}/chat/session`, {
      language: 'en'
    });
    const sessionId = sessionResponse.data.sessionId;
    console.log('✅ Session created:', sessionId);

    // Test 2: Test parking rate query
    console.log('\n2. Testing parking rate query...');
    const parkingResponse = await axios.post(`${API_BASE}/chat/send`, {
      message: 'What are the parking rates at Muscat airport?',
      sessionId: sessionId,
    });

    if (parkingResponse.data.success) {
      console.log('✅ Parking query response:');
      console.log(parkingResponse.data.response);
      console.log('\n📊 Response time:', parkingResponse.data.responseTime + 'ms');
    } else {
      console.log('❌ Parking query failed:', parkingResponse.data.error);
    }

    // Test 3: Test taxi query
    console.log('\n3. Testing taxi service query...');
    const taxiResponse = await axios.post(`${API_BASE}/chat/send`, {
      message: 'How can I get a taxi from Muscat airport?',
      sessionId: sessionId,
    });

    if (taxiResponse.data.success) {
      console.log('✅ Taxi query response:');
      console.log(taxiResponse.data.response);
      console.log('\n📊 Response time:', taxiResponse.data.responseTime + 'ms');
    } else {
      console.log('❌ Taxi query failed:', taxiResponse.data.error);
    }

    // Test 4: Test car rental query
    console.log('\n4. Testing car rental query...');
    const rentalResponse = await axios.post(`${API_BASE}/chat/send`, {
      message: 'Where can I rent a car at the airport?',
      sessionId: sessionId,
    });

    if (rentalResponse.data.success) {
      console.log('✅ Car rental query response:');
      console.log(rentalResponse.data.response);
      console.log('\n📊 Response time:', rentalResponse.data.responseTime + 'ms');
    } else {
      console.log('❌ Car rental query failed:', rentalResponse.data.error);
    }

    console.log('\n🎉 Testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testFocusedScraper(); 