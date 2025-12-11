const fetch = require('node-fetch');

async function scrapeActualParkingRates() {
  console.log('🅿️ Scraping actual parking rates from official page...\n');
  
  const url = 'https://www.muscatairport.co.om/en/content/to-from#parking';
  
  try {
    // Call our web scraper API to get the content
    const response = await fetch('http://localhost:3000/api/admin/scraper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        generateKnowledge: true
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Scraping successful!');
      console.log(`📄 Title: ${result.scrapedContent?.title || 'N/A'}`);
      console.log(`📝 Content length: ${result.scrapedContent?.content?.length || 0} characters`);
      console.log(`🧠 Knowledge entries generated: ${result.knowledgeEntries?.length || 0}`);
      
      if (result.knowledgeEntries && result.knowledgeEntries.length > 0) {
        console.log('\n📋 Generated parking knowledge entries:');
        result.knowledgeEntries.forEach((entry, index) => {
          console.log(`\n${index + 1}. Q: ${entry.question}`);
          console.log(`   A: ${entry.answer.substring(0, 100)}...`);
        });
      }
      
      if (result.scrapedContent?.content) {
        console.log('\n📄 First 500 characters of scraped content:');
        console.log(result.scrapedContent.content.substring(0, 500) + '...');
      }
      
    } else {
      console.log(`❌ Scraping failed: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Error scraping parking rates:', error.message);
  }
}

scrapeActualParkingRates();


