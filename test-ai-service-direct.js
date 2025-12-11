const { AIService } = require('./src/lib/ai-service');

async function testAIServiceDirect() {
  console.log('🔍 Testing AI Service knowledge base search directly...\n');
  
  const aiService = AIService.getInstance();
  
  const testQueries = [
    "How much is the parking rate for 1 hour?",
    "What is the hourly parking cost?",
    "parking rate 1 hour",
    "OMR 0.200 parking"
  ];
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`📝 Testing: "${query}"`);
    
    try {
      // Test the knowledge base search directly
      const knowledgeEntries = await aiService.searchKnowledgeBase(query);
      
      console.log(`📊 Found ${knowledgeEntries.length} knowledge entries`);
      
      if (knowledgeEntries.length > 0) {
        console.log('🔝 Top 3 results:');
        knowledgeEntries.slice(0, 3).forEach((entry, index) => {
          console.log(`   ${index + 1}. Score: ${entry.relevanceScore || 'N/A'}`);
          console.log(`      Q: ${entry.question.substring(0, 60)}...`);
          console.log(`      A: ${entry.answer.substring(0, 80)}...`);
        });
      } else {
        console.log('❌ No knowledge entries found');
      }
      
      console.log(''); // Empty line
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error.message);
    }
  }
}

testAIServiceDirect();


