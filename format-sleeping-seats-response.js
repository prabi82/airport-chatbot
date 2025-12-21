const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Properly formatted response with clear structure
const formattedResponse = `**Sleeping Seats at Muscat International Airport**

✅ **Yes, sleeping seats are available!**

**📍 Location:**
Sleeping seats can be found at the end of the departure hall.

**💰 Cost:**
The seats are **free of charge** on a first come, first served basis.

**💡 Additional Information:**
• Available for all passengers
• No reservation required
• Comfortable seating for rest and relaxation
• Suitable for waiting between flights or overnight stays

**📞 For More Information:**
• Airport Support: +968 24351234
• Visit the Airport Information Desk for directions to the sleeping seats area`;

async function updateFormatting() {
  try {
    console.log('🔄 Updating sleeping seats response formatting...\n');

    // Find all sleeping seats entries
    const entries = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { question: { contains: 'sleeping seats', mode: 'insensitive' }, isActive: true },
          { question: { contains: 'sleeping', mode: 'insensitive' }, subcategory: { contains: 'Sleeping', mode: 'insensitive' }, isActive: true }
        ]
      }
    });

    for (const entry of entries) {
      // Update main question with properly formatted response
      if (entry.question.toLowerCase().includes('are there sleeping seats')) {
        await prisma.knowledgeBase.update({
          where: { id: entry.id },
          data: {
            answer: formattedResponse,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question.substring(0, 60)}...`);
      }
      // Update location question
      else if (entry.question.toLowerCase().includes('where are the sleeping seats')) {
        const locationResponse = `**Location of Sleeping Seats**

📍 Sleeping seats can be found at the end of the departure hall at Muscat International Airport.

**💡 Tips:**
• Look for signage directing you to the departure hall
• The seats are located at the far end of the departure area
• Ask airport staff for directions if needed

**📞 For Assistance:**
• Airport Support: +968 24351234
• Information Desk staff can provide directions`;

        await prisma.knowledgeBase.update({
          where: { id: entry.id },
          data: {
            answer: locationResponse,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question.substring(0, 60)}...`);
      }
      // Update free/cost question
      else if (entry.question.toLowerCase().includes('are sleeping seats free') || entry.question.toLowerCase().includes('sleeping seats free')) {
        const freeResponse = `**Sleeping Seats - Free of Charge**

✅ **Yes, sleeping seats are completely free!**

**💰 Cost:**
• The seats are free of charge
• No payment required
• Available on a first come, first served basis

**📍 Location:**
Found at the end of the departure hall.

**💡 Note:**
• No reservation needed
• Available for all passengers
• Subject to availability`;

        await prisma.knowledgeBase.update({
          where: { id: entry.id },
          data: {
            answer: freeResponse,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question.substring(0, 60)}...`);
      }
      // Update "can I sleep" question
      else if (entry.question.toLowerCase().includes('can i sleep at the airport')) {
        const sleepResponse = `**Sleeping at Muscat International Airport**

✅ **Yes, you can sleep at the airport!**

**💤 Sleeping Seats:**
• **Location:** At the end of the departure hall
• **Cost:** Free of charge
• **Availability:** First come, first served basis
• **Suitable for:** Overnight stays, waiting between flights, early morning departures

**🏨 Alternative Option:**
• Aerotel Hotel is available for paid accommodation within the airport

**💡 Tips:**
• Sleeping seats are comfortable for rest and relaxation
• No reservation required
• Available 24/7

**📞 For More Information:**
• Airport Support: +968 24351234`;

        await prisma.knowledgeBase.update({
          where: { id: entry.id },
          data: {
            answer: sleepResponse,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question.substring(0, 60)}...`);
      }
      // Update "where can I rest" question
      else if (entry.question.toLowerCase().includes('where can i rest')) {
        const restResponse = `**Rest Areas at Muscat International Airport**

**💤 Sleeping Seats:**
• **Location:** At the end of the departure hall
• **Cost:** Free of charge
• **Availability:** First come, first served
• Comfortable seating for rest and relaxation

**🏢 Primeclass Lounge:**
• Paid access available (OMR 25 for 3 hours)
• Located in Departures Level 4
• Comfortable seating, refreshments, and quiet environment

**📍 Other Rest Areas:**
• Seating areas throughout the terminal
• Refreshment facilities with comfortable seating
• Waiting areas in arrivals and departures

**📞 For Assistance:**
• Airport Support: +968 24351234`;

        await prisma.knowledgeBase.update({
          where: { id: entry.id },
          data: {
            answer: restResponse,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${entry.question.substring(0, 60)}...`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Successfully updated ${entries.length} entries with proper formatting`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateFormatting();

