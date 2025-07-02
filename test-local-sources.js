// Quick test for local development sources
async function testLocalSources() {
  try {
    console.log('🧪 Testing local development sources...\n');
    
    // Create session
    const sessionResponse = await fetch('http://localhost:3000/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' })
    });
    
    const sessionData = await sessionResponse.json();
    console.log('✅ Session created:', sessionData.sessionId);
    
    // Test KFC query
    const chatResponse = await fetch('http://localhost:3000/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'is KFC available?',
        sessionId: sessionData.sessionId
      })
    });
    
    const chatData = await chatResponse.json();
    console.log('\n📊 Chat Response:');
    console.log('- Success:', chatData.success);
    console.log('- Provider:', chatData.provider);
    console.log('- Sources count:', chatData.sources ? chatData.sources.length : 0);
    console.log('- Sources:', chatData.sources);
    
    if (chatData.sources && chatData.sources.length > 0) {
      console.log('\n🎉 SUCCESS: Sources are working locally!');
      chatData.sources.forEach((source, index) => {
        console.log(`  ${index + 1}. ${source}`);
      });
    } else {
      console.log('\n❌ ISSUE: No sources returned locally');
    }
    
  } catch (error) {
    console.error('❌ Error testing local sources:', error.message);
  }
}

testLocalSources(); 