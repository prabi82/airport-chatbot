const axios = require('axios');

async function testTenthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 10: Testing highway side query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the tenth question
        const question = "Which side of the highway is the airport on when coming from Muscat?";
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
        console.log(`🏙️ Mentions Muscat: ${response.toLowerCase().includes('muscat') ? '✅' : '❌'}`);
        console.log(`🛣️  Mentions highway/road: ${response.toLowerCase().includes('highway') || response.toLowerCase().includes('road') ? '✅' : '❌'}`);
        console.log(`🧭 Mentions side/direction: ${response.toLowerCase().includes('side') || response.toLowerCase().includes('left') || response.toLowerCase().includes('right') ? '✅' : '❌'}`);
        console.log(`🗺️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`📍 Mentions coming from: ${response.toLowerCase().includes('coming from') || response.toLowerCase().includes('from muscat') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'which side': ${response.toLowerCase().includes('left') || response.toLowerCase().includes('right') || response.toLowerCase().includes('side') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = (response.toLowerCase().includes('left') || response.toLowerCase().includes('right') || 
                                response.toLowerCase().includes('side')) && 
                               response.toLowerCase().includes('muscat');
        
        const hasSpecificSide = response.toLowerCase().includes('left side') || 
                               response.toLowerCase().includes('right side') ||
                               response.toLowerCase().includes('left') ||
                               response.toLowerCase().includes('right');
        
        const isComplete = answersQuestion && hasSpecificSide && response.length > 200;
        
        const hasContext = response.toLowerCase().includes('sultan qaboos') && 
                          (response.toLowerCase().includes('highway') || response.toLowerCase().includes('road'));
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`🧭 Has specific side: ${hasSpecificSide ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has context: ${hasContext ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificSide ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasContext ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer which side of highway');
            if (!hasSpecificSide) console.log('- Missing specific side information (left/right)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasContext) console.log('- Missing context about Sultan Qaboos Highway');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTenthQuestion(); 