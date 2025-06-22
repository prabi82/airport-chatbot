const axios = require('axios');

async function testFourthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 4: Testing other parts of Oman query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the fourth question
        const question = "How do I find Muscat Airport when driving from other parts of Oman?";
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
        console.log(`🌍 Mentions other parts: ${response.toLowerCase().includes('other parts') || response.toLowerCase().includes('country') ? '✅' : '❌'}`);
        console.log(`⭕ Mentions roundabout: ${response.toLowerCase().includes('roundabout') || response.toLowerCase().includes('burj') ? '✅' : '❌'}`);
        console.log(`🗺️  Mentions signage: ${response.toLowerCase().includes('signage') || response.toLowerCase().includes('signpost') ? '✅' : '❌'}`);
        console.log(`📍 Mentions connection: ${response.toLowerCase().includes('connect') || response.toLowerCase().includes('routes') ? '✅' : '❌'}`);
        console.log(`🎯 Answers question: ${response.toLowerCase().includes('burj al sahwa') || response.toLowerCase().includes('other parts') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('other parts') || 
                               response.toLowerCase().includes('burj al sahwa') ||
                               response.toLowerCase().includes('country');
        
        const hasSpecificInfo = response.toLowerCase().includes('burj al sahwa') || 
                               response.toLowerCase().includes('roundabout');
        
        const isComplete = answersQuestion && response.length > 200;
        
        const hasDirections = response.toLowerCase().includes('sultan qaboos') && 
                             (response.toLowerCase().includes('signage') || response.toLowerCase().includes('signpost'));
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific info: ${hasSpecificInfo ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has directions: ${hasDirections ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificInfo ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasDirections ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not address driving from "other parts of Oman"');
            if (!hasSpecificInfo) console.log('- Missing specific landmarks (Burj Al Sahwa roundabout)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasDirections) console.log('- Missing directional guidance');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFourthQuestion(); 