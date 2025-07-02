const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSourceData() {
  try {
    console.log('🔍 Checking source URL data for KFC/restaurant entries...\n');
    
    // Check KFC specific entries
    const kfcEntries = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: 'KFC', mode: 'insensitive' } },
          { answer: { contains: 'KFC', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        question: true,
        answer: true,
        sourceUrl: true,
        category: true
      }
    });
    
    console.log(`📊 KFC entries found: ${kfcEntries.length}`);
    kfcEntries.forEach((entry, index) => {
      console.log(`${index + 1}. Question: ${entry.question.substring(0, 60)}...`);
      console.log(`   Answer: ${entry.answer.substring(0, 60)}...`);
      console.log(`   Source: ${entry.sourceUrl || '❌ NO SOURCE URL'}`);
      console.log(`   Category: ${entry.category}`);
      console.log('---');
    });
    
    // Check restaurant entries with source URLs
    const restaurantEntries = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        category: { contains: 'dining', mode: 'insensitive' },
        sourceUrl: { not: null }
      },
      select: {
        id: true,
        question: true,
        sourceUrl: true,
        category: true
      },
      take: 5
    });
    
    console.log(`\n📊 Restaurant entries with sources: ${restaurantEntries.length}`);
    restaurantEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.question.substring(0, 60)}...`);
      console.log(`   Source: ${entry.sourceUrl}`);
      console.log('---');
    });
    
    // Summary
    const totalWithSources = await prisma.knowledgeBase.count({
      where: {
        isActive: true,
        sourceUrl: { not: null }
      }
    });
    
    const totalActive = await prisma.knowledgeBase.count({
      where: { isActive: true }
    });
    
    console.log(`\n📋 Summary:`);
    console.log(`- Total active entries: ${totalActive}`);
    console.log(`- Entries with source URLs: ${totalWithSources}`);
    console.log(`- KFC entries: ${kfcEntries.length}`);
    console.log(`- KFC entries with sources: ${kfcEntries.filter(e => e.sourceUrl).length}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error checking source data:', error.message);
    await prisma.$disconnect();
  }
}

checkSourceData(); 