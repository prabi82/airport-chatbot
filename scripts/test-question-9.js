const axios = require('axios');

async function testNinthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 9: Testing general driving directions query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the ninth question
        const question = "What are the driving directions to Muscat Airport?";
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
        console.log(`🗺️  Mentions directions: ${response.toLowerCase().includes('direction') || response.toLowerCase().includes('route') ? '✅' : '❌'}`);
        console.log(`🛣️  Mentions Sultan Qaboos: ${response.toLowerCase().includes('sultan qaboos') ? '✅' : '❌'}`);
        console.log(`🏙️ Mentions multiple routes: ${(response.toLowerCase().includes('muscat') && response.toLowerCase().includes('seeb')) || response.toLowerCase().includes('other parts') ? '✅' : '❌'}`);
        console.log(`📍 Mentions location: ${response.toLowerCase().includes('located') || response.toLowerCase().includes('between') ? '✅' : '❌'}`);
        console.log(`🚗 Mentions driving steps: ${response.toLowerCase().includes('take') || response.toLowerCase().includes('follow') ? '✅' : '❌'}`);
        console.log(`🎯 General comprehensive: ${response.toLowerCase().includes('highway') && response.toLowerCase().includes('signage') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('direction') && 
                               response.toLowerCase().includes('sultan qaboos') &&
                               (response.toLowerCase().includes('take') || response.toLowerCase().includes('follow'));
        
        const hasMultipleRoutes = (response.toLowerCase().includes('muscat') && response.toLowerCase().includes('seeb')) || 
                                 response.toLowerCase().includes('other parts') ||
                                 response.toLowerCase().includes('city center');
        
        const isComplete = answersQuestion && hasMultipleRoutes && response.length > 300;
        
        const hasComprehensiveInfo = response.toLowerCase().includes('signage') && 
                                    response.toLowerCase().includes('highway') &&
                                    response.toLowerCase().includes('access');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`🗺️ Has multiple routes: ${hasMultipleRoutes ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`📍 Comprehensive info: ${hasComprehensiveInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasMultipleRoutes ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasComprehensiveInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly provide driving directions');
            if (!hasMultipleRoutes) console.log('- Missing multiple route options (Muscat, Seeb, other parts)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasComprehensiveInfo) console.log('- Missing comprehensive info (signage, highway, access)');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testNinthQuestion(); 