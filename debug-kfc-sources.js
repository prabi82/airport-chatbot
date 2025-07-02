const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugKFCQuery() {
  console.log('🔍 Debugging KFC query source filtering...\n');
  
  try {
    // Get all knowledge entries
    const entries = await prisma.knowledgeBase.findMany({
      where: { isActive: true },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sourceUrl: true
      }
    });

    // Simulate the search logic for "where is KFC located?"
    const query = "where is KFC located?";
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !['what', 'is', 'are', 'the', 'at', 'in', 'on', 'and', 'or', 'for', 'with', 'by', 'to', 'from', 'of', 'a', 'an', 'airport', 'airports', 'muscat', 'oman'].includes(word))
      .slice(0, 10);
    
    console.log('🔍 Query:', query);
    console.log('🏷️ Keywords:', keywords);
    console.log();

    // Calculate relevance scores
    const scoredEntries = entries.map(entry => {
      const questionText = entry.question.toLowerCase();
      const answerText = entry.answer.toLowerCase();
      const categoryText = entry.category.toLowerCase();
      
      let score = 0;
      keywords.forEach(keyword => {
        // Score for question matches (highest priority)
        const questionMatches = (questionText.match(new RegExp(keyword, 'g')) || []).length;
        score += questionMatches * 5;
        
        // Score for answer matches (medium priority)
        const answerMatches = (answerText.match(new RegExp(keyword, 'g')) || []).length;
        score += answerMatches * 3;
        
        // Score for category matches (boost for relevant categories)
        const categoryMatches = (categoryText.match(new RegExp(keyword, 'g')) || []).length;
        score += categoryMatches * 4;
        
        // Special boost for dining-related keywords
        const diningKeywords = ['food', 'restaurant', 'dining', 'coffee', 'cafe', 'kitchen', 'eat', 'drink', 'meal', 'indian', 'spice', 'options', 'healthy'];
        if (diningKeywords.includes(keyword) && categoryText.includes('dining')) {
          score += 15;
        }
      });
      
      return { ...entry, relevanceScore: score };
    })
    .filter(entry => entry.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

    console.log('📊 Top matching entries:');
    scoredEntries.forEach((entry, index) => {
      console.log(`${index + 1}. Score: ${entry.relevanceScore} | Category: ${entry.category}`);
      console.log(`   Question: ${entry.question.substring(0, 80)}...`);
      console.log(`   Source: ${entry.sourceUrl || 'No source'}`);
      console.log('---');
    });

    console.log('\n🧮 Simulating source filtering logic:');
    
    const messageLower = query.toLowerCase();
    const isDiningQuery = messageLower.includes('kfc') || messageLower.includes('restaurant') || 
                         messageLower.includes('food') || messageLower.includes('dining') ||
                         messageLower.includes('coffee') || messageLower.includes('eat');
    
    console.log('🍽️ Is dining query:', isDiningQuery);
    
    const sources = [];
    const topEntry = scoredEntries[0];
    
    scoredEntries.forEach((entry, index) => {
      console.log(`\nEntry ${index + 1}:`);
      console.log(`  Score: ${entry.relevanceScore}`);
      console.log(`  Category: ${entry.category}`);
      console.log(`  Source: ${entry.sourceUrl || 'No source'}`);
      
      let shouldIncludeSource = false;
      
      if (entry.sourceUrl) {
        if (index === 0 && entry.relevanceScore > 15) {
          console.log(`  ✅ Include: Top entry with score > 15`);
          shouldIncludeSource = true;
        } else if (entry.relevanceScore > 25) {
          console.log(`  ✅ Include: High relevance (> 25)`);
          shouldIncludeSource = true;
        } else if (isDiningQuery && entry.category.toLowerCase().includes('dining') && entry.relevanceScore > 15) {
          console.log(`  ✅ Include: Dining query + dining category + score > 15`);
          shouldIncludeSource = true;
        } else if (!isDiningQuery && entry.category === topEntry.category && entry.relevanceScore > 20) {
          console.log(`  ✅ Include: Non-dining query + same category + score > 20`);
          shouldIncludeSource = true;
        } else {
          console.log(`  ❌ Exclude: Doesn't meet criteria`);
        }
        
                 // Additional exclusion logic for obviously irrelevant sources
         if (shouldIncludeSource && isDiningQuery) {
           const isTransportOrLounge = entry.category.toLowerCase().includes('transportation') || 
                                     entry.category.toLowerCase().includes('lounge') ||
                                     entry.sourceUrl.includes('primeclass-lounge') ||
                                     entry.sourceUrl.includes('to-from');
           console.log(`  🔍 Checking exclusion: isTransportOrLounge=${isTransportOrLounge}`);
           if (isTransportOrLounge) {
             console.log(`  🚫 Override exclude: ALL transport/lounge sources for dining query`);
             shouldIncludeSource = false;
           }
         }
      } else {
        console.log(`  ❌ Exclude: No source URL`);
      }
      
      if (shouldIncludeSource && entry.sourceUrl) {
        sources.push(entry.sourceUrl);
      }
    });

    console.log('\n📚 Final sources:', sources.length);
    const uniqueSources = [...new Set(sources)];
    uniqueSources.forEach((source, index) => {
      console.log(`${index + 1}. ${source}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugKFCQuery(); 