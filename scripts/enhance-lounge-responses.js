const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const loungeKnowledgeEntries = [
  // Q1: Location Information
  {
    question: "Where is the Primeclass Lounge located at Muscat International Airport?",
    answer: "The **Primeclass Lounge** is located on the **Departures Level** (Level 4) of Muscat International Airport, in the international terminal area. 📍 **Location Details:** • **Level:** Departures Level 4 • **Area:** International Terminal • **Access:** After security and immigration clearance • **Signage:** Follow signs for 'Primeclass Lounge' or 'Premium Lounge' • **Operating Hours:** Available 24/7 for departing passengers The lounge is easily accessible and well-signposted throughout the terminal. Airport staff can provide directions if needed.",
    category: "lounge_facilities",
    sourceUrl: "https://www.muscatairport.co.om/en/content/primeclass-lounge"
  },
  
  // Q2: Comprehensive Facilities
  {
    question: "What facilities are available in the Primeclass Lounge?",
    answer: "The **Primeclass Lounge** offers a comprehensive range of premium facilities: 🏢 **Core Amenities:** • **Comfortable Seating Areas** - Various seating options for relaxation • **Complimentary WiFi** - High-speed internet throughout the lounge • **Shower Facilities** - Private shower rooms with amenities • **Prayer Area** - Dedicated quiet space for prayers • **Reading Area** - Quiet zone with newspapers and magazines 👨‍👩‍👧‍👦 **Family Facilities:** • **Kids Play Area** - Safe and entertaining space for children • **Family Rooms** - Private areas for families with children 🍽️ **Dining Services:** • **International Buffet** - Hot and cold food selections • **Beverage Station** - Coffee, tea, soft drinks, and juices • **Snack Bar** - Light refreshments and pastries 💼 **Business Services:** • **Work Stations** - Equipped with charging points • **Meeting Areas** - Small spaces for business discussions All facilities are designed to provide comfort and convenience for your travel experience.",
    category: "lounge_facilities", 
    sourceUrl: "https://www.muscatairport.co.om/en/content/primeclass-lounge"
  },

  // Q19: Porter Information
  {
    question: "Where can I find porters at the airport?",
    answer: "**Primeclass Porter Service** is available throughout Muscat International Airport: 📍 **Porter Locations:** • **Departures Level** - Near check-in counters and entrance • **Arrivals Level** - Baggage claim and exit areas • **Curbside Service** - Available at terminal entrances • **Gate Areas** - Assistance for connecting flights 📞 **How to Request:** • **Phone:** +968 98264399 (Primeclass Call Center) • **On-site:** Approach any porter wearing official Primeclass uniform • **Pre-booking:** Available through Primeclass services 💰 **Service Information:** Porter services help with baggage handling, wheelchair assistance, and general passenger support. Fees vary based on service type and duration. The service is available 24/7 to assist passengers with their luggage and mobility needs.",
    category: "airport_services",
    sourceUrl: "https://www.muscatairport.co.om/en/content/primeclass-lounge"
  },

  // Q21: Parking Options
  {
    question: "What parking options are available at Muscat International Airport?",
    answer: "Muscat International Airport offers multiple parking solutions: 🚗 **Parking Areas:** • **Short-term Parking** - For quick pick-ups and drop-offs (first 30 minutes free) • **Long-term Parking** - For extended stays with competitive daily rates • **Premium Parking** - Covered parking with enhanced security • **Valet Parking** - Convenient car care service with Primeclass Car Wash 💳 **Payment Options:** • **Automated Ticket Machines** - Accept Omani Riyals only • **Attendant Assistance** - Available 24/7 for payment support • **Pre-payment** - Available for longer stays 📍 **Location Information:** • **Terminal Access** - Direct covered walkways to terminals • **Security** - 24/7 surveillance and patrol • **Capacity** - Over 3,000 parking spaces available 🕐 **Pick-up/Drop-off Zones:** • **Maximum Stay:** 10 minutes free • **Location:** Directly in front of departures and arrivals • **Enforcement:** Vehicles exceeding time limits may be seized",
    category: "transportation",
    sourceUrl: "https://www.muscatairport.co.om/en/content/primeclass-lounge"
  },

  // Q32: Entertainment Options  
  {
    question: "What entertainment options are available in the lounge?",
    answer: "The **Primeclass Lounge** provides various entertainment and leisure facilities: 📺 **Entertainment Features:** • **Television Viewing** - Multiple screens with international channels • **Reading Materials** - International newspapers and magazines • **Free WiFi** - High-speed internet for streaming and browsing • **Charging Stations** - Multiple USB and power outlets throughout 🎮 **Family Entertainment:** • **Kids Play Area** - Interactive games and toys for children • **Family Viewing Area** - Comfortable seating for families • **Quiet Zones** - Peaceful areas for reading and relaxation 💻 **Digital Amenities:** • **Work Stations** - Equipped areas for business travelers • **Device Charging** - Universal charging points available • **Internet Access** - Complimentary high-speed WiFi The lounge focuses on providing a calm, comfortable environment rather than high-energy entertainment, perfect for relaxation before your flight. The atmosphere is designed to help you unwind and prepare for travel in a peaceful setting.",
    category: "lounge_facilities",
    sourceUrl: "https://www.muscatairport.co.om/en/content/primeclass-lounge"
  }
];

async function enhanceLoungeKnowledge() {
  console.log('🏢 Enhancing Lounge Knowledge Base...\n');
  
  let addedCount = 0;
  let updatedCount = 0;
  
  for (const entry of loungeKnowledgeEntries) {
    console.log(`Processing: ${entry.question.substring(0, 50)}...`);
    
    try {
      // Check if entry already exists
      const existing = await prisma.knowledgeBase.findFirst({
        where: {
          question: entry.question
        }
      });
      
      if (existing) {
        // Update existing entry
        await prisma.knowledgeBase.update({
          where: { id: existing.id },
          data: {
            answer: entry.answer,
            category: entry.category,
            sourceUrl: entry.sourceUrl,
            isActive: true,
            updatedAt: new Date()
          }
        });
        console.log('✅ Updated existing entry');
        updatedCount++;
      } else {
        // Create new entry
        await prisma.knowledgeBase.create({
          data: {
            question: entry.question,
            answer: entry.answer,
            category: entry.category,
            sourceUrl: entry.sourceUrl,
            isActive: true
          }
        });
        console.log('✅ Added new entry');
        addedCount++;
      }
    } catch (error) {
      console.log(`❌ Error processing entry: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log(`${'='.repeat(60)}`);
  console.log(`📊 Enhancement Complete!`);
  console.log(`📝 New entries added: ${addedCount}`);
  console.log(`🔄 Existing entries updated: ${updatedCount}`);
  console.log(`📋 Total processed: ${loungeKnowledgeEntries.length}`);
  console.log(`${'='.repeat(60)}`);
  
  await prisma.$disconnect();
}

enhanceLoungeKnowledge().catch(console.error); 
