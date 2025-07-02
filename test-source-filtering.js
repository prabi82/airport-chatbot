const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSourceFiltering() {
  try {
    console.log('🧪 Testing source filtering logic...\n');
    
    // Simulate the knowledge base search for KFC query
    const entries = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sourceUrl: true
      }
    });

    // Extract meaningful keywords for KFC query
    const query = "is there KFC located at muscat airport?";
    const stopWords = ['what', 'is', 'are', 'the', 'at', 'in', 'on', 'and', 'or', 'for', 'with', 'by', 'to', 'from', 'of', 'a', 'an', 'airport', 'airports', 'muscat', 'oman'];
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);

    console.log('🔍 Query keywords:', keywords);

    // Calculate relevance scores (simplified version of the actual algorithm)
    const scoredEntries = entries.map(entry => {
      const questionText = entry.question.toLowerCase();
      const answerText = entry.answer.toLowerCase();
      const categoryText = entry.category.toLowerCase();
      
      let score = 0;
      keywords.forEach(keyword => {
        const questionMatches = (questionText.match(new RegExp(keyword, 'g')) || []).length;
        score += questionMatches * 5;
        
        const answerMatches = (answerText.match(new RegExp(keyword, 'g')) || []).length;
        score += answerMatches * 3;
        
        const categoryMatches = (categoryText.match(new RegExp(keyword, 'g')) || []).length;
        score += categoryMatches * 4;
      });
      
      return {
        ...entry,
        relevanceScore: score
      };
    }).filter(entry => entry.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8); // Top 8 entries

    console.log('\n📊 Top matching entries:');
    scoredEntries.forEach((entry, index) => {
      console.log(`${index + 1}. Score: ${entry.relevanceScore} | Category: ${entry.category}`);
      console.log(`   Question: ${entry.question.substring(0, 60)}...`);
      console.log(`   Source: ${entry.sourceUrl || 'NO SOURCE'}`);
      console.log('---');
    });

    // Apply the NEW source filtering logic
    const sources = [];
    if (scoredEntries.length > 0) {
      const topEntry = scoredEntries[0];
      
      scoredEntries.forEach((entry, index) => {
        const shouldIncludeSource = entry.sourceUrl && (
          index === 0 || // Always include top entry source
          entry.relevanceScore > 20 || // High relevance entries
          (entry.category === topEntry.category && entry.relevanceScore > 10) // Same category, decent relevance
        );
        
        if (shouldIncludeSource) {
          sources.push(entry.sourceUrl);
        }
      });
    }

    // Remove duplicates
    const uniqueSources = [...new Set(sources)];

    console.log('\n🎯 Filtered Sources (NEW logic):');
    console.log(`Total sources before filtering: ${scoredEntries.filter(e => e.sourceUrl).length}`);
    console.log(`Total sources after filtering: ${uniqueSources.length}`);
    uniqueSources.forEach((source, index) => {
      console.log(`${index + 1}. ${source}`);
    });

    // Compare with OLD logic (all sources)
    const oldSources = [...new Set(scoredEntries.filter(e => e.sourceUrl).map(e => e.sourceUrl))];
    console.log('\n📋 Comparison:');
    console.log(`OLD logic would show: ${oldSources.length} sources`);
    console.log(`NEW logic shows: ${uniqueSources.length} sources`);
    console.log(`Improvement: ${oldSources.length - uniqueSources.length} fewer irrelevant sources`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error testing source filtering:', error.message);
    await prisma.$disconnect();
  }
}

testSourceFiltering(); 