/**
 * Test script specifically for car rental query fix
 */

const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testCarRentalQuery() {
  console.log('🧪 Testing Car Rental Query Fix');
  console.log('=================================\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3000, // Using port 3000 as shown in server logs
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  let sessionId = null;

  try {
    // Create a session first
    console.log('📝 Creating chat session...');
    
    const sessionOptions = {
      ...baseOptions,
      path: '/api/chat/session',
      method: 'POST'
    };
    
    const sessionResult = await makeRequest(sessionOptions, '{}');
    
    if (sessionResult.status === 200 && sessionResult.data.sessionId) {
      sessionId = sessionResult.data.sessionId;
      console.log(`✅ Session created: ${sessionId}\n`);
    } else {
      throw new Error(`Failed to create session: ${sessionResult.status}`);
    }

    // Test the car rental query
    const testQuery = "Is car rental available at Muscat Airport?";
    console.log(`🔍 Testing query: "${testQuery}"`);
    
    const startTime = Date.now();
    
    const chatOptions = {
      ...baseOptions,
      path: '/api/chat/send',
      method: 'POST'
    };
    
    const requestData = JSON.stringify({
      message: testQuery,
      sessionId: sessionId
    });
    
    const result = await makeRequest(chatOptions, requestData);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (result.status === 200) {
      const data = result.data;
      
      console.log(`⏱️  Response time: ${responseTime}ms`);
      console.log(`📊 Raw response data:`, JSON.stringify(data, null, 2));
      
      if (!data || !data.message) {
        console.log('❌ Error: No message in response data');
        return;
      }
      
      console.log(`📏 Response length: ${data.message.length} characters`);
      console.log(`🎯 Intent: ${data.intent || 'Unknown'}`);
      console.log(`🔍 Confidence: ${data.confidence || 'N/A'}`);
      
      // Analyze response quality
      const isReasonableLength = data.message.length < 1000;
      const hasStructure = data.message.includes('**') || data.message.includes('•') || data.message.includes('✅');
      const hasDataDump = data.message.includes('|') && data.message.split('|').length > 10;
      const isCarRentalResponse = data.message.toLowerCase().includes('car rental at muscat airport');
      
      console.log('\n📊 Quality Analysis:');
      console.log(`   Length: ${isReasonableLength ? '✅ Concise' : '⚠️ Too long'} (${data.message.length} chars)`);
      console.log(`   Structure: ${hasStructure ? '✅ Well formatted' : '⚠️ Plain text'}`);
      console.log(`   Data Quality: ${hasDataDump ? '❌ Contains data dump' : '✅ Processed information'}`);
      console.log(`   Car Rental Response: ${isCarRentalResponse ? '✅ Using new format' : '❌ Still using old format'}`);
      
      console.log('\n💬 Full Response:');
      console.log('─'.repeat(80));
      console.log(data.message);
      console.log('─'.repeat(80));
      
      // Overall assessment
      const isFixed = isReasonableLength && hasStructure && !hasDataDump && isCarRentalResponse;
      console.log(`\n🎯 Overall Status: ${isFixed ? '✅ FIXED - Using new concise format!' : '❌ STILL BROKEN - Using old data dump format'}`);
      
      if (!isFixed) {
        console.log('\n🔧 Issue Analysis:');
        if (!isReasonableLength) console.log('   - Response is too long');
        if (!hasStructure) console.log('   - Response lacks proper formatting');
        if (hasDataDump) console.log('   - Response contains raw data dump');
        if (!isCarRentalResponse) console.log('   - Response is not using the new car rental format');
      }
      
    } else {
      console.log(`❌ Error: HTTP ${result.status}`);
      console.log(`Response: ${JSON.stringify(result.data)}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCarRentalQuery(); 