// Simple test to verify parking rates without server dependency
const { PrismaClient } = require('@prisma/client');

async function testParkingRatesInKB() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Testing parking rates in knowledge base...');
  
  try {
    // Look for specific parking rate entries
    const rateEntries = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { answer: { contains: 'OMR 0.200', mode: 'insensitive' } },
          { answer: { contains: 'OMR 2.000', mode: 'insensitive' } },
          { answer: { contains: 'OMR 12.000', mode: 'insensitive' } },
        ],
        isActive: true
      }
    });
    
    console.log(`\n📊 Found ${rateEntries.length} entries with specific OMR rates:`);
    
    rateEntries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.question}`);
      console.log(`   Answer: ${entry.answer.substring(0, 100)}...`);
      
      // Check what rates are mentioned
      if (entry.answer.includes('OMR 0.200')) console.log('   💰 Contains hourly rate: OMR 0.200');
      if (entry.answer.includes('OMR 2.000')) console.log('   💰 Contains daily rate: OMR 2.000');
      if (entry.answer.includes('OMR 12.000')) console.log('   💰 Contains weekly rate: OMR 12.000');
    });
    
    // Test simple search
    console.log('\n🔍 Testing search for "1 hour parking"...');
    const hourlyEntries = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { question: { contains: '1 hour', mode: 'insensitive' } },
          { answer: { contains: '1 hour', mode: 'insensitive' } },
          { answer: { contains: 'hourly', mode: 'insensitive' } }
        ],
        category: 'parking',
        isActive: true
      },
      take: 3
    });
    
    console.log(`📋 Found ${hourlyEntries.length} hourly parking entries`);
    hourlyEntries.forEach(entry => {
      console.log(`   - ${entry.question.substring(0, 60)}...`);
    });
    
    if (rateEntries.length > 0) {
      console.log('\n✅ SUCCESS: Specific parking rates are in the knowledge base!');
      console.log('💡 The issue might be with relevance scoring or context building in AI service.');
    } else {
      console.log('\n❌ ISSUE: No specific OMR rates found in knowledge base!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testParkingRatesInKB();


