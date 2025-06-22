const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'
    }
  }
});

const knowledgeEntries = [
  {
    category: 'transportation',
    subcategory: 'directions',
    question: 'How do I get to Muscat Airport from Burj Al Sahwa roundabout?',
    answer: `🗺️ **Directions from Burj Al Sahwa Roundabout to Muscat Airport:**

**Route:** Take Sultan Qaboos Highway (Highway 1) eastbound towards Seeb
**Distance:** Approximately 12-15 km
**Travel Time:** 15-20 minutes (depending on traffic)

**Detailed Directions:**
1. From Burj Al Sahwa roundabout, head northeast toward Sultan Qaboos Highway
2. Merge onto Sultan Qaboos Highway (Highway 1) heading towards Seeb
3. Continue on Highway 1 for approximately 12 km
4. Take the exit for Muscat International Airport (clearly signposted)
5. Follow the airport access road to the terminal building

The airport is well-signposted from the highway, and you'll see clear directional signs as you approach the exit.`,
    keywords: ['burj al sahwa', 'directions', 'roundabout', 'highway', 'route', 'drive'],
    priority: 3
  },
  {
    category: 'transportation',
    subcategory: 'public_transport',
    question: 'Is public transportation available from Muscat Airport?',
    answer: `🚌 **Public Transportation from Muscat Airport:**

**Mwasalat Public Buses:**
- **Route 1**: Airport ↔ Ruwi (City Center) - Every 30-45 minutes
- **Route 2**: Airport ↔ Seeb - Every 30-45 minutes
- **Operating Hours**: 6:00 AM - 10:00 PM
- **Fare**: 500 Baisa - 1 OMR
- **Bus Stop**: Outside arrivals hall

**Hotel Shuttles:**
- Many hotels provide complimentary shuttle services
- Advance booking required (24-48 hours)
- Contact your hotel directly for schedules`,
    keywords: ['public transport', 'bus', 'mwasalat', 'shuttle', 'route', 'transportation'],
    priority: 3
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');
    
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Clear existing entries
    await prisma.knowledgeBase.deleteMany({});
    console.log('🧹 Cleared existing knowledge base');

    // Add new entries
    for (const entry of knowledgeEntries) {
      await prisma.knowledgeBase.create({
        data: entry
      });
      console.log(`✅ Added: ${entry.question.substring(0, 50)}...`);
    }

    const count = await prisma.knowledgeBase.count();
    console.log(`📊 Total entries: ${count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected');
  }
}

seedDatabase(); 