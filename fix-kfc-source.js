const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixKFCSource() {
  try {
    console.log('🔧 Fixing KFC entry missing source URL...\n');
    
    // Find the KFC entry without source URL
    const kfcWithoutSource = await prisma.knowledgeBase.findFirst({
      where: {
        isActive: true,
        question: { contains: 'is KFC available?', mode: 'insensitive' },
        sourceUrl: null
      }
    });
    
    if (kfcWithoutSource) {
      console.log('❌ Found KFC entry without source URL:');
      console.log('Question:', kfcWithoutSource.question);
      console.log('Answer:', kfcWithoutSource.answer.substring(0, 100) + '...');
      console.log('Current source:', kfcWithoutSource.sourceUrl);
      
      // Update it with the correct source URL
      const updated = await prisma.knowledgeBase.update({
        where: { id: kfcWithoutSource.id },
        data: {
          sourceUrl: 'https://www.muscatairport.co.om/en/content/restaurants-quick-bites',
          category: 'Dining' // Also fix the category
        }
      });
      
      console.log('\n✅ Updated KFC entry:');
      console.log('Question:', updated.question);
      console.log('New source:', updated.sourceUrl);
      console.log('New category:', updated.category);
      
    } else {
      console.log('✅ No KFC entry found without source URL');
    }
    
    // Verify all KFC entries now have sources
    const allKfcEntries = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: 'KFC', mode: 'insensitive' } },
          { answer: { contains: 'KFC', mode: 'insensitive' } }
        ]
      },
      select: {
        question: true,
        sourceUrl: true,
        category: true
      }
    });
    
    console.log('\n📊 All KFC entries after fix:');
    allKfcEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.question.substring(0, 50)}...`);
      console.log(`   Source: ${entry.sourceUrl ? '✅ ' + entry.sourceUrl : '❌ NO SOURCE'}`);
      console.log(`   Category: ${entry.category}`);
      console.log('---');
    });
    
    const withoutSources = allKfcEntries.filter(e => !e.sourceUrl);
    if (withoutSources.length === 0) {
      console.log('\n🎉 SUCCESS: All KFC entries now have source URLs!');
    } else {
      console.log(`\n❌ Still ${withoutSources.length} KFC entries without sources`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error fixing KFC source:', error.message);
    await prisma.$disconnect();
  }
}

fixKFCSource(); 