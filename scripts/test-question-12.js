const axios = require('axios');

async function testTwelfthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 12: Testing pick-up area waiting time query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the twelfth question
        const question = "How long can I wait in the pick-up area for free?";
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
        console.log(`⏰ Mentions time/duration: ${response.toLowerCase().includes('minute') || response.toLowerCase().includes('hour') || response.toLowerCase().includes('time') ? '✅' : '❌'}`);
        console.log(`💰 Mentions free/charge: ${response.toLowerCase().includes('free') || response.toLowerCase().includes('charge') || response.toLowerCase().includes('cost') ? '✅' : '❌'}`);
        console.log(`📍 Mentions area/zone: ${response.toLowerCase().includes('area') || response.toLowerCase().includes('zone') ? '✅' : '❌'}`);
        console.log(`🔢 Mentions specific time: ${response.toLowerCase().includes('10') || response.toLowerCase().includes('15') || response.toLowerCase().includes('30') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'how long': ${response.toLowerCase().includes('minute') || response.toLowerCase().includes('hour') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('pick') && 
                               (response.toLowerCase().includes('minute') || response.toLowerCase().includes('hour') || 
                                response.toLowerCase().includes('free') || response.toLowerCase().includes('time'));
        
        const hasSpecificTime = response.toLowerCase().includes('10') || 
                               response.toLowerCase().includes('15') ||
                               response.toLowerCase().includes('30') ||
                               response.toLowerCase().includes('minutes');
        
        const isComplete = answersQuestion && response.length > 200;
        
        const hasUsefulInfo = response.toLowerCase().includes('charge') || 
                             response.toLowerCase().includes('fee') ||
                             response.toLowerCase().includes('penalty');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`⏰ Has specific time: ${hasSpecificTime ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`💡 Has useful info: ${hasUsefulInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificTime ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasUsefulInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer how long you can wait for free');
            if (!hasSpecificTime) console.log('- Missing specific time duration (10, 15, 30 minutes)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasUsefulInfo) console.log('- Missing useful info about charges/fees after free period');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTwelfthQuestion(); 