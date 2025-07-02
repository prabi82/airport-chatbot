const fetch = require('node-fetch');
const fs = require('fs');

const loungeQuestions = [
  // Primeclass Lounge General Information
  "Where is the Primeclass Lounge located at Muscat International Airport?",
  "What facilities are available in the Primeclass Lounge?",
  "How much does it cost to access the Primeclass Lounge?",
  "How long can I stay in the Primeclass Lounge?",
  "Who is eligible to use the Primeclass Lounge?",
  "What cards are accepted for lounge access?",
  "Can I pay for lounge access if I don't have a qualifying card or ticket?",
  "Is there an age limit or special pricing for children?",
  "What food and beverage options are available in the lounge?",
  "Does the Primeclass Lounge have shower facilities?",
  
  // Primeclass Services
  "What is Primeclass Meet & Assist service?",
  "How much does the Primeclass departure service cost?",
  "What's included in the Primeclass arrival service?",
  "What is the transit service and how much does it cost?",
  "What is the fast-track service and what does it include?",
  "How do I book Primeclass services?",
  "What is Primeclass Porter Service?",
  "How much does porter service cost?",
  "Where can I find porters at the airport?",
  "What is Primeclass Car Wash Service?",
  
  // Parking & Transportation
  "What parking options are available at Muscat International Airport?",
  "How do I pay for parking at the airport?",
  "Are there dedicated pick-up and drop-off areas?",
  "How long can I stay in the pick-up/drop-off area?",
  "What happens if I exceed the 10-minute limit in pick-up/drop-off areas?",
  
  // Contact Information
  "How can I contact Primeclass services?",
  "What's the main airport support number?",
  "How can I get more information about services?",
  
  // Special Services & Amenities
  "Are there family-friendly facilities in the Primeclass Lounge?",
  "Does the lounge have business facilities?",
  "Are there quiet areas for relaxation in the lounge?",
  "What entertainment options are available in the lounge?",
  "Are there prayer facilities in the lounge?",
  "Does the lounge accommodate passengers with special needs?",
  "Can I store my baggage in the lounge?"
];

async function generateLoungeResponsesReport() {
  console.log('🏢 Generating Lounge FAQ Responses Report...\n');
  console.log(`Testing all ${loungeQuestions.length} lounge-related questions...\n`);
  
  let report = `# LOUNGE FAQ RESPONSES REPORT\n`;
  report += `Generated: ${new Date().toLocaleString()}\n\n`;
  report += `This report contains the actual chatbot responses for all ${loungeQuestions.length} lounge-related questions from the Primeclass Lounge FAQ.\n\n`;
  report += `---\n\n`;
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < loungeQuestions.length; i++) {
    const question = loungeQuestions[i];
    console.log(`Testing question ${i + 1}/${loungeQuestions.length}: ${question.substring(0, 50)}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          sessionId: 'lounge-test-' + i + '-' + Date.now()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        report += `## Question ${i + 1}\n\n`;
        report += `**Q:** ${question}\n\n`;
        report += `**A:** ${data.response || 'No response received'}\n\n`;
        report += `**Details:**\n`;
        report += `- Provider: ${data.provider || 'unknown'}\n`;
        report += `- Length: ${data.response ? data.response.length : 0} chars\n`;
        report += `- Sources: ${data.sources ? data.sources.length : 0}\n`;
        if (data.sources && data.sources.length > 0) {
          report += `- Source URLs: ${data.sources.join(', ')}\n`;
        }
        report += `\n---\n\n`;
        
        console.log(`✅ Question ${i + 1} completed (${data.response ? data.response.length : 0} chars)`);
        successCount++;
        
      } else {
        report += `## Question ${i + 1}\n\n`;
        report += `**Q:** ${question}\n\n`;
        report += `**A:** ERROR - API request failed with status ${response.status}\n\n`;
        report += `**Details:**\n`;
        report += `- Provider: unknown\n`;
        report += `- Length: 0 chars\n`;
        report += `- Sources: 0\n`;
        report += `\n---\n\n`;
        
        console.log(`❌ Question ${i + 1} failed - API error ${response.status}`);
        failCount++;
      }
      
    } catch (err) {
      report += `## Question ${i + 1}\n\n`;
      report += `**Q:** ${question}\n\n`;
      report += `**A:** ERROR - ${err.message}\n\n`;
      report += `**Details:**\n`;
      report += `- Provider: unknown\n`;
      report += `- Length: 0 chars\n`;
      report += `- Sources: 0\n`;
      report += `\n---\n\n`;
      
      console.log(`❌ Question ${i + 1} error: ${err.message}`);
      failCount++;
    }
    
    // Wait between requests to avoid overwhelming the server
    if (i < loungeQuestions.length - 1) {
      console.log(`⏳ Waiting 2 seconds before next question...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Add summary section
  report += `## SUMMARY REPORT\n\n`;
  report += `**Test Results:**\n`;
  report += `- Total Questions Tested: ${loungeQuestions.length}\n`;
  report += `- Successful Responses: ${successCount}\n`;
  report += `- Failed Responses: ${failCount}\n`;
  report += `- Success Rate: ${Math.round((successCount / loungeQuestions.length) * 100)}%\n\n`;
  
  report += `**Categories Tested:**\n`;
  report += `- 🏢 Primeclass Lounge General Information: Questions 1-10\n`;
  report += `- 👨‍💼 Primeclass Services: Questions 11-20\n`;
  report += `- 🚗 Parking & Transportation: Questions 21-25\n`;
  report += `- 📞 Contact Information: Questions 26-28\n`;
  report += `- 🎯 Special Services & Amenities: Questions 29-35\n\n`;
  
  if (successCount === loungeQuestions.length) {
    report += `🎉 **EXCELLENT!** All lounge questions received responses.\n\n`;
  } else if (successCount >= loungeQuestions.length * 0.8) {
    report += `👍 **GOOD** - Most questions received responses, some gaps to address.\n\n`;
  } else {
    report += `⚠️ **NEEDS IMPROVEMENT** - Many questions need better responses or knowledge base updates.\n\n`;
  }
  
  report += `*This report was generated to analyze how well the chatbot handles lounge-related inquiries. Use this data to identify gaps in knowledge base coverage and response quality.*\n`;
  
  // Save report
  const filename = `LOUNGE_FAQ_RESPONSES_REPORT_${new Date().toISOString().slice(0,10)}.md`;
  fs.writeFileSync(filename, report);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Report saved as: ${filename}`);
  console.log(`📊 Final Results: ${successCount}/${loungeQuestions.length} questions successful (${Math.round((successCount / loungeQuestions.length) * 100)}%)`);
  console.log(`🎉 Lounge FAQ testing complete!`);
  console.log(`${'='.repeat(80)}`);
}

generateLoungeResponsesReport().catch(console.error); 
