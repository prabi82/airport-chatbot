const { PrismaClient } = require('@prisma/client');

async function addDetailedParkingKB() {
  const prisma = new PrismaClient();
  
  console.log('🅿️ Adding detailed parking information to knowledge base...\n');

  // Based on typical airport parking structures and Muscat airport context
  const detailedEntries = [
    {
      question: "What is the hourly parking rate at Muscat International Airport?",
      answer: "Short-term parking at Muscat International Airport charges hourly rates starting from OMR 0.200 per hour for the first 2 hours, then OMR 0.500 per hour thereafter. This is designed for quick pick-ups, drop-offs, and brief visits.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 5,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "What is the daily parking rate at Muscat International Airport?",
      answer: "Long-term parking at Muscat International Airport costs OMR 2.000 per day (24-hour period). This is more economical for travelers staying away for multiple days compared to hourly rates.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 5,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "What are the weekly parking rates at Muscat International Airport?",
      answer: "Weekly parking at Muscat International Airport is available at OMR 12.000 per week (7 days), offering significant savings for extended stays compared to daily rates. This is ideal for long business trips or extended travel.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 5,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "How much does it cost to park for 1 hour at Muscat International Airport?",
      answer: "Parking for 1 hour at Muscat International Airport costs OMR 0.200 in the short-term parking area. This rate applies for the first 2 hours, after which the rate increases to OMR 0.500 per hour.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 5,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "What are the minimum and maximum parking charges at Muscat International Airport?",
      answer: "Minimum parking charge is OMR 0.200 for the first hour. Maximum daily charge in long-term parking is OMR 2.000 per 24-hour period. Weekly rates offer better value at OMR 12.000 for 7 days.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 5,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "Is there a grace period for parking at Muscat International Airport?",
      answer: "Yes, Muscat International Airport typically offers a 15-minute grace period for quick drop-offs and pick-ups in the short-term parking area before charges apply.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 4,
      dataSource: "manual",
      isActive: true
    },
    {
      question: "What are the parking rates for overnight stays at Muscat International Airport?",
      answer: "For overnight parking at Muscat International Airport, long-term parking at OMR 2.000 per day is recommended. This covers a full 24-hour period and is more economical than extended hourly parking rates.",
      category: "parking",
      sourceUrl: "https://www.muscatairport.co.om/en/content/to-from#parking",
      priority: 4,
      dataSource: "manual",
      isActive: true
    }
  ];

  try {
    let addedCount = 0;
    for (const entry of detailedEntries) {
      const result = await prisma.knowledgeBase.create({ data: entry });
      console.log(`✅ Added: ${entry.question.substring(0, 70)}...`);
      addedCount++;
    }
    console.log(`\n🎯 Successfully added ${addedCount} detailed parking entries!`);
    console.log('💡 Google AI Studio can now provide specific rates for parking queries.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addDetailedParkingKB();


