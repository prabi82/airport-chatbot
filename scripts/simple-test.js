const axios = require('axios');

async function testFirstQuestion() {
    try {
        console.log('🚀 Testing first FAQ question...');
        
        // Create session
        console.log('📝 Creating session...');
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session created: ${sessionId}`);
        
        // Test first question
        const question = "How do I get to Muscat Airport from the city center?";
        console.log(`\n❓ Testing: "${question}"`);
        console.log('⏳ Sending to chatbot...');
        
        const chatResponse = await axios.post('http://localhost:3002/api/chat/send', {
            sessionId: sessionId,
            message: question
        });
        
        const response = chatResponse.data.response;
        console.log('\n🤖 Chatbot Response:');
        console.log('='.repeat(80));
        console.log(response);
        console.log('='.repeat(80));
        
        // Basic analysis
        console.log('\n📊 ANALYSIS:');
        console.log(`📏 Length: ${response.length} characters`);
        console.log(`📝 Words: ${response.split(' ').length}`);
        console.log(`🔗 Has links: ${response.includes('[') && response.includes('](') ? '✅' : '❌'}`);
        console.log(`🎨 Has formatting: ${response.includes('**') ? '✅' : '❌'}`);
        console.log(`🛣️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`🏙️  Mentions city center: ${response.toLowerCase().includes('city') || response.toLowerCase().includes('muscat') ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testFirstQuestion(); 