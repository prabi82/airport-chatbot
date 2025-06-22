const axios = require('axios');

const API_BASE = 'http://localhost:3004/api';

async function testTaxiCost() {
    try {
        // Create session
        const sessionResponse = await axios.post(`${API_BASE}/chat/session`, {});
        const sessionId = sessionResponse.data.sessionId;

        // Test the problematic question
        const question = "How much does taxi cost to city center?";
        console.log(`❓ Question: ${question}`);
        
        const response = await axios.post(`${API_BASE}/chat/send`, {
            message: question,
            sessionId: sessionId
        });

        console.log(`✅ Response (${(response.data.confidence * 100).toFixed(1)}% confidence):`);
        console.log(response.data.response);
        console.log(`🎯 Intent: ${response.data.intent}`);
        
        // Also test a clearer taxi rate question
        const question2 = "What are taxi rates from airport?";
        console.log(`\n❓ Question: ${question2}`);
        
        const response2 = await axios.post(`${API_BASE}/chat/send`, {
            message: question2,
            sessionId: sessionId
        });

        console.log(`✅ Response (${(response2.data.confidence * 100).toFixed(1)}% confidence):`);
        console.log(response2.data.response);
        console.log(`🎯 Intent: ${response2.data.intent}`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

testTaxiCost(); 