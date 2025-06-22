const axios = require('axios');

async function testSeventhQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 7: Testing airport location on highway query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the seventh question
        const question = "Where is Muscat Airport located on Sultan Qaboos Highway?";
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
        console.log(`📍 Mentions location: ${response.toLowerCase().includes('located') || response.toLowerCase().includes('location') ? '✅' : '❌'}`);
        console.log(`🏙️ Mentions between cities: ${response.toLowerCase().includes('between') && (response.toLowerCase().includes('muscat') || response.toLowerCase().includes('seeb')) ? '✅' : '❌'}`);
        console.log(`🛤️  Mentions highway: ${response.toLowerCase().includes('highway') || response.toLowerCase().includes('road') ? '✅' : '❌'}`);
        console.log(`📍 Mentions strategic: ${response.toLowerCase().includes('strategic') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'where': ${response.toLowerCase().includes('between muscat and') || response.toLowerCase().includes('on sultan qaboos') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('between muscat and') || 
                               response.toLowerCase().includes('on sultan qaboos highway') ||
                               (response.toLowerCase().includes('located') && response.toLowerCase().includes('sultan qaboos'));
        
        const hasSpecificLocation = response.toLowerCase().includes('between muscat and al-seeb') || 
                                   response.toLowerCase().includes('between muscat and seeb') ||
                                   response.toLowerCase().includes('main sultan qaboos road');
        
        const isComplete = answersQuestion && hasSpecificLocation && response.length > 150;
        
        const hasContext = response.toLowerCase().includes('strategic') || 
                          response.toLowerCase().includes('accessible') ||
                          response.toLowerCase().includes('connects');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`📍 Has specific location: ${hasSpecificLocation ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`🗺️ Has context: ${hasContext ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificLocation ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasContext ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer "where" on Sultan Qaboos Highway');
            if (!hasSpecificLocation) console.log('- Missing specific location details (between Muscat and Al-Seeb)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasContext) console.log('- Missing context about strategic location');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSeventhQuestion(); 