const axios = require('axios');

const API_BASE = 'http://localhost:3004/api';

const testQuestions = [
    {
        type: "Yes/No Questions (Should get concise answers)",
        questions: [
            "Is there local taxi available at the airport?",
            "Are taxis available 24/7 at Muscat Airport?", 
            "Is public transportation available from Muscat Airport?",
            "Can I rent a car at the airport?",
            "Is parking available at Muscat Airport?"
        ]
    },
    {
        type: "Rate/Cost Questions (Should get specific rates)",
        questions: [
            "How much does taxi cost to city center?",
            "What are the parking rates?",
            "What is the cost of public transport?"
        ]
    },
    {
        type: "Location Questions (Should get location info)",
        questions: [
            "Where can I find taxis at the airport?",
            "Where is the car rental desk?",
            "Where is the bus stop?"
        ]
    }
];

async function testQuestion(question) {
    try {
        // Create session
        const sessionResponse = await axios.post(`${API_BASE}/chat/session`, {});
        const sessionId = sessionResponse.data.sessionId;

        // Send question
        const response = await axios.post(`${API_BASE}/chat/send`, {
            message: question,
            sessionId: sessionId
        });

        return {
            success: true,
            response: response.data.response,
            confidence: response.data.confidence,
            intent: response.data.intent
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function runTests() {
    console.log('🧠 Testing Concise AI Responses\n');
    console.log('='.repeat(50));
    
    for (const category of testQuestions) {
        console.log(`\n📋 ${category.type}`);
        console.log('-'.repeat(40));
        
        for (const question of category.questions) {
            console.log(`\n❓ Question: ${question}`);
            
            const result = await testQuestion(question);
            
            if (result.success) {
                console.log(`✅ Response (${(result.confidence * 100).toFixed(1)}% confidence):`);
                console.log(result.response);
                console.log(`🎯 Intent: ${result.intent}`);
            } else {
                console.log(`❌ Error: ${result.error}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✨ Test completed! Notice how responses are now concise and targeted.');
}

// Run the tests
runTests().catch(console.error); 