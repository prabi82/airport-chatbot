const axios = require('axios');

async function testFourteenthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 14: Testing passenger pickup location query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the fourteenth question
        const question = "Where should I pick up arriving passengers?";
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
        console.log(`🚗 Mentions pick-up: ${response.toLowerCase().includes('pick-up') || response.toLowerCase().includes('pick up') ? '✅' : '❌'}`);
        console.log(`👥 Mentions passengers/arriving: ${response.toLowerCase().includes('passenger') || response.toLowerCase().includes('arriving') || response.toLowerCase().includes('arrival') ? '✅' : '❌'}`);
        console.log(`📍 Mentions location/area: ${response.toLowerCase().includes('area') || response.toLowerCase().includes('zone') || response.toLowerCase().includes('terminal') ? '✅' : '❌'}`);
        console.log(`🏢 Mentions arrival terminal: ${response.toLowerCase().includes('arrival') && response.toLowerCase().includes('terminal') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'where should I': ${response.toLowerCase().includes('front of') || response.toLowerCase().includes('arrival') || response.toLowerCase().includes('location') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('pick') && 
                               (response.toLowerCase().includes('arrival') || response.toLowerCase().includes('terminal') ||
                                response.toLowerCase().includes('front') || response.toLowerCase().includes('area'));
        
        const hasSpecificLocation = response.toLowerCase().includes('arrival terminal') || 
                                   response.toLowerCase().includes('front of arrival') ||
                                   response.toLowerCase().includes('pick-up area');
        
        const isComplete = answersQuestion && hasSpecificLocation && response.length > 300;
        
        const hasUsefulInfo = response.toLowerCase().includes('10 minutes') || 
                             response.toLowerCase().includes('free') ||
                             response.toLowerCase().includes('signage');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific location: ${hasSpecificLocation ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`💡 Has useful info: ${hasUsefulInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificLocation ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasUsefulInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer where to pick up passengers');
            if (!hasSpecificLocation) console.log('- Missing specific location (arrival terminal, front of arrival, pick-up area)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasUsefulInfo) console.log('- Missing useful info (time limits, signage, coordination)');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFourteenthQuestion(); 