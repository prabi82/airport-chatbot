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
  },
  {
    category: 'services',
    subcategory: 'car_rental',
    question: 'Which car rental companies are available at Muscat Airport?',
    answer: `🚗 **Car Rental Companies at Muscat Airport:**

**International Brands:**
- **Avis**: Terminal arrivals hall, 24/7 service
- **Hertz**: Ground floor, arrivals area
- **Budget**: Adjacent to arrivals hall
- **Europcar**: Terminal building, arrivals level
- **Sixt**: Available at arrivals area

**Local Companies:**
- **Mark Rent a Car**: Omani company with competitive rates
- **Fast Rent a Car**: Local service with good coverage
- **United Car Rental**: Established local provider

**Services:**
- 24/7 availability for major brands
- Online booking available
- Multiple vehicle categories (economy to luxury)
- GPS navigation systems available
- Insurance options included

**Location:** All car rental desks are located in the arrivals hall for easy access after landing.

**Booking:** Advance booking recommended, especially during peak seasons.`,
    keywords: ['car rental', 'rent a car', 'rental companies', 'avis', 'hertz', 'budget', 'europcar', 'sixt'],
    priority: 3
  },
  {
    category: 'services',
    subcategory: 'taxi',
    question: 'Are taxis available 24/7 at Muscat Airport?',
    answer: `🚕 **Taxi Services at Muscat Airport:**

**Availability:**
- 24/7 taxi service available
- Located outside arrivals hall
- No advance booking required

**Types of Service:**
- **Airport Taxis**: Official airport taxi service
- **Private Taxis**: Licensed private operators  
- **Ride-hailing**: Careem and Uber available

**Rates:**
- **To Muscat City Center**: 8-12 OMR
- **To Seeb**: 4-6 OMR
- **To Nizwa**: 25-30 OMR
- **To Sur**: 35-40 OMR

**Features:**
- All taxis use meters
- Credit cards accepted by most drivers
- English-speaking drivers available
- Air-conditioned vehicles

**Tips:**
- Confirm the fare before starting your journey
- Keep your receipt for reference
- Airport taxis are generally more reliable than street taxis`,
    keywords: ['taxi', 'cab', '24/7', 'rates', 'careem', 'uber', 'airport taxi'],
    priority: 3
  },
  {
    category: 'services',
    subcategory: 'parking',
    question: 'What are the parking rates at Muscat Airport?',
    answer: `🅿️ **Parking at Muscat Airport:**

**Parking Areas:**
- **P1**: Short-term parking (closest to terminal)
- **P2**: Medium-term parking
- **P3**: Long-term parking (most economical)

**Rates:**
- **First 30 minutes**: Free
- **1-2 hours**: 2 OMR
- **2-24 hours**: 5 OMR per day
- **Long-term**: 3 OMR per day (P3 area)

**Payment Methods:**
- Cash (OMR)
- Credit/Debit cards
- Payment machines available

**Features:**
- 24/7 availability
- CCTV surveillance
- Covered parking available
- Easy access to terminal`,
    keywords: ['parking', 'park', 'rates', 'P1', 'P2', 'P3', 'payment', 'cost'],
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