const fetch = require('node-fetch');

const API_URL = 'https://airport-chatbot-7w6j6syu7-prabikrishna-gmailcoms-projects.vercel.app/api/chat/send';

const testQueries = [
  'How do I get to the airport from Burj Al Sahwa roundabout?',
  'Is public transportation available from Muscat Airport?',
  'What are the parking rates?',
  'Hello'
];

async function testAPI() {
  console.log('🧪 Testing deployed API with database integration...\n');
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`📝 Test ${i + 1}: "${query}"`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          sessionId: `test-session-${Date.now()}-${i}`
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ SUCCESS');
        console.log(`📊 Confidence: ${data.confidence || 'N/A'}`);
        console.log(`🎯 Intent: ${data.intent || 'N/A'}`);
        console.log(`📝 Response: ${data.response.substring(0, 100)}...`);
        console.log(`⏱️ Response Time: ${data.responseTime || 'N/A'}ms`);
      } else {
        console.log('❌ FAILED');
        console.log(`Error: ${data.error || data.message}`);
      }
      
    } catch (error) {
      console.log('❌ NETWORK ERROR');
      console.log(`Error: ${error.message}`);
    }
    
    console.log('─'.repeat(50));
  }
  
  console.log('🏁 Testing completed!');
}

testAPI(); 