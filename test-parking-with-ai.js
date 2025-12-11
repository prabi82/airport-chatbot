const fetch = require('node-fetch');

async function testParkingWithAI() {
  console.log('🤖 Testing parking queries with Google AI Studio...\n');
  
  const testQueries = [
    "What are the parking rates at Muscat International Airport?",
    "How much is the parking rate for 1 hour?",
    "What is the hourly parking cost?",
    "How much does it cost to park for one day?"
  ];
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`📝 Testing Query ${i + 1}: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: query,
          sessionId: 'test-ai-parking'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Response received`);
        console.log(`📊 Provider: ${result.provider || 'unknown'}`);
        console.log(`🧠 Knowledge Base Used: ${result.knowledgeBaseUsed || false}`);
        console.log(`🔗 Sources: ${result.sources?.length || 0} sources`);
        console.log(`📄 Response: ${result.response.substring(0, 200)}...`);
        console.log(''); // Empty line for readability
      } else {
        console.log(`❌ API Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
}

testParkingWithAI();


