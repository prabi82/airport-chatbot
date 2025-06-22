import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import crypto from 'crypto-js';
import { prisma } from './database';

export interface ScrapingSource {
  name: string;
  url: string;
  selectors: {
    [key: string]: string;
  };
  category: string;
  language: string;
  isActive: boolean;
  rateLimit: number; // milliseconds between requests
}

export interface ScrapedContent {
  source: string;
  url: string;
  title: string;
  content: string;
  category: string;
  language: string;
  relevance: number;
  lastUpdated: Date;
  contentHash: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  relevance: number;
  source: string;
  category: string;
}

export interface ScrapingResult {
  success: boolean;
  data: ScrapedContent[];
  error?: string;
}

export class WebScraperService {
  private browser: Browser | null = null;
  private sources: ScrapingSource[] = [];
  private lastScrapeTime: Map<string, number> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeSources();
  }

  private initializeSources() {
    this.sources = [
      {
        name: 'Oman Airports Official',
        url: 'https://omanairports.co.om',
        selectors: {
          title: 'h1, h2, h3',
          content: 'p, .content, .description',
          news: '.news-item, .announcement',
          services: '.service-item, .facility'
        },
        category: 'official',
        language: 'en',
        isActive: true,
        rateLimit: 5000
      },
      {
        name: 'Muscat Airport',
        url: 'https://muscatairport.co.om',
        selectors: {
          title: 'h1, h2, h3',
          content: 'p, .content',
          flights: '.flight-info',
          services: '.service-list'
        },
        category: 'airport',
        language: 'en',
        isActive: true,
        rateLimit: 5000
      },
      {
        name: 'Salalah Airport',
        url: 'https://salalahairport.co.om',
        selectors: {
          title: 'h1, h2, h3',
          content: 'p, .content',
          services: '.services, .facilities'
        },
        category: 'airport',
        language: 'en',
        isActive: true,
        rateLimit: 5000
      },
      {
        name: 'Civil Aviation Authority',
        url: 'https://caa.gov.om',
        selectors: {
          title: 'h1, h2, h3',
          content: 'p, .content',
          regulations: '.regulation, .rule',
          announcements: '.announcement'
        },
        category: 'authority',
        language: 'en',
        isActive: true,
        rateLimit: 10000
      }
    ];
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });
      
      this.isInitialized = true;
      console.log('Web scraper initialized successfully');
    } catch (error) {
      console.error('Failed to initialize web scraper:', error);
      throw error;
    }
  }

  async scrapeSource(source: ScrapingSource): Promise<ScrapedContent[]> {
    if (!this.browser) {
      await this.initialize();
    }

    // Check rate limiting
    const lastScrape = this.lastScrapeTime.get(source.name) || 0;
    const timeSinceLastScrape = Date.now() - lastScrape;
    
    if (timeSinceLastScrape < source.rateLimit) {
      const waitTime = source.rateLimit - timeSinceLastScrape;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const page = await this.browser!.newPage();
    const results: ScrapedContent[] = [];

    try {
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the source
      await page.goto(source.url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract content based on selectors
      const extractedContent = this.extractContent($, source);
      
      if (extractedContent.length > 0) {
        for (const item of extractedContent) {
          const contentHash = this.generateContentHash(item.content);
          
          // Check if content has changed
          const existingContent = await this.getCachedContent(source.url, contentHash);
          
          if (!existingContent) {
            const scrapedItem: ScrapedContent = {
              source: source.name,
              url: source.url,
              title: item.title,
              content: item.content,
              category: source.category,
              language: source.language,
              relevance: this.calculateRelevance(item.content),
              lastUpdated: new Date(),
              contentHash
            };

            results.push(scrapedItem);
            await this.cacheContent(scrapedItem);
          }
        }
      }

      this.lastScrapeTime.set(source.name, Date.now());
      
    } catch (error) {
      console.error(`Error scraping ${source.name}:`, error);
    } finally {
      await page.close();
    }

    return results;
  }

  private extractContent($: cheerio.CheerioAPI, source: ScrapingSource): Array<{title: string, content: string}> {
    const results: Array<{title: string, content: string}> = [];

    // Extract titles and content
    const titles = $(source.selectors.title).map((_, el) => $(el).text().trim()).get();
    const contents = $(source.selectors.content).map((_, el) => $(el).text().trim()).get();

    // Combine titles with their associated content
    for (let i = 0; i < Math.min(titles.length, contents.length); i++) {
      const title = titles[i];
      const content = contents[i];
      
      if (title && content && content.length > 50) {
        const cleanTitle = this.cleanText(title);
        const cleanContent = this.cleanText(content);
        
        // Filter out clearly irrelevant content early
        if (this.isContentRelevant(cleanContent, cleanTitle)) {
          results.push({
            title: cleanTitle,
            content: cleanContent
          });
        }
      }
    }

    // Extract specific content types
    Object.keys(source.selectors).forEach(key => {
      if (key !== 'title' && key !== 'content') {
        const elements = $(source.selectors[key]);
        elements.each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 30) {
            const cleanText = this.cleanText(text);
            
            // Filter out irrelevant content
            if (this.isContentRelevant(cleanText)) {
              results.push({
                title: `${key.charAt(0).toUpperCase() + key.slice(1)} Information`,
                content: cleanText
              });
            }
          }
        });
      }
    });

    return results;
  }

  private isContentRelevant(content: string, title: string = ''): boolean {
    const lowerContent = content.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    // Immediately reject clearly irrelevant content
    const irrelevantPatterns = [
      'vacation', 'holiday', 'resort', 'beach', 'tropical', '5 star',
      'memorable', 'comfortable', 'family vacation', 'whitesandy beaches',
      'hospitality', 'incomparable', 'verify you are human',
      'complete the action below', 'captcha', 'security check',
      'please wait', 'loading', 'javascript required', 'enable cookies',
      'advertisement', 'sponsored', 'click here', 'subscribe now'
    ];

    if (irrelevantPatterns.some(pattern => lowerContent.includes(pattern) || lowerTitle.includes(pattern))) {
      return false;
    }

    // Look for airport-related content
    const airportKeywords = [
      'airport', 'terminal', 'flight', 'passenger', 'gate', 'departure',
      'arrival', 'baggage', 'check-in', 'boarding', 'security', 'customs',
      'parking', 'transportation', 'taxi', 'bus', 'shuttle', 'restaurant',
      'shop', 'wifi', 'lounge', 'assistance', 'service', 'facility',
      'information', 'contact', 'hours', 'location', 'rate', 'fee', 'cost'
    ];

    const hasAirportContent = airportKeywords.some(keyword => 
      lowerContent.includes(keyword) || lowerTitle.includes(keyword)
    );

    // Content should be airport-related and have sufficient length
    return hasAirportContent && content.length >= 30 && content.length <= 2000;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .trim();
  }

  private calculateRelevance(content: string): number {
    const keywords = [
      'airport', 'flight', 'terminal', 'gate', 'baggage', 'check-in',
      'departure', 'arrival', 'passenger', 'security', 'customs',
      'parking', 'transportation', 'taxi', 'bus', 'restaurant',
      'shop', 'wifi', 'lounge', 'assistance', 'service'
    ];

    const contentLower = content.toLowerCase();
    let relevanceScore = 0;

    keywords.forEach(keyword => {
      const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      relevanceScore += matches * 0.1;
    });

    // Normalize score to 0-1 range
    return Math.min(relevanceScore / keywords.length, 1);
  }

  private generateContentHash(content: string): string {
    return crypto.SHA256(content).toString();
  }

  async getCachedContent(url: string, contentHash: string): Promise<any> {
    try {
      return await prisma.scrapingCache.findFirst({
        where: {
          url: url,
          expiresAt: { gt: new Date() }
        }
      });
    } catch (error) {
      console.error('Error checking cached content:', error);
      return null;
    }
  }

  async cacheContent(content: ScrapedContent): Promise<void> {
    try {
      await prisma.scrapingCache.create({
        data: {
          url: content.url,
          content: JSON.stringify({
            title: content.title,
            content: content.content,
            category: content.category,
            language: content.language,
            relevance: content.relevance,
            source: content.source
          }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });
    } catch (error) {
      console.error('Error caching content:', error);
    }
  }

  async searchAcrossSources(query: string, limit: number = 5): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      // First, search cached content
      const cachedResults = await this.searchCachedContent(query, limit);
      results.push(...cachedResults);

      // If we don't have enough results, scrape fresh content
      if (results.length < limit) {
        const activeSources = this.sources.filter(s => s.isActive);
        
        for (const source of activeSources) {
          if (results.length >= limit) break;
          
          try {
            const freshContent = await this.scrapeSource(source);
            const relevantContent = freshContent
              .filter(content => this.isRelevantToQuery(content.content, query))
              .map(content => ({
                title: content.title,
                url: content.url,
                content: content.content,
                relevance: this.calculateQueryRelevance(content.content, query),
                source: content.source,
                category: content.category
              }))
              .sort((a, b) => b.relevance - a.relevance)
              .slice(0, limit - results.length);

            results.push(...relevantContent);
          } catch (error) {
            console.error(`Error scraping ${source.name} for query "${query}":`, error);
          }
        }
      }

      return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

    } catch (error) {
      console.error('Error searching across sources:', error);
      return [];
    }
  }

  private async searchCachedContent(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const cached = await prisma.scrapingCache.findMany({
        where: {
          expiresAt: { gt: new Date() }
        },
        take: limit * 2 // Get more to filter
      });

      return cached
        .filter((item: any) => {
          const data = item.scrapedData as any;
          return this.isRelevantToQuery(data.content, query);
        })
        .map((item: any) => {
          const data = item.scrapedData as any;
          return {
            title: data.title,
            url: item.url,
            content: data.content,
            relevance: this.calculateQueryRelevance(data.content, query),
            source: data.source,
            category: data.category
          };
        })
        .sort((a: any, b: any) => b.relevance - a.relevance)
        .slice(0, limit);

    } catch (error) {
      console.error('Error searching cached content:', error);
      return [];
    }
  }

  private isRelevantToQuery(content: string, query: string): boolean {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const contentLower = content.toLowerCase();
    
    // Specific keyword categories for better matching
    const queryCategories = {
      parking: ['parking', 'park', 'rate', 'fee', 'cost', 'price', 'hourly', 'daily', 'monthly'],
      transportation: ['taxi', 'bus', 'shuttle', 'transport', 'uber', 'careem', 'ride'],
      flight: ['flight', 'departure', 'arrival', 'gate', 'terminal', 'check-in', 'boarding'],
      services: ['restaurant', 'shop', 'wifi', 'lounge', 'food', 'dining', 'duty-free'],
      general: ['airport', 'terminal', 'passenger', 'service', 'facility', 'information']
    };

    // Detect query category
    let queryCategory = 'general';
    let maxCategoryMatches = 0;
    
    for (const [category, keywords] of Object.entries(queryCategories)) {
      const matches = keywords.filter(keyword => 
        queryWords.some(qWord => qWord.includes(keyword) || keyword.includes(qWord))
      ).length;
      
      if (matches > maxCategoryMatches) {
        maxCategoryMatches = matches;
        queryCategory = category;
      }
    }

    // Check if content contains relevant keywords for the detected category
    const relevantKeywords = queryCategories[queryCategory as keyof typeof queryCategories];
    const contentHasRelevantKeywords = relevantKeywords.some(keyword => 
      contentLower.includes(keyword)
    );

    // Check for direct query word matches
    const directMatches = queryWords.filter(word => 
      contentLower.includes(word) && word.length > 2
    ).length;

    // Filter out clearly irrelevant content
    const irrelevantPatterns = [
      'vacation', 'holiday', 'resort', 'beach', 'tropical', '5 star',
      'memorable', 'comfortable', 'family vacation', 'whitesandy',
      'hospitality', 'incomparable', 'verify you are human',
      'complete the action', 'captcha', 'security check'
    ];

    const hasIrrelevantContent = irrelevantPatterns.some(pattern => 
      contentLower.includes(pattern)
    );

    // Content must have relevant keywords AND direct matches AND not be irrelevant
    const minDirectMatches = Math.max(1, Math.floor(queryWords.length * 0.4));
    const isRelevant = contentHasRelevantKeywords && 
                      directMatches >= minDirectMatches && 
                      !hasIrrelevantContent &&
                      content.length > 30 &&
                      content.length < 1000; // Avoid very short or very long content

    return isRelevant;
  }

  private calculateQueryRelevance(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    let totalPossibleScore = 0;

    // Score based on exact word matches
    queryWords.forEach(word => {
      totalPossibleScore += 1;
      if (contentLower.includes(word)) {
        const frequency = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += Math.min(frequency * 0.3, 1); // Cap contribution per word
      }
    });

    // Bonus for specific information types
    const bonusKeywords = {
      'parking': ['rate', 'fee', 'cost', 'price', 'omr', 'rial', 'hour', 'day'],
      'transportation': ['taxi', 'fare', 'route', 'schedule', 'bus'],
      'services': ['available', 'location', 'hours', 'open', 'closed'],
      'flight': ['gate', 'terminal', 'time', 'status', 'delayed']
    };

    // Add bonus for information-rich content
    for (const [category, keywords] of Object.entries(bonusKeywords)) {
      if (queryWords.some(qw => category.includes(qw) || qw.includes(category))) {
        const bonusMatches = keywords.filter(kw => contentLower.includes(kw)).length;
        score += bonusMatches * 0.2;
        totalPossibleScore += keywords.length * 0.2;
      }
    }

    // Penalty for irrelevant content
    const penalties = [
      'vacation', 'resort', 'beach', 'tropical', 'holiday',
      'verify human', 'captcha', 'security check', 'action below'
    ];
    
    const penaltyCount = penalties.filter(p => contentLower.includes(p)).length;
    score -= penaltyCount * 0.5;

    // Normalize score
    return Math.max(0, Math.min(score / Math.max(totalPossibleScore, 1), 1));
  }

  async scrapeAllSources(): Promise<ScrapedContent[]> {
    const allResults: ScrapedContent[] = [];
    const activeSources = this.sources.filter(s => s.isActive);

    for (const source of activeSources) {
      try {
        const results = await this.scrapeSource(source);
        allResults.push(...results);
        console.log(`Scraped ${results.length} items from ${source.name}`);
      } catch (error) {
        console.error(`Failed to scrape ${source.name}:`, error);
      }
    }

    return allResults;
  }

  async getSourceHealth(): Promise<Array<{name: string, status: string, lastScrape: Date | null}>> {
    const health = [];
    
    for (const source of this.sources) {
      const lastScrape = this.lastScrapeTime.get(source.name);
      
      health.push({
        name: source.name,
        status: source.isActive ? 'active' : 'inactive',
        lastScrape: lastScrape ? new Date(lastScrape) : null
      });
    }

    return health;
  }

  async cleanup(): Promise<void> {
    // Clean up expired cache entries
    try {
      await prisma.scrapingCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
    }
  }

  async scrapeMuscatAirportTransportation(): Promise<ScrapingResult> {
    const url = 'https://www.muscatairport.co.om/en/content/to-from';
    
    try {
      if (!this.browser || !this.isInitialized) {
        await this.initialize();
      }

      if (!this.browser) {
        return { success: false, data: [], error: 'Browser not initialized' };
      }

      console.log(`🔍 Scraping Muscat Airport transportation page: ${url}`);
      
      const page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the page content
      const html = await page.content();
      await page.close();

      // Parse with Cheerio
      const $ = cheerio.load(html);
      const scrapedData: ScrapedContent[] = [];

      // Extract access road and directions information
      this.extractAccessRoadInfo($, scrapedData, url);
      
      // Extract parking information
      this.extractParkingInfo($, scrapedData, url);
      
      // Extract taxi information
      this.extractTaxiInfo($, scrapedData, url);
      
      // Extract car rental information
      this.extractCarRentalInfo($, scrapedData, url);
      
      // Extract shuttle bus information
      this.extractShuttleBusInfo($, scrapedData, url);
      
      // Extract general transportation info
      this.extractGeneralTransportInfo($, scrapedData, url);

      console.log(`📄 Successfully scraped ${scrapedData.length} sections from Muscat Airport`);
      
      return {
        success: true,
        data: scrapedData
      };

    } catch (error) {
      console.error('Error scraping Muscat Airport:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractAccessRoadInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    // Extract access road and directions information
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('access road') || headingText.includes('directions') || 
          headingText.includes('the map') || headingText.includes('access') ||
          headingText.includes('route') || headingText.includes('highway')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          scrapedData.push(this.createScrapedContent(
            'Access Road and Directions',
            content,
            url,
            0.95,
            'access_road'
          ));
        }
      }
    });

    // Also look for content mentioning Sultan Qaboos Highway
    $('p, div').each((_, element) => {
      const text = $(element).text();
      if (text.toLowerCase().includes('sultan qaboos') && 
          (text.toLowerCase().includes('highway') || text.toLowerCase().includes('road'))) {
        const content = this.cleanText(text);
        if (content.length > 50) { // Only include substantial content
          scrapedData.push(this.createScrapedContent(
            'Sultan Qaboos Highway Directions',
            content,
            url,
            0.9,
            'directions'
          ));
        }
      }
    });

    // Look for specific direction sections (From Muscat, From Seeb, etc.)
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('from muscat') || headingText.includes('from seeb') || 
          headingText.includes('from other parts') || headingText.includes('directions')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          const title = $(element).text().trim() || 'Directions';
          scrapedData.push(this.createScrapedContent(
            title,
            content,
            url,
            0.92,
            'directions'
          ));
        }
      }
    });
  }

  private extractParkingInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    // Extract parking section
    const parkingSection = $('#parking, .parking, [id*="parking"], [class*="parking"]').first();
    
    if (parkingSection.length === 0) {
      // Try to find parking info by heading text
      $('h1, h2, h3, h4, h5, h6').each((_, element) => {
        const headingText = $(element).text().toLowerCase();
        if (headingText.includes('parking') || headingText.includes('car parking')) {
          const content = this.extractContentAfterHeading($, element);
          if (content.trim()) {
            scrapedData.push(this.createScrapedContent(
              'Car Parking Information',
              content,
              url,
              0.9,
              'parking'
            ));
          }
        }
      });
    } else {
      const content = this.cleanText(parkingSection.text());
      if (content) {
        scrapedData.push(this.createScrapedContent(
          'Car Parking Information',
          content,
          url,
          0.9,
          'parking'
        ));
      }
    }

    // Extract parking tables specifically
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase();
      if (tableText.includes('parking') && (tableText.includes('omr') || tableText.includes('tariff'))) {
        const tableContent = this.extractTableData($, table);
        if (tableContent) {
          scrapedData.push(this.createScrapedContent(
            'Parking Rates and Tariffs',
            tableContent,
            url,
            0.95,
            'parking'
          ));
        }
      }
    });
  }

  private extractTaxiInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('taxi')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          scrapedData.push(this.createScrapedContent(
            'Taxi Services',
            content,
            url,
            0.9,
            'taxi'
          ));
        }
      }
    });
  }

  private extractCarRentalInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('car rental') || headingText.includes('rental')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          scrapedData.push(this.createScrapedContent(
            'Car Rental Services',
            content,
            url,
            0.85,
            'car_rental'
          ));
        }
      }
    });

    // Extract car rental companies table
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase();
      if (tableText.includes('company') && (tableText.includes('contact') || tableText.includes('phone'))) {
        const tableContent = this.extractTableData($, table);
        if (tableContent) {
          scrapedData.push(this.createScrapedContent(
            'Car Rental Companies',
            tableContent,
            url,
            0.9,
            'car_rental'
          ));
        }
      }
    });
  }

  private extractShuttleBusInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('shuttle') || headingText.includes('bus')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          scrapedData.push(this.createScrapedContent(
            'Shuttle Bus Services',
            content,
            url,
            0.85,
            'shuttle'
          ));
        }
      }
    });
  }

  private extractGeneralTransportInfo($: cheerio.CheerioAPI, scrapedData: ScrapedContent[], url: string) {
    // Extract pick-up and drop-off information
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      if (headingText.includes('pick up') || headingText.includes('drop-off') || headingText.includes('drop off')) {
        const content = this.extractContentAfterHeading($, element);
        if (content.trim()) {
          scrapedData.push(this.createScrapedContent(
            'Pick-up and Drop-off Information',
            content,
            url,
            0.8,
            'pickup_dropoff'
          ));
        }
      }
    });
  }

  private createScrapedContent(title: string, content: string, url: string, relevance: number, category: string): ScrapedContent {
    return {
      title,
      content,
      url,
      relevance,
      category,
      source: 'Muscat Airport',
      language: 'en',
      lastUpdated: new Date(),
      contentHash: this.generateContentHash(content)
    };
  }

  private extractContentAfterHeading($: cheerio.CheerioAPI, heading: any): string {
    const $heading = $(heading);
    let content = '';
    
    // Get the next few siblings until we hit another heading
    let current = $heading.next();
    while (current.length > 0 && !current.is('h1, h2, h3, h4, h5, h6')) {
      const text = current.text().trim();
      if (text) {
        content += text + '\n\n';
      }
      current = current.next();
    }
    
    return this.cleanText(content);
  }

  private extractTableData($: cheerio.CheerioAPI, table: any): string {
    const $table = $(table);
    let tableContent = '';
    
    $table.find('tr').each((_, row) => {
      const $row = $(row);
      const cells: string[] = [];
      
      $row.find('td, th').each((_, cell) => {
        const cellText = $(cell).text().trim();
        if (cellText) {
          cells.push(cellText);
        }
      });
      
      if (cells.length > 0) {
        tableContent += cells.join(' | ') + '\n';
      }
    });
    
    return this.cleanText(tableContent);
  }

  async searchForQuery(query: string): Promise<ScrapedContent[]> {
    const result = await this.scrapeMuscatAirportTransportation();
    
    if (!result.success) {
      console.log('❌ Failed to scrape content');
      return [];
    }

    const queryLower = query.toLowerCase();
    const relevantContent: ScrapedContent[] = [];

    // Filter content based on query relevance
    for (const item of result.data) {
      const relevance = this.calculateQueryRelevance(item.content, queryLower);
      if (relevance > 0.3) {
        relevantContent.push({
          ...item,
          relevance: relevance
        });
      }
    }

    // Sort by relevance
    relevantContent.sort((a, b) => b.relevance - a.relevance);

    console.log(`📄 Found ${relevantContent.length} relevant results for query: "${query}"`);
    
    return relevantContent.slice(0, 5); // Return top 5 most relevant
  }

  private extractParkingRates($: cheerio.CheerioAPI): Array<{title: string, content: string}> {
    const parkingData: Array<{title: string, content: string}> = [];

    // Look for parking rate tables
    $('table, .parking-rates, .tariff-table, [class*="parking"], [class*="tariff"]').each((_, element) => {
      const $element = $(element);
      const elementText = $element.text().toLowerCase();
      
      if (elementText.includes('parking') && (elementText.includes('rate') || elementText.includes('tariff'))) {
        const tableContent = this.extractTableContent($, element);
        if (tableContent) {
          // Parse the table content into structured format
          const structuredContent = this.structureParkingRates(tableContent);
          if (structuredContent) {
            parkingData.push({
              title: 'Parking Rates',
              content: structuredContent
            });
          }
        }
      }
    });

    // Look for parking sections in divs or paragraphs
    $('div, section, p').each((_, element) => {
      const $element = $(element);
      const elementText = $element.text();
      
      if (elementText.toLowerCase().includes('parking') && 
          (elementText.toLowerCase().includes('rate') || elementText.toLowerCase().includes('tariff')) &&
          elementText.length > 100) {
        
        const cleanContent = this.cleanText(elementText);
        const structuredContent = this.structureParkingRates(cleanContent);
        
        if (structuredContent && !parkingData.some(item => item.content === structuredContent)) {
          parkingData.push({
            title: 'Parking Information',
            content: structuredContent
          });
        }
      }
    });

    return parkingData;
  }

  private extractTableContent($: cheerio.CheerioAPI, table: any): string {
    const $table = $(table);
    let content = '';
    
    // Extract table headers
    const headers: string[] = [];
    $table.find('th, thead td').each((_, th) => {
      const headerText = $(th).text().trim();
      if (headerText) {
        headers.push(headerText);
      }
    });
    
    // Extract table rows
    const rows: string[][] = [];
    $table.find('tbody tr, tr').each((_, tr) => {
      const $tr = $(tr);
      // Skip header rows
      if ($tr.find('th').length === 0) {
        const rowData: string[] = [];
        $tr.find('td').each((_, td) => {
          const cellText = $(td).text().trim();
          rowData.push(cellText);
        });
        if (rowData.length > 0 && rowData.some(cell => cell.length > 0)) {
          rows.push(rowData);
        }
      }
    });
    
    // Format table content
    if (headers.length > 0) {
      content += headers.join(' | ') + '\n';
    }
    
    rows.forEach(row => {
      content += row.join(' | ') + '\n';
    });
    
    return content.trim();
  }

  private structureParkingRates(rawContent: string): string {
    // Clean and structure parking rate information
    let content = rawContent.replace(/\s+/g, ' ').trim();
    
    // Structure P1, P2, P3 parking sections
    const sections: string[] = [];
    
    // Look for P1 parking section
    const p1Match = content.match(/(P1[^P]*(?:Short Term|short term)[^P]*?)(?=P[2-9]|$)/i);
    if (p1Match) {
      sections.push(this.formatParkingSection('P1 Short Term Parking', p1Match[1]));
    }
    
    // Look for P2 parking section
    const p2Match = content.match(/(P2[^P]*(?:Short Term|Premium|short term|premium)[^P]*?)(?=P[3-9]|$)/i);
    if (p2Match) {
      sections.push(this.formatParkingSection('P2 Short Term & Premium Parking', p2Match[1]));
    }
    
    // Look for P3 parking section
    const p3Match = content.match(/(P3[^P]*(?:Long Term|long term)[^P]*?)(?=P[4-9]|$)/i);
    if (p3Match) {
      sections.push(this.formatParkingSection('P3 Long Term Parking', p3Match[1]));
    }
    
    // If no P1/P2/P3 sections found, try to extract general parking rates
    if (sections.length === 0) {
      const generalRates = this.extractGeneralParkingRates(content);
      if (generalRates) {
        sections.push(generalRates);
      }
    }
    
    return sections.join('\n\n');
  }

  private formatParkingSection(title: string, content: string): string {
    let formatted = `**${title}:**\n`;
    
    // Extract duration and rate pairs
    const rates = this.extractRatePairs(content);
    
    if (rates.length > 0) {
      rates.forEach(rate => {
        formatted += `• ${rate.duration}: ${rate.rate}\n`;
      });
    } else {
      // Fallback to original content if parsing fails
      formatted += content.replace(/\s+/g, ' ').trim();
    }
    
    return formatted;
  }

  private extractRatePairs(content: string): Array<{duration: string, rate: string}> {
    const rates: Array<{duration: string, rate: string}> = [];
    
    // Common patterns for parking rates
    const patterns = [
      // "0-30 min | OMR 0.600"
      /(\d+[-\s]*\d*\s*(?:min|minutes?|hr|hours?|day|days?))[^\d]*(?:omr|rial)\s*([\d.]+)/gi,
      // "First 30 minutes: OMR 0.600"
      /(first\s+\d+\s+(?:min|minutes?|hr|hours?))[^\d]*(?:omr|rial)\s*([\d.]+)/gi,
      // "30 min-1 Hrs | OMR 1.100"
      /(\d+\s*(?:min|minutes?)\s*[-–]\s*\d+\s*(?:hr|hours?))[^\d]*(?:omr|rial)\s*([\d.]+)/gi,
      // "1-2 Hours | OMR 2.100"
      /(\d+[-–]\d+\s*(?:hr|hours?|day|days?))[^\d]*(?:omr|rial)\s*([\d.]+)/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const duration = match[1].trim();
        const rate = `OMR ${match[2]}`;
        
        // Avoid duplicates
        if (!rates.some(r => r.duration.toLowerCase() === duration.toLowerCase())) {
          rates.push({ duration, rate });
        }
      }
    });
    
    return rates;
  }

  private extractGeneralParkingRates(content: string): string | null {
    // Extract any parking rate information even if not in P1/P2/P3 format
    const rateMatches = content.match(/(?:parking|rate|tariff).*?(?:omr|rial)\s*[\d.]+/gi);
    
    if (rateMatches && rateMatches.length > 0) {
      return `**Parking Rates:**\n${rateMatches.join('\n')}`;
    }
    
    return null;
  }
} 