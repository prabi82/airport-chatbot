const fetch = require('node-fetch');

const testQuestions = [
  // Questions that had formatting issues
  {
    question: "What dining options are available at Muscat International Airport?",
    issue: "Poor formatting in long responses",
    expectation: "Well-formatted comprehensive list with emojis and sections"
  },
  {
    question: "Where can I find Arabic or Middle Eastern food?",
    issue: "Poor formatting",
    expectation: "Properly formatted with Noor restaurant highlighted"
  },
  {
    question: "Is there a food court area at the airport?",
    issue: "Generic response",
    expectation: "Specific info about Food Hall concept"
  },
  
  // Questions that were too brief
  {
    question: "Is there a sports bar or place to watch games while dining?",
    issue: "Too brief (46 chars)",
    expectation: "Detailed info about Tickerdaze with features"
  },
  {
    question: "What Asian food options are available besides Indian?",
    issue: "Too brief (49 chars)",
    expectation: "Detailed info about Spice Kitchen's Asian options"
  },
  {
    question: "Can I find food options in both arrival and departure areas?",
    issue: "Too brief (81 chars)",
    expectation: "Comprehensive breakdown of both areas"
  },
  {
    question: "Are there any Indian food options at the airport?",
    issue: "Too brief (69 chars)",
    expectation: "Detailed info about Spice Kitchen"
  },
  
  // Questions with wrong information
  {
    question: "What Latin American food options are available?",
    issue: "Wrong info (mentioned Spice Kitchen instead of Luna)",
    expectation: "Should mention Luna restaurant specifically"
  },
  {
    question: "Where are most restaurants located in the airport?",
    issue: "Generic response",
    expectation: "Specific breakdown by level and area"
  },
  {
    question: "What Italian food options are available?",
    issue: "Wrong info (mentioned Spice Kitchen instead of Caffè Nero)",
    expectation: "Should mention Caffè Nero for Italian coffee experience"
  },
  {
    question: "What should I know about dining locations relative to airport gates?",
    issue: "Generic response",
    expectation: "Specific gate information (Gate A, Gate B)"
  }
];

async function testImprovedResponses() {
  console.log('🧪 Testing Improved Dining Responses...\n');
  console.log('Testing key questions that had issues:\n');
  
  let passCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 TEST ${i + 1}/11: ${test.issue}`);
    console.log(`❓ Question: "${test.question}"`);
    console.log(`🎯 Expected: ${test.expectation}`);
    console.log(`${'='.repeat(80)}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: test.question,
          sessionId: 'test-improved-' + i + '-' + Date.now()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const responseText = data.response || '';
        const length = responseText.length;
        
        console.log(`\n📝 RESPONSE (${length} chars):`);
        console.log(`${responseText}\n`);
        
        // Analyze response quality
        let qualityScore = 0;
        let feedback = [];
        
        // Check length (should be substantial for most questions)
        if (length > 200) {
          qualityScore += 2;
          feedback.push('✅ Good length');
        } else if (length > 100) {
          qualityScore += 1;
          feedback.push('⚠️ Moderate length');
        } else {
          feedback.push('❌ Too brief');
        }
        
        // Check formatting (emojis, bullets, sections)
        if (responseText.includes('**') && (responseText.includes('•') || responseText.includes('📍'))) {
          qualityScore += 2;
          feedback.push('✅ Well formatted');
        } else if (responseText.includes('**') || responseText.includes('•')) {
          qualityScore += 1;
          feedback.push('⚠️ Basic formatting');
        } else {
          feedback.push('❌ Poor formatting');
        }
        
        // Check specific content based on question
        let contentCorrect = true;
        if (test.question.includes('Latin American') && !responseText.toLowerCase().includes('luna')) {
          feedback.push('❌ Missing Luna restaurant');
          contentCorrect = false;
        }
        if (test.question.includes('Italian food') && !responseText.toLowerCase().includes('caffè nero')) {
          feedback.push('❌ Missing Caffè Nero');
          contentCorrect = false;
        }
        if (test.question.includes('sports bar') && !responseText.toLowerCase().includes('tickerdaze')) {
          feedback.push('❌ Missing Tickerdaze');
          contentCorrect = false;
        }
        if (test.question.includes('Asian food') && !responseText.toLowerCase().includes('spice kitchen')) {
          feedback.push('❌ Missing Spice Kitchen');
          contentCorrect = false;
        }
        if (test.question.includes('food court') && !responseText.toLowerCase().includes('food hall')) {
          feedback.push('❌ Missing Food Hall concept');
          contentCorrect = false;
        }
        
        if (contentCorrect) {
          qualityScore += 3;
          feedback.push('✅ Correct content');
        }
        
        // Check for emojis and modern formatting
        if (responseText.includes('🍽️') || responseText.includes('☕') || responseText.includes('📍')) {
          qualityScore += 1;
          feedback.push('✅ Has emojis');
        }
        
        console.log(`📊 QUALITY ANALYSIS:`);
        console.log(`Score: ${qualityScore}/8`);
        console.log(`Feedback: ${feedback.join(', ')}`);
        
        if (qualityScore >= 6) {
          console.log(`🎉 TEST PASSED - High quality response`);
          passCount++;
        } else if (qualityScore >= 4) {
          console.log(`⚠️ TEST PARTIAL - Needs improvement`);
          failCount++;
        } else {
          console.log(`❌ TEST FAILED - Poor quality response`);
          failCount++;
        }
        
      } else {
        console.log(`❌ API request failed: ${response.status}`);
        failCount++;
      }
      
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failCount++;
    }
    
    // Wait between requests
    if (i < testQuestions.length - 1) {
      console.log(`\n⏳ Waiting 2 seconds before next test...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏁 FINAL RESULTS:`);
  console.log(`✅ Passed: ${passCount}/${testQuestions.length}`);
  console.log(`❌ Failed: ${failCount}/${testQuestions.length}`);
  console.log(`📈 Success Rate: ${Math.round((passCount / testQuestions.length) * 100)}%`);
  console.log(`${'='.repeat(80)}`);
  
  if (passCount >= testQuestions.length * 0.8) {
    console.log(`🎉 OVERALL: EXCELLENT - Most issues have been resolved!`);
  } else if (passCount >= testQuestions.length * 0.6) {
    console.log(`👍 OVERALL: GOOD - Significant improvement made`);
  } else {
    console.log(`⚠️ OVERALL: NEEDS WORK - Some issues remain`);
  }
}

testImprovedResponses().catch(console.error); 