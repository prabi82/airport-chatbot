const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixKFCSourceDirect() {
  try {
    console.log('🔧 Fixing KFC entries missing source URLs...\n');
    
    // Find ALL KFC entries without source URLs
    const kfcWithoutSources = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: 'KFC', mode: 'insensitive' } },
          { answer: { contains: 'KFC', mode: 'insensitive' } }
        ],
        sourceUrl: null
      }
    });
    
    console.log(`❌ Found ${kfcWithoutSources.length} KFC entries without source URLs:`);
    
    for (let i = 0; i < kfcWithoutSources.length; i++) {
      const entry = kfcWithoutSources[i];
      console.log(`\n${i + 1}. Question: ${entry.question}`);
      console.log(`   Answer: ${entry.answer.substring(0, 100)}...`);
      console.log(`   Category: ${entry.category}`);
      console.log(`   Current source: ${entry.sourceUrl}`);
      
      // Update it with the correct source URL
      const updated = await prisma.knowledgeBase.update({
        where: { id: entry.id },
        data: {
          sourceUrl: 'https://www.muscatairport.co.om/en/content/restaurants-quick-bites',
          category: 'Dining' // Also standardize the category
        }
      });
      
      console.log(`   ✅ Updated with source: ${updated.sourceUrl}`);
    }
    
    // Also fix any entries with "Uncategorized" category
    const uncategorizedKFC = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: 'KFC', mode: 'insensitive' } },
          { answer: { contains: 'KFC', mode: 'insensitive' } }
        ],
        category: 'Uncategorized'
      }
    });
    
    console.log(`\n🔧 Found ${uncategorizedKFC.length} uncategorized KFC entries to fix:`);
    
    for (const entry of uncategorizedKFC) {
      console.log(`Fixing: ${entry.question.substring(0, 50)}...`);
      await prisma.knowledgeBase.update({
        where: { id: entry.id },
        data: {
          category: 'Dining',
          sourceUrl: entry.sourceUrl || 'https://www.muscatairport.co.om/en/content/restaurants-quick-bites'
        }
      });
    }
    
    // Final verification
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
    
    console.log('\n📊 Final verification - All KFC entries:');
    allKfcEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.question.substring(0, 50)}...`);
      console.log(`   Source: ${entry.sourceUrl ? '✅ ' + entry.sourceUrl : '❌ NO SOURCE'}`);
      console.log(`   Category: ${entry.category}`);
      console.log('---');
    });
    
    const stillWithoutSources = allKfcEntries.filter(e => !e.sourceUrl);
    if (stillWithoutSources.length === 0) {
      console.log('\n🎉 SUCCESS: All KFC entries now have source URLs!');
    } else {
      console.log(`\n❌ Still ${stillWithoutSources.length} KFC entries without sources`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error fixing KFC sources:', error.message);
    await prisma.$disconnect();
  }
}

fixKFCSourceDirect(); 