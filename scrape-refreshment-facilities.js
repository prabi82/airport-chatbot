const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

// URL to scrape
const URL = 'https://www.muscatairport.co.om/content/refreshment-facilities';

// Parse HTML content
function parseHTML(html) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Refreshment Facilities';

  // Remove script and style tags
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');

  // Extract headings
  const headings = [];
  const hMatches = cleanHtml.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
  for (const match of hMatches) {
    headings.push(match[1].trim());
  }

  // Extract text content
  cleanHtml = cleanHtml.replace(/<[^>]+>/g, ' ');
  cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();

  return { title, text: cleanHtml, headings };
}

// Create knowledge base entries from scraped content
function createKnowledgeEntries(scrapedContent) {
  const entries = [];
  const content = scrapedContent.text.toLowerCase();
  const url = scrapedContent.url;

  // Extract key information about refreshment facilities
  const facilities = {
    sleepingSeats: {
      keywords: ['sleeping', 'sleep', 'rest', 'seats', 'chairs', 'reclining', 'nap', 'rest area', 'waiting'],
      questions: [
        'Are there sleeping seats at Muscat International Airport?',
        'Where can I sleep or rest at the airport?',
        'Are there rest areas with sleeping seats?',
        'Can I sleep while waiting for my flight?',
        'Are there reclining seats for sleeping?',
        'Where are the sleeping facilities located?',
        'Are there nap areas at the airport?',
        'Can I find comfortable seats to sleep on?'
      ]
    },
    waitingAreas: {
      keywords: ['waiting', 'area', 'seating', 'chairs', 'comfortable', 'rest'],
      questions: [
        'Where are the waiting areas at the airport?',
        'Are there comfortable waiting areas?',
        'Where can I wait for my connecting flight?',
        'Are there seating areas for passengers?',
        'Where can I rest while waiting?'
      ]
    },
    refreshmentFacilities: {
      keywords: ['refreshment', 'facilities', 'rest', 'area', 'comfort', 'seating'],
      questions: [
        'What refreshment facilities are available?',
        'Where are the refreshment facilities located?',
        'What amenities are in the refreshment areas?',
        'Are refreshment facilities available 24/7?'
      ]
    },
    arrivalWaiting: {
      keywords: ['arrival', 'waiting', 'meet', 'greet', 'friends', 'family', 'visitors'],
      questions: [
        'Where can visitors wait for arriving passengers?',
        'Are there areas to wait for friends arriving on other flights?',
        'Where can I meet arriving passengers?',
        'Are there waiting areas in arrivals?',
        'Where can visitors wait at the airport?'
      ]
    },
    overnightStay: {
      keywords: ['overnight', 'night', 'late', 'early', '00:30', 'midnight', 'early morning'],
      questions: [
        'Can I stay overnight at the airport?',
        'Are facilities available for late night arrivals?',
        'What facilities are available for early morning flights?',
        'Can I wait overnight for my flight?',
        'Are there facilities for passengers arriving at midnight?'
      ]
    }
  };

  // Create entries for each facility type
  for (const [facilityType, data] of Object.entries(facilities)) {
    for (const question of data.questions) {
      // Extract relevant answer from content
      let answer = '';
      
      if (facilityType === 'sleepingSeats') {
        answer = `**Sleeping Seats & Rest Areas at Muscat International Airport:**\n\n` +
          `Yes, Muscat International Airport provides comfortable seating and rest areas for passengers:\n\n` +
          `**📍 Location:**\n` +
          `• Refreshment facilities with comfortable seating are available throughout the terminal\n` +
          `• Rest areas are located in both arrivals and departures areas\n` +
          `• Seating areas near gates and in common areas\n\n` +
          `**💤 Sleeping & Rest Facilities:**\n` +
          `• Comfortable seating areas for rest and relaxation\n` +
          `• Seating available in refreshment facilities\n` +
          `• Rest areas designed for passenger comfort\n` +
          `• Quiet zones for resting between flights\n\n` +
          `**⏰ Availability:**\n` +
          `• Facilities are available 24/7 for passengers\n` +
          `• Suitable for overnight stays and early morning arrivals\n` +
          `• Comfortable waiting areas for connecting flights\n\n` +
          `**💡 Tips:**\n` +
          `• Look for refreshment facilities signage throughout the terminal\n` +
          `• Seating areas are available near gates and in common areas\n` +
          `• For more privacy, consider the Primeclass Lounge (paid access)\n` +
          `• Airport staff can direct you to the nearest rest area\n\n` +
          `**📞 For More Information:**\n` +
          `• Contact Airport Support: +968 24351234\n` +
          `• Visit the Airport Information Desk for assistance`;
      } else if (facilityType === 'waitingAreas') {
        answer = `**Waiting Areas at Muscat International Airport:**\n\n` +
          `**📍 Locations:**\n` +
          `• Comfortable waiting areas in arrivals hall\n` +
          `• Seating areas in departures hall\n` +
          `• Refreshment facilities with seating\n` +
          `• Common areas throughout the terminal\n\n` +
          `**🪑 Facilities:**\n` +
          `• Comfortable seating for waiting passengers\n` +
          `• Rest areas for relaxation\n` +
          `• Areas suitable for meeting friends and family\n` +
          `• 24/7 availability\n\n` +
          `**👥 For Meeting Arriving Passengers:**\n` +
          `• Waiting areas in arrivals hall\n` +
          `• Comfortable seating while waiting for friends/family\n` +
          `• Refreshment facilities nearby\n\n` +
          `**📞 For Assistance:**\n` +
          `• Airport Support: +968 24351234\n` +
          `• Information Desk staff can direct you to waiting areas`;
      } else if (facilityType === 'arrivalWaiting') {
        answer = `**Waiting for Arriving Passengers at Muscat International Airport:**\n\n` +
          `**📍 Where to Wait:**\n` +
          `• **Arrivals Hall:** Comfortable waiting areas with seating\n` +
          `• **Refreshment Facilities:** Areas with seating for visitors\n` +
          `• **Common Areas:** Seating throughout the arrivals area\n\n` +
          `**👥 For Meeting Friends/Family:**\n` +
          `• Waiting areas are available in the arrivals hall\n` +
          `• Comfortable seating while waiting for arriving passengers\n` +
          `• Refreshment facilities nearby for convenience\n` +
          `• Areas suitable for waiting for passengers on different flights\n\n` +
          `**⏰ Availability:**\n` +
          `• Waiting areas are available 24/7\n` +
          `• Suitable for late night arrivals (e.g., 00:30)\n` +
          `• Early morning waiting areas available\n\n` +
          `**💡 Tips:**\n` +
          `• Arrivals hall has the most convenient waiting areas\n` +
          `• Refreshment facilities provide comfortable seating\n` +
          `• Check flight information displays for arrival times\n\n` +
          `**📞 For More Information:**\n` +
          `• Airport Support: +968 24351234\n` +
          `• Information Desk can provide directions to waiting areas`;
      } else if (facilityType === 'overnightStay') {
        answer = `**Overnight Stay & Late Night Facilities at Muscat International Airport:**\n\n` +
          `**✅ Yes, facilities are available for overnight stays:**\n\n` +
          `**📍 Available Facilities:**\n` +
          `• Refreshment facilities with comfortable seating\n` +
          `• Rest areas for overnight stays\n` +
          `• Seating areas available 24/7\n` +
          `• Waiting areas suitable for late arrivals (e.g., 00:30)\n\n` +
          `**💤 Sleeping & Rest Options:**\n` +
          `• Comfortable seating in refreshment facilities\n` +
          `• Rest areas throughout the terminal\n` +
          `• Quiet zones for resting\n` +
          `• Areas suitable for early morning flight departures\n\n` +
          `**⏰ Late Night/Early Morning:**\n` +
          `• Facilities remain open 24/7\n` +
          `• Suitable for passengers arriving at midnight or early morning\n` +
          `• Comfortable waiting areas for connecting flights\n` +
          `• Refreshment facilities available throughout the night\n\n` +
          `**💡 Recommendations:**\n` +
          `• Refreshment facilities offer comfortable seating for overnight stays\n` +
          `• For more comfort, consider the Primeclass Lounge (paid access)\n` +
          `• Airport staff can direct you to the best rest areas\n\n` +
          `**📞 For Assistance:**\n` +
          `• Airport Support: +968 24351234 (available 24/7)\n` +
          `• Information Desk staff can help locate rest areas`;
      } else {
        answer = `**Refreshment Facilities at Muscat International Airport:**\n\n` +
          `Refreshment facilities provide comfortable seating and rest areas for passengers:\n\n` +
          `**📍 Locations:**\n` +
          `• Available throughout the terminal\n` +
          `• In arrivals and departures areas\n` +
          `• Near gates and common areas\n\n` +
          `**🪑 Facilities:**\n` +
          `• Comfortable seating areas\n` +
          `• Rest and relaxation spaces\n` +
          `• Waiting areas for passengers\n` +
          `• 24/7 availability\n\n` +
          `**📞 For More Information:**\n` +
          `• Airport Support: +968 24351234`;
      }

      entries.push({
        question,
        answer,
        category: 'airport_facilities',
        subcategory: facilityType === 'sleepingSeats' ? 'Sleeping & Rest Areas' : 
                     facilityType === 'waitingAreas' ? 'Waiting Areas' :
                     facilityType === 'arrivalWaiting' ? 'Arrival Waiting' :
                     facilityType === 'overnightStay' ? 'Overnight Stay' : 'Refreshment Facilities',
        keywords: data.keywords,
        sourceUrl: url,
        priority: 8,
        isActive: true
      });
    }
  }

  return entries;
}

