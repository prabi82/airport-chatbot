const axios = require('axios');

async function testEighthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 8: Testing Burj Al Sahwa roundabout query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the eighth question
        const question = "How do I reach the airport from Burj Al Sahwa roundabout?";
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
        console.log(`⭕ Mentions Burj Al Sahwa: ${response.toLowerCase().includes('burj al sahwa') ? '✅' : '❌'}`);
        console.log(`🔄 Mentions roundabout: ${response.toLowerCase().includes('roundabout') ? '✅' : '❌'}`);
        console.log(`🗺️  Mentions directions: ${response.toLowerCase().includes('direction') || response.toLowerCase().includes('route') ? '✅' : '❌'}`);
        console.log(`🛣️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`📍 Mentions western side: ${response.toLowerCase().includes('western') || response.toLowerCase().includes('west') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'how do I': ${response.toLowerCase().includes('take') || response.toLowerCase().includes('follow') || response.toLowerCase().includes('go') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('burj al sahwa') && 
                               (response.toLowerCase().includes('take') || response.toLowerCase().includes('follow') || 
                                response.toLowerCase().includes('go') || response.toLowerCase().includes('reach'));
        
        const hasSpecificDirections = response.toLowerCase().includes('western side') || 
                                     response.toLowerCase().includes('signage') ||
                                     response.toLowerCase().includes('entrance');
        
        const isComplete = answersQuestion && hasSpecificDirections && response.length > 200;
        
        const hasContext = response.toLowerCase().includes('connects') || 
                          response.toLowerCase().includes('country') ||
                          response.toLowerCase().includes('highways');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific directions: ${hasSpecificDirections ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has context: ${hasContext ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificDirections ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasContext ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer how to reach from Burj Al Sahwa roundabout');
            if (!hasSpecificDirections) console.log('- Missing specific directions (western side, signage, entrance)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasContext) console.log('- Missing context about connections to country/highways');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testEighthQuestion(); 