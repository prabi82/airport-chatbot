// Test script for AI source filtering
const fetch = require('node-fetch');

async function testSourceFiltering() {
  console.log('🧪 Testing updated source filtering via API...\n');
  
  try {
    // Test KFC query via API
    console.log('🔍 Testing: "where is KFC located?"');
    const response1 = await fetch('http://localhost:3000/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'where is KFC located?',
        sessionId: 'test-session-' + Date.now()
      })
    });
    
    const data1 = await response1.json();
    
    console.log('✅ Response received');
    console.log('📄 Message length:', data1.message ? data1.message.length : 0);
    console.log('🔗 Number of sources:', data1.sources ? data1.sources.length : 0);
    
    if (data1.sources && data1.sources.length > 0) {
      console.log('📚 Sources found:');
      data1.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${source}`);
      });
    } else {
      console.log('❌ No sources returned');
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Test a general dining query
    console.log('🔍 Testing: "what dining options are available?"');
    const response2 = await fetch('http://localhost:3000/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'what dining options are available?',
        sessionId: 'test-session-' + Date.now()
      })
    });
    
    const data2 = await response2.json();
    
    console.log('✅ Response received');
    console.log('📄 Message length:', data2.message ? data2.message.length : 0);
    console.log('🔗 Number of sources:', data2.sources ? data2.sources.length : 0);
    
    if (data2.sources && data2.sources.length > 0) {
      console.log('📚 Sources found:');
      data2.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${source}`);
      });
    } else {
      console.log('❌ No sources returned');
    }
    
  } catch (error) {
    console.error('❌ Error testing source filtering:', error);
  }
  
  process.exit(0);
}

testSourceFiltering(); 