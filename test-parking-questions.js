const axios = require('axios');

// Car Parking Questions from to_and_from_faq.md
const parkingQuestions = [
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
  "How much is premium parking at the airport?"
];

async function testParkingQuestion(question, questionNumber) {
  try {
    console.log(`\n🅿️ **Question ${questionNumber}: "${question}"**`);
    console.log('='.repeat(80));
    
    // Create session
    const sessionResponse = await axios.post('http://localhost:3003/api/chat/session', {});
    const sessionId = sessionResponse.data.sessionId;
    console.log(`✅ Session created: ${sessionId}`);
    
    // Send question
    const chatResponse = await axios.post('http://localhost:3003/api/chat/send', {
      sessionId: sessionId,
      message: question
    });
    
    const result = chatResponse.data;
    console.log(`\n📤 **Response:**`);
    console.log(result.response);
    console.log(`\n📊 **Metrics:**`);
    console.log(`- Intent: ${result.intent}`);
    console.log(`- Confidence: ${result.confidence}`);
    console.log(`- Response Time: ${result.responseTime}ms`);
    console.log(`- Sources: ${result.sources?.length || 0}`);
    
    // Simple scoring based on response quality
    let score = 0;
    if (result.intent === 'transportation') score += 3;
    if (result.confidence >= 0.8) score += 2;
    if (result.response.includes('OMR') || result.response.includes('parking')) score += 2;
    if (result.response.includes('P1') || result.response.includes('P3')) score += 1;
    if (result.response.length > 200) score += 1;
    if (result.response.includes('**') && result.response.includes('•')) score += 1;
    
    console.log(`\n🎯 **Score: ${score}/10**`);
    
    if (score >= 8) {
      console.log('✅ **EXCELLENT** - Response is comprehensive and well-formatted');
    } else if (score >= 6) {
      console.log('⚠️ **GOOD** - Response is adequate but could be improved');
    } else if (score >= 4) {
      console.log('❌ **NEEDS IMPROVEMENT** - Response has issues');
    } else {
      console.log('🚨 **POOR** - Response is inadequate');
    }
    
    return { question, score, intent: result.intent, confidence: result.confidence };
    
  } catch (error) {
    console.error(`❌ Error testing question ${questionNumber}:`, error.message);
    return { question, score: 0, error: error.message };
  }
}

async function testAllParkingQuestions() {
  console.log('🚀 **Starting Car Parking Questions Testing**');
  console.log(`📋 Total Questions: ${parkingQuestions.length}`);
  
  const results = [];
  
  for (let i = 0; i < parkingQuestions.length; i++) {
    const result = await testParkingQuestion(parkingQuestions[i], i + 1);
    results.push(result);
    
    // Wait 2 seconds between questions to avoid overwhelming the server
    if (i < parkingQuestions.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next question...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary Report
  console.log('\n' + '='.repeat(80));
  console.log('📊 **FINAL SUMMARY REPORT**');
  console.log('='.repeat(80));
  
  const excellent = results.filter(r => r.score >= 8).length;
  const good = results.filter(r => r.score >= 6 && r.score < 8).length;
  const needsImprovement = results.filter(r => r.score >= 4 && r.score < 6).length;
  const poor = results.filter(r => r.score < 4).length;
  
  console.log(`✅ **Excellent (8-10):** ${excellent} questions`);
  console.log(`⚠️ **Good (6-7):** ${good} questions`);
  console.log(`❌ **Needs Improvement (4-5):** ${needsImprovement} questions`);
  console.log(`🚨 **Poor (0-3):** ${poor} questions`);
  
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  console.log(`\n🎯 **Average Score:** ${averageScore.toFixed(1)}/10`);
  
  const successRate = ((excellent + good) / results.length * 100).toFixed(1);
  console.log(`📈 **Success Rate:** ${successRate}% (Good or Excellent)`);
  
  // Questions needing improvement
  const needsWork = results.filter(r => r.score < 6);
  if (needsWork.length > 0) {
    console.log('\n🔧 **Questions Needing Improvement:**');
    needsWork.forEach((result, index) => {
      console.log(`${index + 1}. "${result.question}" (Score: ${result.score}/10)`);
    });
  }
}

// Run the test
testAllParkingQuestions().catch(console.error); 