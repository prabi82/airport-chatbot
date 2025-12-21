const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Exact information from the website
const sleepingSeatsInfo = {
  question: 'Are there sleeping seats at Muscat International Airport?',
  answer: `**Sleeping Seats at Muscat International Airport:**\n\n` +
    `✅ **Yes, sleeping seats are available!**\n\n` +
    `📍 **Location:**\n` +
    `• Sleeping seats can be found at the end of the departure hall\n\n` +
    `💰 **Cost:**\n` +
    `• The seats are **free of charge** on a first come, first served basis\n\n` +
    `💡 **Additional Information:**\n` +
    `• Available for all passengers\n` +
    `• No reservation required\n` +
    `• Comfortable seating for rest and relaxation\n` +
    `• Suitable for waiting between flights or overnight stays\n\n` +
    `**📞 For More Information:**\n` +
    `• Airport Support: +968 24351234\n` +
    `• Visit the Airport Information Desk for directions to the sleeping seats area`,
  category: 'airport_facilities',
  subcategory: 'Sleeping & Rest Areas',
  keywords: ['sleeping', 'seats', 'sleep', 'rest', 'departure hall', 'free', 'first come first served'],
  sourceUrl: 'https://www.muscatairport.co.om/content/refreshment-facilities',
  priority: 10,
  isActive: true
};

const additionalQuestions = [
  {
    question: 'Where are the sleeping seats located?',
    answer: `**Location of Sleeping Seats:**\n\n` +
      `📍 Sleeping seats can be found at the end of the departure hall at Muscat International Airport.\n\n` +
      `💡 **Tips:**\n` +
      `• Look for signage directing you to the departure hall\n` +
      `• The seats are located at the far end of the departure area\n` +
      `• Ask airport staff for directions if needed\n\n` +
      `**📞 For Assistance:**\n` +
      `• Airport Support: +968 24351234\n` +
      `• Information Desk staff can provide directions`,
    keywords: ['sleeping', 'seats', 'location', 'where', 'departure hall', 'find']
  },
  {
    question: 'Are sleeping seats free?',
    answer: `**Sleeping Seats - Free of Charge:**\n\n` +
      `✅ **Yes, sleeping seats are completely free!**\n\n` +
      `💰 **Cost:**\n` +
      `• The seats are free of charge\n` +
      `• No payment required\n` +
      `• Available on a first come, first served basis\n\n` +
      `📍 **Location:**\n` +
      `• Found at the end of the departure hall\n\n` +
      `💡 **Note:**\n` +
      `• No reservation needed\n` +
      `• Available for all passengers\n` +
      `• Subject to availability`,
    keywords: ['sleeping', 'seats', 'free', 'cost', 'charge', 'price']
  },
  {
    question: 'Can I sleep at the airport?',
    answer: `**Sleeping at Muscat International Airport:**\n\n` +
      `✅ **Yes, you can sleep at the airport!**\n\n` +
      `💤 **Sleeping Seats:**\n` +
      `• **Location:** At the end of the departure hall\n` +
      `• **Cost:** Free of charge\n` +
      `• **Availability:** First come, first served basis\n` +
      `• **Suitable for:** Overnight stays, waiting between flights, early morning departures\n\n` +
      `🏨 **Alternative Option:**\n` +
      `• Aerotel Hotel is available for paid accommodation within the airport\n\n` +
      `💡 **Tips:**\n` +
      `• Sleeping seats are comfortable for rest and relaxation\n` +
      `• No reservation required\n` +
      `• Available 24/7\n\n` +
      `**📞 For More Information:**\n` +
      `• Airport Support: +968 24351234`,
    keywords: ['sleep', 'sleeping', 'airport', 'overnight', 'rest', 'stay']
  },
  {
    question: 'Where can I rest at the airport?',
    answer: `**Rest Areas at Muscat International Airport:**\n\n` +
      `💤 **Sleeping Seats:**\n` +
      `• **Location:** At the end of the departure hall\n` +
      `• **Cost:** Free of charge\n` +
      `• **Availability:** First come, first served\n` +
      `• Comfortable seating for rest and relaxation\n\n` +
      `🏢 **Primeclass Lounge:**\n` +
      `• Paid access available (OMR 25 for 3 hours)\n` +
      `• Located in Departures Level 4\n` +
      `• Comfortable seating, refreshments, and quiet environment\n\n` +
      `📍 **Other Rest Areas:**\n` +
      `• Seating areas throughout the terminal\n` +
      `• Refreshment facilities with comfortable seating\n` +
      `• Waiting areas in arrivals and departures\n\n` +
      `**📞 For Assistance:**\n` +
      `• Airport Support: +968 24351234`,
    keywords: ['rest', 'rest area', 'sleeping', 'seats', 'relax', 'waiting']
  }
];

async function updateSleepingSeatsKB() {
  try {
    console.log('🔄 Updating sleeping seats knowledge base entries...\n');

    // Update or create main entry
    const existing = await prisma.knowledgeBase.findFirst({
      where: {
        question: sleepingSeatsInfo.question,
        sourceUrl: sleepingSeatsInfo.sourceUrl
      }
    });

    if (existing) {
      await prisma.knowledgeBase.update({
        where: { id: existing.id },
        data: {
          answer: sleepingSeatsInfo.answer,
          category: sleepingSeatsInfo.category,
          subcategory: sleepingSeatsInfo.subcategory,
          keywords: sleepingSeatsInfo.keywords,
          priority: sleepingSeatsInfo.priority,
          isActive: true,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Updated: ${sleepingSeatsInfo.question}`);
    } else {
      await prisma.knowledgeBase.create({
        data: sleepingSeatsInfo
      });
      console.log(`✅ Created: ${sleepingSeatsInfo.question}`);
    }

    // Update or create additional entries
    for (const entry of additionalQuestions) {
      const existingEntry = await prisma.knowledgeBase.findFirst({
        where: {
          question: entry.question,
          sourceUrl: sleepingSeatsInfo.sourceUrl
        }
      });

      const fullEntry = {
        ...entry,
        category: 'airport_facilities',
        subcategory: 'Sleeping & Rest Areas',
        sourceUrl: sleepingSeatsInfo.sourceUrl,
        priority: 9,
        isActive: true
      };

      if (existingEntry) {
        await prisma.knowledgeBase.update({
          where: { id: existingEntry.id },
          data: {
            answer: fullEntry.answer,
            keywords: fullEntry.keywords,
            priority: fullEntry.priority,
            isActive: true,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question}`);
      } else {
        await prisma.knowledgeBase.create({
          data: fullEntry
        });
        console.log(`✅ Created: ${entry.question}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Successfully updated ${1 + additionalQuestions.length} sleeping seats entries`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSleepingSeatsKB();

