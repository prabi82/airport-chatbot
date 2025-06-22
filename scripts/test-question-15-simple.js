const axios = require('axios');

async function testQuestion15() {
    console.log('🔍 TESTING QUESTION 15: Business class drop-off areas');
    
    try {
        console.log('Creating session...');
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        const question = "Are there dedicated drop-off areas for business class passengers?";
        console.log(`❓ Question: "${question}"`);
        
        console.log('Sending message...');
        const chatResponse = await axios.post('http://localhost:3002/api/chat/send', {
            sessionId: sessionId,
            message: question
        });
        
        const response = chatResponse.data.response;
        console.log('\n🤖 RESPONSE:');
        console.log('=' * 80);
        console.log(response);
        console.log('=' * 80);
        
        console.log(`📏 Length: ${response.length} characters`);
        console.log(`📝 Words: ${response.split(' ').length}`);
        
        // Quality check
        const hasBusinessMention = response.toLowerCase().includes('business');
        const hasDropoffMention = response.toLowerCase().includes('drop') || response.toLowerCase().includes('area');
        const hasFormatting = response.includes('**');
        const hasLinks = response.includes('[') && response.includes('](');
        const isComprehensive = response.length > 200;
        
        console.log('\n📊 QUALITY ANALYSIS:');
        console.log(`✅ Mentions business: ${hasBusinessMention}`);
        console.log(`✅ Mentions drop-off/area: ${hasDropoffMention}`);
        console.log(`✅ Has formatting: ${hasFormatting}`);
        console.log(`✅ Has links: ${hasLinks}`);
        console.log(`✅ Comprehensive: ${isComprehensive}`);
        
        const score = (hasBusinessMention ? 2 : 0) + (hasDropoffMention ? 2 : 0) + 
                     (hasFormatting ? 2 : 0) + (hasLinks ? 2 : 0) + (isComprehensive ? 2 : 0);
        
        console.log(`🏆 Score: ${score}/10`);
        console.log(`${score >= 7 ? '✅ SATISFACTORY' : '❌ NEEDS IMPROVEMENT'}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testQuestion15(); 