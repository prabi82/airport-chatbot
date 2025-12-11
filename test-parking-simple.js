const fetch = require('node-fetch');

async function testParkingRatesSimple() {
  console.log('🅿️ Testing parking rates - simple API test...\n');
  
  const queries = [
    "How much does it cost to park for 1 hour at Muscat International Airport?",
    "What is the hourly parking rate?",
    "OMR 0.200 parking cost"
  ];
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`📝 Query ${i + 1}: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          sessionId: `test-${i}`
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const containsOMR = result.response.includes('OMR') || result.response.includes('0.200') || result.response.includes('2.000');
        
        console.log(`📊 Provider: ${result.provider}`);
        console.log(`💰 Contains specific rates: ${containsOMR ? 'YES' : 'NO'}`);
        console.log(`🔗 Sources: ${result.sources?.length || 0}`);
        
        if (containsOMR) {
          console.log(`✅ FOUND RATES: ${result.response.substring(0, 200)}...`);
        } else {
          console.log(`❌ NO RATES: ${result.response.substring(0, 150)}...`);
        }
        console.log('');
      } else {
        console.log(`❌ Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testParkingRatesSimple();


