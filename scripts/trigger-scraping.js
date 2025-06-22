#!/usr/bin/env node

// Simple script to trigger web scraping
console.log('🚀 Triggering Web Scraping for Oman Airports...\n');

const API_BASE = 'http://localhost:3001/api'; // Using port 3001 as seen in logs

// Simple HTTP request function
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? require('https') : require('http');
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function triggerScraping() {
  try {
    console.log('🔄 Step 1: Checking scraper health...');
    
    // Check scraper health
    const healthResponse = await makeRequest(`${API_BASE}/admin/scraper?action=health`);
    
    if (healthResponse.status === 200) {
      console.log('✅ Scraper service is healthy');
      console.log('Sources status:', JSON.stringify(healthResponse.data.sources, null, 2));
    } else {
      console.log('⚠️ Scraper health check failed:', healthResponse.status);
    }

    console.log('\n🔄 Step 2: Triggering scraping of all sources...');
    
    // Trigger scraping
    const scrapeResponse = await makeRequest(`${API_BASE}/admin/scraper`, {
      method: 'POST',
      body: { action: 'scrape_all' }
    });
    
    if (scrapeResponse.status === 200) {
      console.log('✅ Scraping triggered successfully!');
      console.log('Results:', JSON.stringify(scrapeResponse.data, null, 2));
    } else {
      console.log('❌ Scraping failed:', scrapeResponse.status, scrapeResponse.data);
    }

    console.log('\n🔄 Step 3: Checking cache statistics...');
    
    // Check cache stats
    const cacheResponse = await makeRequest(`${API_BASE}/admin/scraper?action=cache_stats`);
    
    if (cacheResponse.status === 200) {
      console.log('✅ Cache statistics:');
      console.log(JSON.stringify(cacheResponse.data, null, 2));
    } else {
      console.log('⚠️ Cache stats failed:', cacheResponse.status);
    }

    console.log('\n🎉 Web scraping activation complete!');
    console.log('💡 The chatbot should now use real data from airport websites.');
    console.log('🧪 Test it by asking questions about airport services or transportation.');

  } catch (error) {
    console.error('❌ Error triggering scraping:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the development server is running (npm run dev)');
    console.log('2. Check that the server is running on port 3001');
    console.log('3. Verify the admin scraper API is accessible');
  }
}

// Run the script
triggerScraping(); 