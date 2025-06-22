const axios = require('axios');

class ChatbotTrainer {
    constructor() {
        this.baseUrl = 'http://localhost:3002';
        this.sessionId = null;
        this.currentQuestionIndex = 0;
        this.questions = [
            // Access Roads & Directions
            "How do I get to Muscat Airport from the city center?",
            "What's the best route to Muscat International Airport from Seeb?",
            "Which highway should I take to reach the airport?",
            "How do I find Muscat Airport when driving from other parts of Oman?",
            "Is there a map showing directions to the airport?",
            "What road connects Muscat Airport to the rest of the country?",
            "Where is Muscat Airport located on Sultan Qaboos Highway?",
            "How do I reach the airport from Burj Al Sahwa roundabout?",
            "What are the driving directions to Muscat Airport?",
            "Which side of the highway is the airport on when coming from Muscat?",
            
            // Pick-up & Drop-off
            "Where can I drop off passengers at Muscat Airport?",
            "How long can I wait in the pick-up area for free?",
            "What happens if I stay longer than 10 minutes at drop-off?",
            "Where should I pick up arriving passengers?",
            "Are there dedicated drop-off areas for business class passengers?",
            "What are the charges for staying in the forecourt area?",
            "Can I leave my car unattended in the drop-off zone?",
            "Is there a special area for Oman Air first class passengers?",
            
            // Car Parking
            "What are the parking rates at Muscat Airport?",
            "How much does short-term parking cost for 30 minutes?",
            "What's the difference between P1, P2, and P3 parking areas?",
            "How much is long-term parking per day?",
            "Where can I pay for parking at the airport?",
            "What are the charges for parking for 2 hours?",
            "Is there 24-hour parking available?",
            "How much does it cost to park for a week?",
            "What's the rate for parking between 1-2 hours?",
            "Are there different parking zones at Muscat Airport?",
            "What payment methods are accepted for parking?",
            "How much is premium parking at the airport?",
            
            // Taxi Services
            "Are taxis available at Muscat Airport?",
            "Where can I find taxis at the airport?",
            "Do airport taxis use meters?",
            "How much does a taxi cost from the airport to the city?",
            "Are taxis available 24/7 at Muscat Airport?",
            
            // Car Rental
            "Which car rental companies are available at Muscat Airport?",
            "Is Dollar car rental available at the airport?",
            "Where are the car rental offices located?",
            "Are car rental services open 24 hours?",
            "Can I rent a car at Muscat Airport arrivals hall?",
            "Which international car rental brands operate at the airport?",
            "Is Avis car rental available at Muscat Airport?",
            "Where do I return my rental car at the airport?",
            
            // Shuttle & Bus Services
            "Are there shuttle buses from hotels to the airport?",
            "Is public transportation available from Muscat Airport?",
            "Which company operates public buses from the airport?",
            "Do hotels provide free shuttle services to the airport?",
            "Where can I find the bus station at the airport?",
            "Are there private driver services available?",
            "How do I arrange hotel shuttle bus service to the airport?"
        ];
    }

    async createSession() {
        try {
            const response = await axios.post(`${this.baseUrl}/api/chat/session`);
            this.sessionId = response.data.sessionId;
            console.log(`✅ Session created: ${this.sessionId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to create session:', error.message);
            return false;
        }
    }

    async sendMessage(message) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/chat/send`, {
                sessionId: this.sessionId,
                message: message
            });
            return response.data.response;
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
            return null;
        }
    }

    async testQuestion(questionIndex) {
        if (questionIndex >= this.questions.length) {
            console.log('🎉 All questions tested!');
            return;
        }

        const question = this.questions[questionIndex];
        console.log(`\n📝 Testing Question ${questionIndex + 1}/${this.questions.length}:`);
        console.log(`❓ "${question}"`);
        console.log('⏳ Sending to chatbot...\n');

        const response = await this.sendMessage(question);
        
        if (response) {
            console.log('🤖 Chatbot Response:');
            console.log('=' .repeat(80));
            console.log(response);
            console.log('=' .repeat(80));
            
            // Analyze response quality
            this.analyzeResponse(question, response, questionIndex);
        } else {
            console.log('❌ No response received');
        }
    }

