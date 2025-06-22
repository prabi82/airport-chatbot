/**
 * Test script for concise responses
 * Tests the improved AI processor with concise, summarized responses
 */

const http = require('http');

const testQueries = [
  {
    query: "Is car rental available at Muscat Airport?",
    expectedType: "car_rental",
    description: "Car rental availability test"
  },
  {
    query: "Can I rent a car at the airport?",
    expectedType: "car_rental", 
    description: "Car rental simple query test"
  },
  {
    query: "Are taxis available at Muscat Airport?",
    expectedType: "taxi_info",
    description: "Taxi availability test"
  },
  {
    query: "Is there a shuttle bus from Muscat Airport?",
    expectedType: "shuttle_bus",
    description: "Shuttle bus availability test"
  }
];

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

async function testConciseResponses() {
  console.log('🧪 Testing Concise Response System');
  console.log('=====================================\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3010,
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

    // Test each query
    for (let i = 0; i < testQueries.length; i++) {
      const test = testQueries[i];
      console.log(`🔍 Test ${i + 1}/${testQueries.length}: ${test.description}`);
      console.log(`Query: "${test.query}"`);
      
      const startTime = Date.now();
      
      try {
        const chatOptions = {
          ...baseOptions,
          path: '/api/chat/send',
          method: 'POST'
        };
        
        const requestData = JSON.stringify({
          message: test.query,
          sessionId: sessionId
        });
        
        const result = await makeRequest(chatOptions, requestData);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (result.status === 200) {
          const data = result.data;
          
          console.log(`⏱️  Response time: ${responseTime}ms`);
          console.log(`📏 Response length: ${data.message.length} characters`);
          console.log(`🎯 Intent: ${data.intent || 'Unknown'}`);
          console.log(`🔍 Confidence: ${data.confidence || 'N/A'}`);
          
          // Analyze response quality
          const isReasonableLength = data.message.length < 1000;
          const hasStructure = data.message.includes('**') || data.message.includes('•') || data.message.includes('✅');
          const hasDataDump = data.message.includes('|') && data.message.split('|').length > 10;
          
          console.log('\n📊 Quality Analysis:');
          console.log(`   Length: ${isReasonableLength ? '✅ Concise' : '⚠️ Too long'} (${data.message.length} chars)`);
          console.log(`   Structure: ${hasStructure ? '✅ Well formatted' : '⚠️ Plain text'}`);
          console.log(`   Data Quality: ${hasDataDump ? '❌ Contains data dump' : '✅ Processed information'}`);
          
          console.log('\n💬 Response:');
          console.log('─'.repeat(50));
          console.log(data.message);
          console.log('─'.repeat(50));
          
          // Overall assessment
          const isGoodResponse = isReasonableLength && hasStructure && !hasDataDump;
          console.log(`\n🎯 Overall: ${isGoodResponse ? '✅ GOOD - Concise and structured' : '⚠️ NEEDS IMPROVEMENT'}`);
          
        } else {
          console.log(`❌ Error: HTTP ${result.status}`);
          console.log(`Response: ${JSON.stringify(result.data)}`);
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('🏁 Testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testConciseResponses(); 