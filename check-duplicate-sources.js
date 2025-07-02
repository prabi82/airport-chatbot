const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicateSources() {
  console.log('🔍 Checking for duplicate source URLs in knowledge base...\n');
  
  try {
    // Get all active entries with source URLs
    const entries = await prisma.knowledgeBase.findMany({
      where: { 
        isActive: true,
        sourceUrl: { not: null }
      },
      select: {
        id: true,
        question: true,
        category: true,
        sourceUrl: true
      }
    });

    // Group by source URL
    const sourceGroups = {};
    entries.forEach(entry => {
      const url = entry.sourceUrl;
      if (!sourceGroups[url]) {
        sourceGroups[url] = [];
      }
      sourceGroups[url].push(entry);
    });

    console.log('📊 Source URL distribution:');
    Object.keys(sourceGroups).forEach(url => {
      const count = sourceGroups[url].length;
      console.log(`\n🔗 ${url}`);
      console.log(`   Entries: ${count}`);
      
      if (count > 5) {
        console.log('   📋 Sample entries:');
        sourceGroups[url].slice(0, 3).forEach(entry => {
          console.log(`     - ${entry.question.substring(0, 60)}... (${entry.category})`);
        });
        if (count > 3) {
          console.log(`     ... and ${count - 3} more`);
        }
      } else {
        console.log('   📋 All entries:');
        sourceGroups[url].forEach(entry => {
          console.log(`     - ${entry.question.substring(0, 60)}... (${entry.category})`);
        });
      }
    });

    // Check specifically for KFC-related entries
    console.log('\n\n🍗 KFC-related entries:');
    const kfcEntries = entries.filter(entry => 
      entry.question.toLowerCase().includes('kfc') || 
      entry.question.toLowerCase().includes('fried chicken')
    );
    
    kfcEntries.forEach(entry => {
      console.log(`- ${entry.question} (${entry.category})`);
      console.log(`  Source: ${entry.sourceUrl}`);
    });

    // Check Primeclass Lounge entries that might be matching KFC queries
    console.log('\n\n🛋️ Primeclass Lounge entries that mention "where" or "located":');
    const loungeEntries = entries.filter(entry => 
      entry.sourceUrl.includes('primeclass-lounge') &&
      (entry.question.toLowerCase().includes('where') || entry.question.toLowerCase().includes('located'))
    );
    
    loungeEntries.forEach(entry => {
      console.log(`- ${entry.question} (${entry.category})`);
      console.log(`  Source: ${entry.sourceUrl}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateSources(); 