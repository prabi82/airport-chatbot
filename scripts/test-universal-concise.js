const fetch = require('node-fetch');

// Test queries for different categories
const testQueries = [
  // Transportation
  { query: 'Is car rental available at Muscat Airport?', category: 'Transportation', expected: 'car_rental' },
  { query: 'How much is parking for 2 hours?', category: 'Transportation', expected: 'parking_rate' },
  { query: 'Are there taxis at the airport?', category: 'Transportation', expected: 'taxi_info' },
  
  // Airport Services
  { query: 'What restaurants are available?', category: 'Airport Services', expected: 'dining' },
  { query: 'Is there duty free shopping?', category: 'Airport Services', expected: 'shopping' },
  { query: 'Is there free WiFi?', category: 'Airport Services', expected: 'connectivity' },
  { query: 'Are there airport lounges?', category: 'Airport Services', expected: 'lounge' },
  
  // Facilities
  { query: 'Where are the prayer rooms?', category: 'Facilities', expected: 'prayer' },
  { query: 'Where are the restrooms?', category: 'Facilities', expected: 'facilities' },
  { query: 'Is there a medical center?', category: 'Facilities', expected: 'medical' },
  { query: 'My baggage is lost', category: 'Facilities', expected: 'baggage' },
  
  // General
  { query: 'What services are available?', category: 'General', expected: 'general' },
  { query: 'Hello', category: 'Greeting', expected: 'greeting' }
];

const API_BASE = 'http://localhost:3000';

async function createSession() {
  try {
    const response = await fetch(`${API_BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.sessionId;
  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
    return null;
  }
}

async function testQuery(query, sessionId) {
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        sessionId: sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: true,
      response: data.response,
      intent: data.intent,
      confidence: data.confidence,
      responseTime,
      length: data.response.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: 0,
      length: 0
    };
  }
}

async function runTests() {
  console.log('🎯 Universal Concise Response System Test');
  console.log('==========================================\n');
  
  // Create a session
  const sessionId = await createSession();
  if (!sessionId) {
    console.error('❌ Cannot proceed without session. Make sure the server is running.');
    return;
  }
  
  console.log(`✅ Session created: ${sessionId}\n`);
  
  const results = [];
  let totalTests = 0;
  let successfulTests = 0;
  let conciseTests = 0;
  
  for (const test of testQueries) {
    totalTests++;
    console.log(`🔍 Testing: "${test.query}"`);
    console.log(`   Category: ${test.category}`);
    
    const result = await testQuery(test.query, sessionId);
    
    if (result.success) {
      successfulTests++;
      const isConcise = result.length > 0 && result.length < 1000;
      if (isConcise) conciseTests++;
      
      console.log(`   ✅ Success: ${result.length} chars, ${result.responseTime}ms`);
      console.log(`   🎯 Concise: ${isConcise ? 'YES' : 'NO'}`);
      console.log(`   🔍 Intent: ${result.intent || 'Not detected'}`);
      console.log(`   📝 Preview: ${result.response.substring(0, 100)}...`);
      
      results.push({
        ...test,
        ...result,
        isConcise
      });
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      results.push({
        ...test,
        ...result,
        isConcise: false
      });
    }
    
    console.log('');
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('📊 Test Summary');
  console.log('===============');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} (${Math.round(successfulTests/totalTests*100)}%)`);
  console.log(`Concise Responses: ${conciseTests} (${Math.round(conciseTests/totalTests*100)}%)`);
  
  // Category breakdown
  const categories = {};
  results.forEach(result => {
    if (!categories[result.category]) {
      categories[result.category] = { total: 0, successful: 0, concise: 0 };
    }
    categories[result.category].total++;
    if (result.success) categories[result.category].successful++;
    if (result.isConcise) categories[result.category].concise++;
  });
  
  console.log('\n📈 Category Breakdown:');
  Object.entries(categories).forEach(([category, stats]) => {
    console.log(`${category}: ${stats.successful}/${stats.total} successful, ${stats.concise}/${stats.total} concise`);
  });
  
  // Quality metrics
  const avgLength = results.filter(r => r.success).reduce((sum, r) => sum + r.length, 0) / successfulTests;
  const avgTime = results.filter(r => r.success).reduce((sum, r) => sum + r.responseTime, 0) / successfulTests;
  
  console.log('\n⚡ Performance Metrics:');
  console.log(`Average Response Length: ${Math.round(avgLength)} characters`);
  console.log(`Average Response Time: ${Math.round(avgTime)}ms`);
  
  console.log('\n🎯 Universal Concise Response System Test Complete!');
}

// Run the tests
runTests().catch(console.error); 