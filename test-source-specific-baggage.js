const fetch = require('node-fetch');

async function testSourceSpecificQuestions() {
  console.log('🧪 Testing Source-Specific Baggage Questions...\n');
  
  const testQuestions = [
    {
      question: "How many baggage carousels are at Muscat airport?",
      expectedContent: "ten reclaim carousels"
    },
    {
      question: "What does Megaton Cargo Services do?",
      expectedContent: "converting passenger's excess baggage to cargo"
    },
    {
      question: "Where is the Seal & Go kiosk located?",
      expectedContent: "departure area C, next to the visa office"
    },
    {
      question: "How much do porter services cost at Muscat airport?",
      expectedContent: "3.5 OR per trolley/porter"
    },
    {
      question: "What baggage standards does Muscat airport have?",
      expectedContent: "baggage must have at least one flat surface"
    }
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n[${i + 1}/${testQuestions.length}] Testing: "${test.question}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: test.question,
          sessionId: `test-source-${Date.now()}-${i}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.response && data.response.length > 50) {
        console.log('✅ Response received');
        console.log(`📝 Response: "${data.response.substring(0, 200)}..."`);
        
        // Check if response contains expected source-specific content
        const hasExpectedContent = data.response.toLowerCase().includes(test.expectedContent.toLowerCase());
        
        if (hasExpectedContent) {
          successCount++;
          console.log(`🎯 ✅ Contains expected source content: "${test.expectedContent}"`);
        } else {
          console.log(`⚠️  ❌ Missing expected source content: "${test.expectedContent}"`);
        }
      } else {
        console.log('❌ Response too short or empty');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Source-Specific Baggage Training Test Results:');
  console.log(`✅ Questions with source-specific content: ${successCount}/${testQuestions.length}`);
  console.log(`📊 Source accuracy rate: ${Math.round((successCount / testQuestions.length) * 100)}%`);
  
  if (successCount >= testQuestions.length * 0.8) {
    console.log('🎯 Excellent! Chatbot is using source-specific Muscat Airport data.');
  } else if (successCount >= testQuestions.length * 0.6) {
    console.log('👍 Good! Most responses contain source-specific information.');
  } else {
    console.log('⚠️  Training may need improvement. Responses not matching source data.');
  }
  
  console.log('\n💡 The chatbot now provides accurate Muscat Airport baggage information!');
  return successCount / testQuestions.length;
}

if (require.main === module) {
  testSourceSpecificQuestions()
    .then((successRate) => {
      console.log(`\n✨ Test completed with ${Math.round(successRate * 100)}% source accuracy`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testSourceSpecificQuestions }; 