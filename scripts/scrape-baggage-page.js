const fs = require('fs').promises;
const path = require('path');

// Simple fetch implementation for Node.js environments
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Baggage page URL
const BAGGAGE_URL = 'https://www.muscatairport.co.om/en/content/baggage';

// Simple HTML parser for Node.js
function parseHTML(html) {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Baggage Information';

  // Extract headings
  const headings = [];
  const headingMatches = cleanHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
  if (headingMatches) {
    headingMatches.forEach(match => {
      const textMatch = match.match(/>([^<]+)</);
      if (textMatch) {
        headings.push(textMatch[1].trim());
      }
    });
  }

  // Extract text content
  let text = cleanHtml.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  // Clean up common noise
  text = text.replace(/\b(cookie|privacy|terms|conditions|subscribe|newsletter)\b/gi, '');
  
  return { title, text, headings };
}

async function scrapeBaggagePage() {
  try {
    console.log('🕷️ Scraping Muscat Airport baggage page...');
    console.log(`📍 URL: ${BAGGAGE_URL}`);
    
    // Fetch the webpage
    const response = await fetch(BAGGAGE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmanAirportsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Successfully fetched webpage');
    
    const html = await response.text();
    console.log(`📄 HTML length: ${html.length} characters`);

    // Parse the content
    const parsed = parseHTML(html);
    
    console.log('📋 Parsing results:');
    console.log(`   📖 Title: ${parsed.title}`);
    console.log(`   📝 Content length: ${parsed.text.length} characters`);
    console.log(`   🏷️ Headings found: ${parsed.headings.length}`);
    
    if (parsed.headings.length > 0) {
      console.log('   📑 Headings:');
      parsed.headings.forEach((heading, index) => {
        console.log(`      ${index + 1}. ${heading}`);
      });
    }

    // Show content preview
    console.log('\n📖 Content Preview:');
    console.log('─'.repeat(50));
    console.log(parsed.text.substring(0, 800) + '...');
    console.log('─'.repeat(50));

    // Save to file
    const scrapedData = {
      url: BAGGAGE_URL,
      title: parsed.title,
      content: parsed.text,
      headings: parsed.headings,
      scrapedAt: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, '..', 'baggage_content_scraped.json');
    await fs.writeFile(outputFile, JSON.stringify(scrapedData, null, 2));
    
    console.log(`\n💾 Content saved to: ${outputFile}`);
    console.log('✅ Scraping completed successfully!');
    
    return scrapedData;
    
  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    throw error;
  }
}

// Run the scraper
if (require.main === module) {
  scrapeBaggagePage()
    .then(() => {
      console.log('\n🎉 Baggage page scraping completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Scraping failed:', error.message);
      process.exit(1);
    });
}

module.exports = { scrapeBaggagePage }; 