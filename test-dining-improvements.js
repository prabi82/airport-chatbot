const fetch = require('node-fetch');

const testQuestions = [
  {
    question: "What dining options are available at Muscat International Airport?",
    issue: "Poor formatting in long responses",
    expectation: "Well-formatted comprehensive list"
  },
  {
    question: "Is there a sports bar or place to watch games while dining?",
    issue: "Too brief (46 chars)",
    expectation: "Detailed info about Tickerdaze"
  },
  {
    question: "What Latin American food options are available?",
    issue: "Wrong info (mentioned Spice Kitchen instead of Luna)",
    expectation: "Should mention Luna restaurant"
  },
  {
    question: "What Italian food options are available?",
    issue: "Wrong info",
    expectation: "Should mention Caffè Nero"
  },
  {
    question: "What Asian food options are available besides Indian?",
    issue: "Too brief",
    expectation: "Detailed Spice Kitchen info"
  }
];

async function testImprovements() {
  console.log('🧪 Testing Dining Response Improvements...\n');
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n📋 TEST ${i + 1}: ${test.issue}`);
    console.log(`❓ ${test.question}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: test.question,
          sessionId: 'test-' + i + '-' + Date.now()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const responseText = data.response || '';
        
        console.log(`\n📝 RESPONSE (${responseText.length} chars):`);
        console.log(responseText);
        
        // Quick quality check
        let quality = [];
        if (responseText.length > 200) quality.push('✅ Good length');
        if (responseText.includes('**') && responseText.includes('•')) quality.push('✅ Well formatted');
        if (responseText.includes('🍽️') || responseText.includes('📍')) quality.push('✅ Has emojis');
        
        console.log(`\n📊 Quality: ${quality.join(', ')}`);
        
      } else {
        console.log(`❌ Failed: ${response.status}`);
      }
      
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
    
    if (i < testQuestions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

testImprovements(); 