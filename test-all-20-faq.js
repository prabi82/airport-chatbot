const fetch = require('node-fetch');

const allDiningFAQs = [
  "What dining options are available at Muscat International Airport?",
  "Are there any Indian food options at the airport?",
  "Where can I find coffee shops at Muscat airport?",
  "Is KFC available at Muscat airport?",
  "What fast food chains can I find at the airport?",
  "Are there healthy dining options available?",
  "Where can I find Arabic or Middle Eastern food?",
  "Are there any bakeries or dessert shops at the airport?",
  "Is there a sports bar or place to watch games while dining?",
  "What Latin American food options are available?",
  "Can I pre-order food at the airport?",
  "Where are most restaurants located in the airport?",
  "Are there grab-and-go options for quick meals?",
  "What Italian food options are available?",
  "Is there a food court area at the airport?",
  "What beverages can I find besides coffee?",
  "Are there any specialty or unique dining concepts?",
  "What Asian food options are available besides Indian?",
  "Can I find food options in both arrival and departure areas?",
  "What should I know about dining locations relative to airport gates?"
];

async function testAllDiningFAQs() {
  console.log('🍽️ Complete Dining FAQ Test - All 20 Questions\n');
  
  let passedTests = 0;
  let totalTests = allDiningFAQs.length;
  let results = [];
  
  for (let i = 0; i < allDiningFAQs.length; i++) {
    const question = allDiningFAQs[i];
    console.log(`\n📝 Question ${i + 1}/20: ${question}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          sessionId: 'test-all-' + i + '-' + Date.now()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Quick evaluation
        let score = 0;
        let status = '❌ FAIL';
        
        if (data.response && data.response.length > 30) score += 1;
        if (data.sources && data.sources.some(s => s.includes('restaurants-quick-bites'))) score += 1;
        
        // Question-specific checks
        const responseLower = data.response ? data.response.toLowerCase() : '';
        
        if (question.includes('Indian') && responseLower.includes('spice kitchen')) score += 1;
        if (question.includes('KFC') && responseLower.includes('kfc')) score += 1;
        if (question.includes('coffee') && (responseLower.includes('caffè nero') || responseLower.includes('tim hortons'))) score += 1;
        if (question.includes('fast food') && responseLower.includes('kfc') && responseLower.includes('mcdonald')) score += 1;
        if (question.includes('healthy') && responseLower.includes('plenty')) score += 1;
        if (question.includes('Arabic') && responseLower.includes('noor')) score += 1;
        if (question.includes('bakery') && responseLower.includes('cakes')) score += 1;
        if (question.includes('sports bar') && responseLower.includes('tickerdaze')) score += 1;
        if (question.includes('Latin') && responseLower.includes('luna')) score += 1;
        if (question.includes('pre-order') && responseLower.includes('pre-order')) score += 1;
        if (question.includes('Italian') && responseLower.includes('caffè nero')) score += 1;
        if (question.includes('food court') && responseLower.includes('food hall')) score += 1;
        
        if (score >= 2) {
          status = '✅ PASS';
          passedTests++;
        }
        
        results.push({
          question: question,
          score: score,
          status: status,
          responseLength: data.response ? data.response.length : 0,
          sources: data.sources ? data.sources.length : 0,
          provider: data.provider || 'unknown'
        });
        
        console.log(`   ${status} (Score: ${score}, Length: ${data.response ? data.response.length : 0}, Sources: ${data.sources ? data.sources.length : 0})`);
        
      } else {
        console.log('   ❌ API FAIL');
        results.push({
          question: question,
          score: 0,
          status: '❌ API FAIL',
          responseLength: 0,
          sources: 0,
          provider: 'none'
        });
      }
      
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
      results.push({
        question: question,
        score: 0,
        status: '❌ ERROR',
        responseLength: 0,
        sources: 0,
        provider: 'none'
      });
    }
    
    // Small delay to avoid overwhelming the server
    if (i < allDiningFAQs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Final comprehensive report
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 COMPLETE DINING FAQ TEST RESULTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total Questions: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${totalTests - passedTests} (${(((totalTests-passedTests)/totalTests)*100).toFixed(1)}%)`);
  
  console.log(`\n📋 DETAILED BREAKDOWN:`);
  results.forEach((result, i) => {
    if (result.status.includes('FAIL') || result.status.includes('ERROR')) {
      console.log(`${i+1}. ${result.status} - ${result.question.substring(0,50)}...`);
    }
  });
  
  const avgResponseLength = results.reduce((sum, r) => sum + r.responseLength, 0) / results.length;
  const sourceCoverage = results.filter(r => r.sources > 0).length;
  
  console.log(`\n📈 STATISTICS:`);
  console.log(`Average Response Length: ${avgResponseLength.toFixed(0)} characters`);
  console.log(`Source Coverage: ${sourceCoverage}/${totalTests} (${((sourceCoverage/totalTests)*100).toFixed(1)}%)`);
  
  if (passedTests >= totalTests * 0.8) {
    console.log(`\n🎉 EXCELLENT! Dining responses are well optimized (${((passedTests/totalTests)*100).toFixed(1)}% pass rate)`);
  } else if (passedTests >= totalTests * 0.6) {
    console.log(`\n✅ GOOD! Most dining responses are optimized (${((passedTests/totalTests)*100).toFixed(1)}% pass rate)`);
  } else {
    console.log(`\n⚠️ NEEDS WORK! Several dining responses need optimization (${((passedTests/totalTests)*100).toFixed(1)}% pass rate)`);
  }
}

testAllDiningFAQs(); 