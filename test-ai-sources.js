const { aiService } = require('./src/lib/ai-service.ts');

async function testAISourcesForKFC() {
  try {
    console.log('🧠 Testing AI service for KFC query...\n');
    
    // Test the exact question that's not working
    const queries = [
      'is KFC available?',
      'is there a KFC at the airport?',
      'does the airport have KFC?'
    ];
    
    for (const query of queries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      console.log('---'.repeat(20));
      
      const result = await aiService.generateResponse(query, '', 'test-session');
      
      console.log('✅ Response received:');
      console.log('- Success:', result.success);
      console.log('- Provider:', result.provider);
      console.log('- Knowledge base used:', result.knowledgeBaseUsed);
      console.log('- Sources count:', result.sources ? result.sources.length : 0);
      console.log('- Sources:', result.sources);
      console.log('- KB Entry ID:', result.kbEntryId);
      console.log('- Response preview:', result.message.substring(0, 100) + '...');
      
      if (!result.sources || result.sources.length === 0) {
        console.log('❌ NO SOURCES returned for this query!');
      } else {
        console.log('🎉 Sources found:');
        result.sources.forEach((source, index) => {
          console.log(`  ${index + 1}. ${source}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing AI sources:', error.message);
  }
}

testAISourcesForKFC(); 