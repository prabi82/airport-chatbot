const axios = require('axios');

async function testQuestions15to18() {
    const questions = [
        {
            id: 15,
            question: "Are there dedicated drop-off areas for business class passengers?",
            category: "business_class_dropoff"
        },
        {
            id: 16,
            question: "What are the charges for staying in the forecourt area?",
            category: "forecourt_charges"
        },
        {
            id: 17,
            question: "Can I leave my car unattended in the drop-off zone?",
            category: "unattended_vehicle"
        },
        {
            id: 18,
            question: "Is there a special area for Oman Air first class passengers?",
            category: "first_class_area"
        }
    ];

    console.log('🔍 BATCH TESTING QUESTIONS 15-18: Pick-up & Drop-off Category');
    console.log('=' * 80);

    for (const q of questions) {
        try {
            console.log(`\n🔍 TESTING QUESTION ${q.id}: ${q.category}`);
            
            // Create session
            const sessionResponse = await axios.post('http://localhost:3002/api/chat/session');
            const sessionId = sessionResponse.data.sessionId;
            console.log(`✅ Session: ${sessionId}`);
            
            console.log(`❓ Question: "${q.question}"`);
            
            const chatResponse = await axios.post('http://localhost:3002/api/chat/send', {
                sessionId: sessionId,
                message: q.question
            });
            
            const response = chatResponse.data.response;
            console.log(`📏 Length: ${response.length} characters`);
            console.log(`📝 Words: ${response.split(' ').length}`);
            
            // Quick quality assessment
            const hasFormatting = response.includes('**');
            const hasLinks = response.includes('[') && response.includes('](');
            const isComprehensive = response.length > 200;
            const answersQuestion = response.toLowerCase().includes(q.category.split('_')[0]) || 
                                   response.toLowerCase().includes('business') || 
                                   response.toLowerCase().includes('first class') ||
                                   response.toLowerCase().includes('charge') ||
                                   response.toLowerCase().includes('unattended');
            
            const score = (answersQuestion ? 3 : 0) + (isComprehensive ? 2 : 0) + 
                         (hasFormatting ? 2 : 0) + (hasLinks ? 2 : 0) + 1;
            
            console.log(`🏆 Quick Score: ${score}/10`);
            console.log(`✅ ${score >= 7 ? 'SATISFACTORY' : 'NEEDS IMPROVEMENT'}`);
            
            if (score < 7) {
                console.log(`⚠️ Issues: ${!answersQuestion ? 'No answer, ' : ''}${!isComprehensive ? 'Too brief, ' : ''}${!hasFormatting ? 'No formatting, ' : ''}${!hasLinks ? 'No links' : ''}`);
            }
            
            console.log('-'.repeat(50));
            
        } catch (error) {
            console.error(`❌ Error testing Question ${q.id}:`, error.message);
        }
    }
    
    console.log('\n🎯 BATCH TEST COMPLETE');
    console.log('=' * 80);
}

testQuestions15to18(); 