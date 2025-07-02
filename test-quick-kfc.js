const fetch = require('node-fetch');

async function testKFC() {
  console.log('🧪 Quick KFC test...\n');
  
  try {
    // Test both potential ports
    const ports = [3000, 3001];
    let response;
    
    for (const port of ports) {
      try {
        console.log(`Trying port ${port}...`);
        response = await fetch(`http://localhost:${port}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'where is KFC located?',
            sessionId: 'test-' + Date.now()
          })
        });
        
        if (response.ok) {
          console.log(`✅ Connected on port ${port}`);
          break;
        }
      } catch (err) {
        console.log(`❌ Port ${port} not available`);
      }
    }
    
    if (!response || !response.ok) {
      console.log('❌ No server available');
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📋 Raw Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📋 Results:');
    console.log('🔗 Sources:', data.sources ? data.sources.length : 0);
    console.log('📄 Message:', data.message ? 'Present' : 'Missing');
    
    if (data.sources && data.sources.length > 0) {
      console.log('\n📚 Source details:');
      data.sources.forEach((source, index) => {
        if (source.includes('restaurants-quick-bites')) {
          console.log(`${index + 1}. ✅ Restaurants & Quick Bites (RELEVANT)`);
        } else if (source.includes('primeclass-lounge')) {
          console.log(`${index + 1}. ❌ Primeclass Lounge (IRRELEVANT)`);
        } else if (source.includes('to-from')) {
          console.log(`${index + 1}. ❌ Transportation Guide (IRRELEVANT)`);
        } else {
          console.log(`${index + 1}. ❓ ${source}`);
        }
      });
      
      console.log('\n🎯 Expected: Only 1 source (Restaurants & Quick Bites)');
      
      if (data.sources.length === 1 && data.sources[0].includes('restaurants-quick-bites')) {
        console.log('✅ SUCCESS: Perfect filtering!');
      } else {
        console.log('❌ FAIL: Still showing irrelevant sources');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testKFC(); 