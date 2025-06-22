const axios = require('axios');

async function testEleventhQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 11: Testing passenger drop-off location query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the eleventh question
        const question = "Where can I drop off passengers at Muscat Airport?";
        console.log(`\n❓ Question: "${question}"`);
        
        const chatResponse = await axios.post('http://localhost:3002/api/chat/send', {
            sessionId: sessionId,
            message: question
        });
        
        const response = chatResponse.data.response;
        console.log('\n🤖 RESPONSE:');
        console.log('='.repeat(80));
        console.log(response);
        console.log('='.repeat(80));
        
        // Detailed analysis
        console.log('\n📊 DETAILED ANALYSIS:');
        console.log(`📏 Length: ${response.length} characters`);
        console.log(`📝 Words: ${response.split(' ').length}`);
        console.log(`🔗 Has links: ${response.includes('[') && response.includes('](') ? '✅' : '❌'}`);
        console.log(`🎨 Has formatting: ${response.includes('**') ? '✅' : '❌'}`);
        console.log(`🚗 Mentions drop-off: ${response.toLowerCase().includes('drop-off') || response.toLowerCase().includes('drop off') ? '✅' : '❌'}`);
        console.log(`👥 Mentions passengers: ${response.toLowerCase().includes('passenger') ? '✅' : '❌'}`);
        console.log(`📍 Mentions location/area: ${response.toLowerCase().includes('area') || response.toLowerCase().includes('zone') || response.toLowerCase().includes('forecourt') ? '✅' : '❌'}`);
        console.log(`🏢 Mentions terminal: ${response.toLowerCase().includes('terminal') || response.toLowerCase().includes('departure') ? '✅' : '❌'}`);
        console.log(`⏰ Mentions time limit: ${response.toLowerCase().includes('minute') || response.toLowerCase().includes('time') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'where': ${response.toLowerCase().includes('forecourt') || response.toLowerCase().includes('departure') || response.toLowerCase().includes('terminal') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('drop') && 
                               (response.toLowerCase().includes('forecourt') || response.toLowerCase().includes('departure') || 
                                response.toLowerCase().includes('terminal') || response.toLowerCase().includes('area'));
        
        const hasSpecificLocation = response.toLowerCase().includes('forecourt') || 
                                   response.toLowerCase().includes('departure terminal') ||
                                   response.toLowerCase().includes('drop-off area');
        
        const isComplete = answersQuestion && hasSpecificLocation && response.length > 200;
        
        const hasUsefulInfo = response.toLowerCase().includes('minute') || 
                             response.toLowerCase().includes('charge') ||
                             response.toLowerCase().includes('free');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific location: ${hasSpecificLocation ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`💡 Has useful info: ${hasUsefulInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificLocation ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasUsefulInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer where to drop off passengers');
            if (!hasSpecificLocation) console.log('- Missing specific location (forecourt, departure terminal, drop-off area)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasUsefulInfo) console.log('- Missing useful info (time limits, charges, free period)');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testEleventhQuestion(); 