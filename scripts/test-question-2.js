const axios = require('axios');

async function testSecondQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 2: Testing Seeb route query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the second question
        const question = "What's the best route to Muscat International Airport from Seeb?";
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
        console.log(`🏘️  Mentions Seeb: ${response.toLowerCase().includes('seeb') ? '✅' : '❌'}`);
        console.log(`🗺️  Mentions directions: ${response.toLowerCase().includes('direction') || response.toLowerCase().includes('route') || response.toLowerCase().includes('highway') ? '✅' : '❌'}`);
        console.log(`🚗 Mentions access road: ${response.toLowerCase().includes('access') || response.toLowerCase().includes('road') ? '✅' : '❌'}`);
        console.log(`⬅️  Mentions left side: ${response.toLowerCase().includes('left') ? '✅' : '❌'}`);
        console.log(`🌊 Mentions sea position: ${response.toLowerCase().includes('sea') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const hasDirections = response.toLowerCase().includes('sultan qaboos') || 
                             response.toLowerCase().includes('highway') ||
                             response.toLowerCase().includes('directions') ||
                             response.toLowerCase().includes('route');
        
        const isRelevant = response.toLowerCase().includes('seeb') && 
                          (response.toLowerCase().includes('east') || response.toLowerCase().includes('towards muscat'));
        
        const hasSpecificDetails = response.toLowerCase().includes('left') && 
                                  response.toLowerCase().includes('sea');
        
        const isComplete = hasDirections && isRelevant && response.length > 200;
        
        console.log(`📍 Contains directions: ${hasDirections ? '✅' : '❌'}`);
        console.log(`🎯 Relevant to Seeb query: ${isRelevant ? '✅' : '❌'}`);
        console.log(`📋 Has specific details: ${hasSpecificDetails ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        
        const score = (hasDirections ? 2 : 0) + (isRelevant ? 3 : 0) + (hasSpecificDetails ? 2 : 0) + 
                     (isComplete ? 1 : 0) + (response.includes('**') ? 1 : 0) + (response.includes('[') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!hasDirections) console.log('- Missing specific directions (Sultan Qaboos Highway)');
            if (!isRelevant) console.log('- Not answering the specific question about Seeb route');
            if (!hasSpecificDetails) console.log('- Missing specific details (left side, sea position)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (response.length < 200) console.log('- Needs more detailed information');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSecondQuestion(); 