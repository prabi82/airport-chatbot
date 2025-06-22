const axios = require('axios');

async function testSixthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 6: Testing road connection query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the sixth question
        const question = "What road connects Muscat Airport to the rest of the country?";
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
        console.log(`🛣️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`🛤️  Mentions highway/road: ${response.toLowerCase().includes('highway') || response.toLowerCase().includes('road') ? '✅' : '❌'}`);
        console.log(`🌍 Mentions country/connection: ${response.toLowerCase().includes('country') || response.toLowerCase().includes('connect') ? '✅' : '❌'}`);
        console.log(`⭕ Mentions roundabout: ${response.toLowerCase().includes('roundabout') || response.toLowerCase().includes('burj') ? '✅' : '❌'}`);
        console.log(`📍 Mentions main/primary: ${response.toLowerCase().includes('main') || response.toLowerCase().includes('primary') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'what road': ${response.toLowerCase().includes('sultan qaboos highway') || response.toLowerCase().includes('sultan qaboos road') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('sultan qaboos highway') || 
                               response.toLowerCase().includes('sultan qaboos road') ||
                               response.toLowerCase().includes('main sultan qaboos');
        
        const mentionsConnection = response.toLowerCase().includes('connect') || 
                                  response.toLowerCase().includes('country') ||
                                  response.toLowerCase().includes('routes');
        
        const isComplete = answersQuestion && mentionsConnection && response.length > 200;
        
        const hasSpecificInfo = response.toLowerCase().includes('burj al sahwa') || 
                               response.toLowerCase().includes('roundabout') ||
                               response.toLowerCase().includes('primary route');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`🌍 Mentions connection: ${mentionsConnection ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`📍 Has specific info: ${hasSpecificInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (mentionsConnection ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasSpecificInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer "what road" (should mention Sultan Qaboos Highway)');
            if (!mentionsConnection) console.log('- Missing connection information to rest of country');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasSpecificInfo) console.log('- Missing specific connection details (roundabout, routes)');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSixthQuestion(); 