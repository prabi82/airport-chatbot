const axios = require('axios');

async function testThirteenthQuestion() {
    try {
        console.log('🔍 TESTING QUESTION 13: Testing drop-off time limit query...');
        
        // Create session
        const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session: ${sessionId}`);
        
        // Test the thirteenth question
        const question = "What happens if I stay longer than 10 minutes at drop-off?";
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
        console.log(`🚗 Mentions drop-off: ${response.toLowerCase().includes('drop-off') || response.toLowerCase().includes('drop off') ? '✅' : '❌'}`);
        console.log(`⏰ Mentions time/longer: ${response.toLowerCase().includes('longer') || response.toLowerCase().includes('after') || response.toLowerCase().includes('10 minutes') ? '✅' : '❌'}`);
        console.log(`💰 Mentions charge/fee: ${response.toLowerCase().includes('charge') || response.toLowerCase().includes('fee') || response.toLowerCase().includes('omr') ? '✅' : '❌'}`);
        console.log(`🔢 Mentions specific amounts: ${response.toLowerCase().includes('2.100') || response.toLowerCase().includes('10-20') ? '✅' : '❌'}`);
        console.log(`📋 Mentions consequences: ${response.toLowerCase().includes('what happens') || response.toLowerCase().includes('charge applies') || response.toLowerCase().includes('additional') ? '✅' : '❌'}`);
        console.log(`🎯 Answers 'what happens': ${response.toLowerCase().includes('charge') || response.toLowerCase().includes('fee') || response.toLowerCase().includes('additional') ? '✅' : '❌'}`);
        
        // Quality assessment
        console.log('\n⭐ QUALITY ASSESSMENT:');
        const answersQuestion = response.toLowerCase().includes('drop') && 
                               (response.toLowerCase().includes('charge') || response.toLowerCase().includes('fee') || 
                                response.toLowerCase().includes('additional') || response.toLowerCase().includes('omr'));
        
        const hasSpecificInfo = response.toLowerCase().includes('2.100') || 
                               response.toLowerCase().includes('10-20') ||
                               response.toLowerCase().includes('omr');
        
        const isComplete = answersQuestion && hasSpecificInfo && response.length > 300;
        
        const hasUsefulInfo = response.toLowerCase().includes('unattended') || 
                             response.toLowerCase().includes('traffic warden') ||
                             response.toLowerCase().includes('parking');
        
        console.log(`🎯 Answers the question: ${answersQuestion ? '✅' : '❌'}`);
        console.log(`💰 Has specific charges: ${hasSpecificInfo ? '✅' : '❌'}`);
        console.log(`📋 Complete answer: ${isComplete ? '✅' : '❌'}`);
        console.log(`💡 Has useful info: ${hasUsefulInfo ? '✅' : '❌'}`);
        
        const score = (answersQuestion ? 3 : 0) + (hasSpecificInfo ? 3 : 0) + (isComplete ? 2 : 0) + 
                     (hasUsefulInfo ? 1 : 0) + (response.includes('**') ? 1 : 0);
        
        console.log(`\n🏆 OVERALL SCORE: ${score}/10`);
        
        if (score < 7) {
            console.log('\n⚠️  NEEDS IMPROVEMENT:');
            if (!answersQuestion) console.log('- Does not clearly answer what happens after 10 minutes');
            if (!hasSpecificInfo) console.log('- Missing specific charge information (OMR 2.100, 10-20 minutes)');
            if (!isComplete) console.log('- Response too brief or incomplete');
            if (!hasUsefulInfo) console.log('- Missing useful info (unattended vehicles, traffic wardens, parking)');
        } else {
            console.log('\n✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testThirteenthQuestion(); 