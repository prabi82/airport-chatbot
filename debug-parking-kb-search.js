const { PrismaClient } = require('@prisma/client');

async function debugParkingKBSearch() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Debugging parking knowledge base search...\n');
  
  try {
    // Check what parking entries exist
    const parkingEntries = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { category: 'parking' },
          { question: { contains: 'parking', mode: 'insensitive' } },
          { answer: { contains: 'parking', mode: 'insensitive' } }
        ],
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Found ${parkingEntries.length} parking-related entries:`);
    
    parkingEntries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ID: ${entry.id}`);
      console.log(`   Category: ${entry.category}`);
      console.log(`   Priority: ${entry.priority}`);
      console.log(`   Question: ${entry.question}`);
      console.log(`   Answer (first 100 chars): ${entry.answer.substring(0, 100)}...`);
      console.log(`   Source: ${entry.sourceUrl}`);
      console.log(`   Created: ${entry.createdAt}`);
    });
    
    // Test search manually with keywords
    console.log('\n🔍 Testing search with parking keywords...');
    const keywords = ['parking', 'hourly', 'daily', 'rate', 'cost'];
    
    for (const keyword of keywords) {
      const results = await prisma.knowledgeBase.findMany({
        where: {
          OR: [
            { question: { contains: keyword, mode: 'insensitive' } },
            { answer: { contains: keyword, mode: 'insensitive' } }
          ],
          isActive: true
        },
        take: 3
      });
      
      console.log(`\n🔎 Keyword "${keyword}": ${results.length} matches`);
      results.forEach(result => {
        console.log(`   - ${result.question.substring(0, 60)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugParkingKBSearch();