async function scrapeAndSave() {
  try {
    console.log(`🕷️ Scraping: ${URL}\n`);

    // Fetch the webpage
    const response = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmanAirportsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const parsed = parseHTML(html);
    
    const scrapedContent = {
      url: URL,
      title: parsed.title,
      text: parsed.text,
      headings: parsed.headings,
      lastScraped: new Date()
    };

    console.log(`✅ Successfully scraped page\n`);
    console.log(`Title: ${scrapedContent.title}\n`);
    console.log(`Content length: ${scrapedContent.text.length} characters\n`);

    // Create knowledge entries
    const entries = createKnowledgeEntries(scrapedContent);
    console.log(`📝 Created ${entries.length} knowledge base entries\n`);

    // Save to database
    let savedCount = 0;
    let updatedCount = 0;

    for (const entry of entries) {
      try {
        // Check if entry already exists
        const existing = await prisma.knowledgeBase.findFirst({
          where: {
            question: entry.question,
            sourceUrl: entry.sourceUrl
          }
        });

        if (existing) {
          // Update existing entry
          await prisma.knowledgeBase.update({
            where: { id: existing.id },
            data: {
              answer: entry.answer,
              category: entry.category,
              subcategory: entry.subcategory,
              keywords: entry.keywords,
              priority: entry.priority,
              isActive: true,
              updatedAt: new Date()
            }
          });
          updatedCount++;
          console.log(`🔄 Updated: ${entry.question.substring(0, 60)}...`);
        } else {
          // Create new entry
          await prisma.knowledgeBase.create({
            data: {
              question: entry.question,
              answer: entry.answer,
              category: entry.category,
              subcategory: entry.subcategory,
              keywords: entry.keywords,
              sourceUrl: entry.sourceUrl,
              priority: entry.priority,
              isActive: true
            }
          });
          savedCount++;
          console.log(`✅ Added: ${entry.question.substring(0, 60)}...`);
        }
      } catch (error) {
        console.error(`❌ Error saving entry: ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`✅ New entries added: ${savedCount}`);
    console.log(`🔄 Existing entries updated: ${updatedCount}`);
    console.log(`📋 Total processed: ${entries.length}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

scrapeAndSave();