    analyzeResponse(question, response, questionIndex) {
        console.log('\n📊 RESPONSE ANALYSIS:');
        
        // Basic metrics
        console.log(`📏 Length: ${response.length} characters`);
        console.log(`📝 Word count: ${response.split(' ').length} words`);
        
        // Check for key elements
        const hasSpecificInfo = this.checkSpecificInfo(question, response);
        const hasLinks = response.includes('[') && response.includes('](');
        const hasFormatting = response.includes('**') || response.includes('•');
        
        console.log(`🔗 Contains links: ${hasLinks ? '✅' : '❌'}`);
        console.log(`🎨 Has formatting: ${hasFormatting ? '✅' : '❌'}`);
        console.log(`📋 Specific info: ${hasSpecificInfo ? '✅' : '❌'}`);
        
        // Overall assessment
        const score = this.calculateScore(hasSpecificInfo, hasLinks, hasFormatting, response);
        console.log(`\n⭐ Overall Score: ${score}/10`);
        
        if (score < 7) {
            console.log('⚠️  NEEDS IMPROVEMENT');
            this.suggestImprovements(question, response);
        } else {
            console.log('✅ SATISFACTORY RESPONSE');
        }
        
        console.log('\n' + '='.repeat(100));
    }

    checkSpecificInfo(question, response) {
        const questionLower = question.toLowerCase();
        const responseLower = response.toLowerCase();
        
        // Check based on question type
        if (questionLower.includes('parking') && questionLower.includes('rate')) {
            return responseLower.includes('omr') || responseLower.includes('rial');
        }
        
        if (questionLower.includes('car rental')) {
            return responseLower.includes('europcar') || responseLower.includes('avis') || 
                   responseLower.includes('budget') || responseLower.includes('dollar');
        }
        
        if (questionLower.includes('highway') || questionLower.includes('road')) {
            return responseLower.includes('sultan qaboos') || responseLower.includes('highway');
        }
        
        if (questionLower.includes('drop') || questionLower.includes('pick')) {
            return responseLower.includes('10 minutes') || responseLower.includes('free');
        }
        
        return true; // Default to true for general questions
    }

    calculateScore(hasSpecificInfo, hasLinks, hasFormatting, response) {
        let score = 0;
        
        // Base score for having a response
        score += 3;
        
        // Specific information
        if (hasSpecificInfo) score += 3;
        
        // Formatting and presentation
        if (hasFormatting) score += 2;
        if (hasLinks) score += 1;
        
        // Length appropriateness
        if (response.length > 100 && response.length < 800) score += 1;
        
        return Math.min(score, 10);
    }

    suggestImprovements(question, response) {
        console.log('\n💡 SUGGESTED IMPROVEMENTS:');
        
        if (!response.includes('**')) {
            console.log('- Add bold formatting for key information');
        }
        
        if (!response.includes('[') || !response.includes('](')) {
            console.log('- Include relevant links to source information');
        }
        
        if (response.length < 100) {
            console.log('- Provide more detailed information');
        }
        
        if (response.length > 800) {
            console.log('- Make response more concise');
        }
        
        const questionLower = question.toLowerCase();
        if (questionLower.includes('parking') && !response.toLowerCase().includes('omr')) {
            console.log('- Include specific parking rates in OMR');
        }
        
        if (questionLower.includes('car rental') && !response.toLowerCase().includes('europcar')) {
            console.log('- Mention specific car rental companies available');
        }
    }

    async runTraining() {
        console.log('🚀 Starting Chatbot FAQ Training');
        console.log(`📝 Total questions to test: ${this.questions.length}`);
        
        if (!(await this.createSession())) {
            return;
        }
        
        // Test first question
        await this.testQuestion(0);
        
        console.log('\n⏸️  Paused for analysis. Run testQuestion(1) to continue with next question.');
    }
}

// Create and export trainer instance
const trainer = new ChatbotTrainer();

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = trainer;
}

// Auto-start if run directly
if (require.main === module) {
    trainer.runTraining();
} 