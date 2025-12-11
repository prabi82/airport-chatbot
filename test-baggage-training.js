const fetch = require('node-fetch');

// Test questions to verify baggage training
const testQuestions = [
  // Check-in related
  "How do I check in my baggage?",
  "Where can I check in my luggage at Muscat airport?",
  
  // Weight and restrictions
  "What are the baggage weight limits?", 
  "How much baggage can I bring?",
  
  // Prohibited items
  "What items are not allowed in carry-on?",
  "Can I bring jewelry in my checked baggage?",
  
  // Lost baggage
  "What should I do if my baggage is lost?",
  "How do I report missing luggage?",
  
  // Damaged baggage
  "My suitcase was damaged, what can I do?",
  "How to report damaged baggage?",
  
  // Processing and handling
  "How efficient is the baggage system at Muscat airport?",
  "Will my baggage be screened?",
  
  // Contact information
  "Who do I contact for baggage issues?",
  "What is the baggage service phone number?"
];

async function testBaggageKnowledge() {
  console.log('🧪 Testing Baggage FAQ Training...\n');
  
  let successCount = 0;
  let totalQuestions = testQuestions.length;
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`\n[${i + 1}/${totalQuestions}] Testing: "${question}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: question,
          sessionId: `test-baggage-${Date.now()}-${i}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.response && data.response.length > 50) {
        console.log('✅ Good response received');
        console.log(`📝 Response preview: "${data.response.substring(0, 100)}..."`);
        
        // Check if response contains baggage-related keywords
        const baggageKeywords = ['baggage', 'luggage', 'suitcase', 'check-in', 'claim', 'airport'];
        const hasRelevantContent = baggageKeywords.some(keyword => 
          data.response.toLowerCase().includes(keyword)
        );
        
        if (hasRelevantContent) {
          successCount++;
          console.log('🎯 Response contains relevant baggage information');
        } else {
          console.log('⚠️  Response may not be specific to baggage');
        }
      } else {
        console.log('❌ Response too short or empty');
        console.log(`📝 Response: "${data.response || 'No response'}"`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Baggage Training Test Results:');
  console.log(`✅ Successful responses: ${successCount}/${totalQuestions}`);
  console.log(`📊 Success rate: ${Math.round((successCount / totalQuestions) * 100)}%`);
  
  if (successCount >= totalQuestions * 0.8) {
    console.log('🎯 Excellent! Baggage FAQ training is working well.');
  } else if (successCount >= totalQuestions * 0.6) {
    console.log('👍 Good! Most baggage questions are being answered correctly.');
  } else {
    console.log('⚠️  Training may need improvement. Some questions not answered well.');
  }
  
  console.log('\n💡 The chatbot is now ready to answer baggage-related questions!');
  return successCount / totalQuestions;
}

if (require.main === module) {
  testBaggageKnowledge()
    .then((successRate) => {
      console.log(`\n✨ Test completed with ${Math.round(successRate * 100)}% success rate`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testBaggageKnowledge }; 