const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateParkingRates() {
  try {
    console.log('🔧 Updating parking rates in knowledge base...');

    // Find the parking entry
    const parkingEntry = await prisma.knowledgeBase.findFirst({
      where: {
        category: 'services',
        subcategory: 'parking',
        question: {
          contains: 'parking rates'
        }
      }
    });

    if (parkingEntry) {
      // Update with correct rates
      const updatedAnswer = `🅿️ **Parking at Muscat Airport:**

**Parking Areas:**
- **P1**: Short-term parking (closest to terminal)
- **P2**: Medium-term parking
- **P3**: Long-term parking (most economical)

**Current Rates:**
- **30 minutes**: OMR 0.600
- **1 hour**: OMR 1.100
- **2 hours**: OMR 2.100
- **3 hours**: OMR 3.200
- **Long-term (P3)**: OMR 3.000 per day

**Payment Methods:**
- Cash (OMR)
- Credit/Debit cards
- Payment machines available

**Features:**
- 24/7 availability
- CCTV surveillance
- Covered parking available
- Easy access to terminal`;

      await prisma.knowledgeBase.update({
        where: { id: parkingEntry.id },
        data: {
          answer: updatedAnswer,
          updatedAt: new Date()
        }
      });

      console.log('✅ Parking rates updated successfully!');
      console.log('📊 New rates:');
      console.log('   • 30 minutes: OMR 0.600');
      console.log('   • 1 hour: OMR 1.100');
      console.log('   • 2 hours: OMR 2.100');
      console.log('   • 3 hours: OMR 3.200');
      console.log('   • Long-term: OMR 3.000 per day');
    } else {
      console.log('❌ Parking entry not found in database');
    }

  } catch (error) {
    console.error('❌ Error updating parking rates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateParkingRates(); 