const axios = require('axios');

async function testFifthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 5: Testing map directions query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the fifth question
        const question = "Is there a map showing directions to the airport?";
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
        console.log(`🗺️  Mentions map: ${response.toLowerCase().includes('map') ? '✅' : '❌'}`);
        console.log(`📍 Mentions directions: ${response.toLowerCase().includes('direction') || response.toLowerCase().includes('route') ? '✅' : '❌'}`);
        console.log(`🌐 Mentions website: ${response.toLowerCase().includes('website') || response.toLowerCase().includes('muscatairport.co.om') ? '✅' : '❌'}`);
        console.log(`✅ Answers 'is there': ${response.toLowerCase().includes('yes') || response.toLowerCase().includes('available') || response.toLowerCase().includes('can find') ? '✅' : '❌'}`);
        console.log(`🛣️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`📱 Mentions online/digital: ${response.toLowerCase().includes('online') || response.toLowerCase().includes('digital') || response.toLowerCase().includes('interactive') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('yes') || 
                               response.toLowerCase().includes('available') ||
                               response.toLowerCase().includes('can find') ||
                               response.toLowerCase().includes('map');
        
        const providesLocation = response.toLowerCase().includes('website') || 
                                response.toLowerCase().includes('muscatairport.co.om') ||
                                response.toLowerCase().includes('link');
        
        const isComplete = answersQuestion && providesLocation && response.length > 150;
        
        const hasDirections = response.toLowerCase().includes('directions') || 
                             response.toLowerCase().includes('route') ||
                             response.toLowerCase().includes('sultan qaboos');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Provides location/link: ${providesLocation ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has directions info: ${hasDirections ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (providesLocation ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasDirections ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer "is there a map"');
            if (!providesLocation) console.log('- Missing website/link information');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasDirections) console.log('- Missing directions information');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFifthQuestion(); 