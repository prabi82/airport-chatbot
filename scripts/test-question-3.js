const axios = require('axios');

async function testThirdQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 3: Testing highway query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the third question
        const question = "Which highway should I take to reach the airport?";
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
        console.log(`🛤️  Mentions highway: ${response.toLowerCase().includes('highway') ? '✅' : '❌'}`);
        console.log(`🗺️  Mentions directions: ${response.toLowerCase().includes('direction') || response.toLowerCase().includes('route') ? '✅' : '❌'}`);
        console.log(`🚗 Mentions main road: ${response.toLowerCase().includes('main') || response.toLowerCase().includes('road') ? '✅' : '❌'}`);
        console.log(`📍 Mentions location: ${response.toLowerCase().includes('between') || response.toLowerCase().includes('located') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'which': ${response.toLowerCase().includes('sultan qaboos highway') || response.toLowerCase().includes('main sultan qaboos') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('sultan qaboos highway') || 
                               response.toLowerCase().includes('main sultan qaboos road');
        
        const hasSpecificAnswer = response.toLowerCase().includes('sultan qaboos') && 
                                 response.toLowerCase().includes('highway');
        
        const isComplete = answersQuestion && response.length > 150;
        
        const hasContext = response.toLowerCase().includes('between') || 
                          response.toLowerCase().includes('located') ||
                          response.toLowerCase().includes('main');
        
        console.log(`🎯 Answers 'which highway': ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific answer: ${hasSpecificAnswer ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has context/location: ${hasContext ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 4 : 0) + (hasSpecificAnswer ? 2 : 0) + (isComplete ? 2 : 0) + 
                     (hasContext ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer "which highway" (should mention Sultan Qaboos Highway)');
            if (!hasSpecificAnswer) console.log('- Missing specific highway name');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasContext) console.log('- Missing location context');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testThirdQuestion(); 