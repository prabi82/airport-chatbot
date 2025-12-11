const fetch = require('node-fetch');

async function testSpecificParkingRates() {
  console.log('🤖 Testing specific parking rate queries with Google AI Studio...\n');
  
  const testQueries = [
    "How much is the parking rate for 1 hour?",
    "What is the hourly parking cost at Muscat International Airport?",
    "How much does it cost to park for one day?",
    "What are the daily parking rates?",
    "What is the weekly parking rate?",
    "How much does overnight parking cost?"
  ];
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`📝 Query ${i + 1}: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: query,
          sessionId: 'test-specific-parking'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`📊 Provider: ${result.provider}`);
        console.log(`💰 Response: ${result.response.substring(0, 300)}...`);
        console.log(''); // Empty line
      } else {
        console.log(`❌ Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testSpecificParkingRates();


