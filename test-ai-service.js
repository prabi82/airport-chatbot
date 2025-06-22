const testQueries = [
  "Which car rental companies are available?",
  "What car rental companies can I find at the airport?", 
  "Are there any vehicle rental services?",
  "I need to rent a car, what options do I have?",
  "Car hire companies at Muscat airport?",
  "How do I get to the airport from Burj Al Sahwa?",
  "Is public transportation available?",
  "What are the parking rates?",
  "Are taxis available 24/7?"
];

async function testAIService() {
  console.log('🧪 Testing AI Service...\n');
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📝 Test ${i + 1}: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3003/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          sessionId: `test_session_${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Intent: ${data.intent}`);
        console.log(`📊 Confidence: ${(data.confidence * 100).toFixed(1)}%`);
        console.log(`⚡ Response Time: ${data.responseTime}ms`);
        console.log(`📝 Response: ${data.response.substring(0, 100)}...`);
      } else {
        console.log(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
  }
}

testAIService(); 