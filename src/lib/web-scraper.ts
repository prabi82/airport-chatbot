// Web Scraper Service for Oman Airports Chatbot
// Extracts content from websites and converts to knowledge base format

import { prisma } from './database';

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  headings: string[];
  links: Array<{ text: string; url: string }>;
  lastScraped: Date;
}

interface KnowledgeEntry {
  question: string;
  answer: string;
  category: string;
  subcategory?: string;
  keywords: string[];
  sourceUrl: string;
  priority: number;
}

export class WebScraperService {
  private static instance: WebScraperService;
  
  static getInstance(): WebScraperService {
    if (!WebScraperService.instance) {
      WebScraperService.instance = new WebScraperService();
    }
    return WebScraperService.instance;
  }

  // Main scraping method using fetch (no external dependencies)
  async scrapeWebsite(url: string): Promise<ScrapedContent | null> {
    try {
      console.log(`🕷️ Scraping website: ${url}`);
      
      // Validate URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid URL protocol');
      }

      // Fetch the webpage
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OmanAirportsBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Parse HTML content
      const content = this.parseHTML(html);
      
      const scrapedData: ScrapedContent = {
        url,
        title: content.title,
        content: content.text,
        headings: content.headings,
        links: content.links,
        lastScraped: new Date()
      };

      // Cache the scraped content
      await this.cacheScrapedContent(scrapedData);
      
      console.log(`✅ Successfully scraped: ${url}`);
      return scrapedData;
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error);
      return null;
    }
  }

  // Parse HTML content without external libraries
  private parseHTML(html: string): { title: string; text: string; headings: string[]; links: Array<{ text: string; url: string }> } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');

    // Extract headings
    const headings: string[] = [];
    const headingMatches = cleanHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
    if (headingMatches) {
      headingMatches.forEach(match => {
        const textMatch = match.match(/>([^<]+)</);
        if (textMatch) {
          headings.push(textMatch[1].trim());
        }
      });
    }

    // Extract links
    const links: Array<{ text: string; url: string }> = [];
    const linkMatches = cleanHtml.match(/<a[^>]*href=[\"']([^\"']+)[\"'][^>]*>([^<]+)<\/a>/gi);
    if (linkMatches) {
      linkMatches.forEach(match => {
        const hrefMatch = match.match(/href=[\"']([^\"']+)[\"']/i);
        const textMatch = match.match(/>([^<]+)</);
        if (hrefMatch && textMatch) {
          links.push({
            url: hrefMatch[1],
            text: textMatch[1].trim()
          });
        }
      });
    }

    // Extract text content
    let text = cleanHtml.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove common noise
    text = text.replace(/\b(cookie|privacy|terms|conditions|subscribe|newsletter)\b/gi, '');
    
    return { title, text, headings, links };
  }

  // Convert scraped content to knowledge base entries
  async convertToKnowledgeEntries(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
    const entries: KnowledgeEntry[] = [];
    
    try {
      // Create entries from headings and content sections
      const contentSections = this.extractContentSections(scrapedContent);
      
      for (const section of contentSections) {
        if (section.question && section.answer) {
          // Determine category for each section individually
          const sectionCategory = this.determineSectionCategory(
            section.question, 
            section.answer, 
            scrapedContent.url
          );
          
          entries.push({
            question: section.question,
            answer: section.answer,
            category: sectionCategory,
            subcategory: section.subcategory,
            keywords: this.extractKeywords(section.question + ' ' + section.answer),
            sourceUrl: scrapedContent.url,
            priority: this.calculatePriority(section.question, section.answer)
          });
        }
      }

      // If no structured sections found, create general entries
      if (entries.length === 0) {
        const generalCategory = this.determineCategory(scrapedContent.url, scrapedContent.content);
        entries.push({
          question: `What information is available about ${scrapedContent.title}?`,
          answer: this.summarizeContent(scrapedContent.content),
          category: generalCategory,
          keywords: this.extractKeywords(scrapedContent.title + ' ' + scrapedContent.content),
          sourceUrl: scrapedContent.url,
          priority: 1
        });
      }

      return entries;
      
    } catch (error) {
      console.error('Error converting to knowledge entries:', error);
      return [];
    }
  }

  // Determine category for individual sections
  private determineSectionCategory(question: string, answer: string, url: string): string {
    const urlLower = url.toLowerCase();
    const contentLower = (question + ' ' + answer).toLowerCase();

    // Check for dining/restaurants first (most specific for new content)
    if (urlLower.includes('restaurant') || urlLower.includes('dining') || urlLower.includes('food') || 
        urlLower.includes('cafe') || urlLower.includes('quick-bites') ||
        contentLower.includes('restaurant') || contentLower.includes('cafe') || 
        contentLower.includes('coffee') || contentLower.includes('food') || 
        contentLower.includes('dining') || contentLower.includes('menu') || 
        contentLower.includes('beverage') || contentLower.includes('meal') ||
        contentLower.includes('caffè') || contentLower.includes('mcdonald') || 
        contentLower.includes('kfc') || contentLower.includes('tim hortons') ||
        contentLower.includes('baked goods') || contentLower.includes('pizza') ||
        contentLower.includes('burger') || contentLower.includes('sandwich')) {
      return 'dining';
    }

    // Check for shopping/retail
    if (urlLower.includes('shop') || urlLower.includes('duty-free') || urlLower.includes('retail') ||
        contentLower.includes('shopping') || contentLower.includes('duty free') || 
        contentLower.includes('retail') || contentLower.includes('store') ||
        contentLower.includes('souvenir') || contentLower.includes('brand') ||
        contentLower.includes('outlet') || contentLower.includes('bargain')) {
      return 'shopping';
    }

    // Check for parking (most specific)
    if (urlLower.includes('parking') || urlLower.includes('park') || 
        contentLower.includes('parking rates') || contentLower.includes('car park') || 
        contentLower.includes('parking zones') || contentLower.includes('parking fee') ||
        contentLower.includes('short-term parking') || contentLower.includes('long-term parking')) {
      return 'parking';
    }

    // Check for transportation (more specific than flights)
    if (urlLower.includes('transport') || urlLower.includes('taxi') || urlLower.includes('bus') || 
        urlLower.includes('to-from') || urlLower.includes('transfer') || urlLower.includes('car-rental') ||
        contentLower.includes('taxi service') || contentLower.includes('bus service') || 
        contentLower.includes('shuttle') || contentLower.includes('transport service') ||
        contentLower.includes('car rental') || contentLower.includes('ride sharing') ||
        contentLower.includes('pick up') || contentLower.includes('drop off') ||
        contentLower.includes('taxi') || contentLower.includes('shuttle bus')) {
      return 'transportation';
    }

    // Check for security and baggage
    if (urlLower.includes('security') || urlLower.includes('baggage') ||
        contentLower.includes('security check') || contentLower.includes('baggage claim') || 
        contentLower.includes('customs') || contentLower.includes('immigration') ||
        contentLower.includes('x-ray') || contentLower.includes('screening')) {
      return 'security';
    }

    // Check for lounges and premium services
    if (urlLower.includes('lounge') || contentLower.includes('lounge') || 
        contentLower.includes('primeclass') || contentLower.includes('premium service') ||
        contentLower.includes('business lounge') || contentLower.includes('vip') ||
        contentLower.includes('majan lounge')) {
      return 'lounges';
    }

    // Check for medical and health services
    if (urlLower.includes('medical') || urlLower.includes('health') ||
        contentLower.includes('medical service') || contentLower.includes('first aid') || 
        contentLower.includes('pharmacy') || contentLower.includes('doctor') ||
        contentLower.includes('health') || contentLower.includes('spa') ||
        contentLower.includes('be relax')) {
      return 'health';
    }

    // Check for flights (use more specific terms to avoid false positives)
    if (urlLower.includes('flight') || urlLower.includes('airline') || urlLower.includes('departure') ||
        urlLower.includes('arrival') || contentLower.includes('flight schedule') || 
        contentLower.includes('flight information') || contentLower.includes('check-in') || 
        contentLower.includes('boarding') || contentLower.includes('gate information') || 
        contentLower.includes('flight status') || contentLower.includes('airline') ||
        contentLower.includes('terminal gate') || contentLower.includes('departure gate')) {
      return 'flights';
    }

    // Check for general services
    if (urlLower.includes('service') || urlLower.includes('facility') ||
        contentLower.includes('service') || contentLower.includes('facility') ||
        contentLower.includes('assistance') || contentLower.includes('help desk') ||
        contentLower.includes('information desk') || contentLower.includes('tourist information')) {
      return 'services';
    }

    // Check for amenities (catch-all for comfort services)
    if (urlLower.includes('amenity') || urlLower.includes('comfort') ||
        contentLower.includes('amenity') || contentLower.includes('comfort') ||
        contentLower.includes('wi-fi') || contentLower.includes('wifi') ||
        contentLower.includes('charging') || contentLower.includes('rest area') ||
        contentLower.includes('prayer room') || contentLower.includes('children')) {
      return 'amenities';
    }

    // Check for banking and financial services
    if (urlLower.includes('bank') || urlLower.includes('currency') || urlLower.includes('exchange') ||
        contentLower.includes('banking') || contentLower.includes('currency exchange') || 
        contentLower.includes('atm') || contentLower.includes('money exchange') ||
        contentLower.includes('financial service')) {
      return 'banking';
    }

    // Auto-detect new categories based on URL patterns
    const urlParts = urlLower.split('/').filter(part => part.length > 2);
    const lastUrlPart = urlParts[urlParts.length - 1];
    
    // If URL contains a specific category indicator, use it
    if (lastUrlPart && lastUrlPart !== 'content' && lastUrlPart !== 'en') {
      // Clean up the URL part to make it a proper category
      const potentialCategory = lastUrlPart.replace(/-/g, ' ').replace(/_/g, ' ');
      
      // Only create new category if it's not already covered
      if (!['flight', 'transport', 'park', 'service', 'shop', 'dine'].some(existing => 
           potentialCategory.includes(existing) || existing.includes(potentialCategory))) {
        return potentialCategory;
      }
    }

    // Fall back to page-level category determination
    return this.determineCategory(url, answer);
  }

  // Determine category based on URL and content
  private determineCategory(url: string, content: string): string {
    const urlLower = url.toLowerCase();
    const contentLower = content.toLowerCase();

    // Check for dining/restaurants first
    if (urlLower.includes('restaurant') || urlLower.includes('dining') || urlLower.includes('food') || 
        urlLower.includes('cafe') || urlLower.includes('quick-bites') ||
        contentLower.includes('restaurant') || contentLower.includes('cafe') || 
        contentLower.includes('coffee') || contentLower.includes('dining') || 
        contentLower.includes('menu') || contentLower.includes('meal')) {
      return 'dining';
    }

    // Check for parking first (most specific)
    if (urlLower.includes('parking') || urlLower.includes('park') || 
        contentLower.includes('parking rates') || contentLower.includes('car park') || 
        contentLower.includes('parking zones') || contentLower.includes('parking fee')) {
      return 'parking';
    }

    // Check for transportation (more specific than flights)
    if (urlLower.includes('transport') || urlLower.includes('taxi') || urlLower.includes('bus') || 
        urlLower.includes('to-from') || urlLower.includes('transfer') ||
        contentLower.includes('taxi service') || contentLower.includes('bus service') || 
        contentLower.includes('shuttle') || contentLower.includes('transport service') ||
        contentLower.includes('car rental') || contentLower.includes('ride sharing')) {
      return 'transportation';
    }

    // Check for flights (use more specific terms)
    if (urlLower.includes('flight') || urlLower.includes('airline') || 
        contentLower.includes('flight schedule') || contentLower.includes('flight information') || 
        contentLower.includes('check-in') || contentLower.includes('boarding') ||
        contentLower.includes('gate information') || contentLower.includes('flight status')) {
      return 'flights';
    }

    // Check for general departures/arrivals (could be flights or transport)
    if (contentLower.includes('departure') || contentLower.includes('arrival')) {
      // If it mentions specific transport, categorize as transportation
      if (contentLower.includes('taxi departure') || contentLower.includes('bus departure') ||
          contentLower.includes('pick up') || contentLower.includes('drop off')) {
        return 'transportation';
      }
      // Otherwise, likely flights
      return 'flights';
    }

    // Check for services
    if (urlLower.includes('service') || urlLower.includes('facility') ||
        contentLower.includes('service') || contentLower.includes('facility') ||
        contentLower.includes('assistance') || contentLower.includes('help desk')) {
      return 'services';
    }

    // Check for amenities
    if (urlLower.includes('shop') || urlLower.includes('dining') || urlLower.includes('restaurant') ||
        contentLower.includes('shopping') || contentLower.includes('restaurant') || 
        contentLower.includes('cafe') || contentLower.includes('duty free')) {
      return 'amenities';
    }

    // Check for security
    if (urlLower.includes('security') || contentLower.includes('security') || 
        contentLower.includes('baggage') || contentLower.includes('customs')) {
      return 'security';
    }
    
    return 'general';
  }

  // Extract content sections from scraped data
  private extractContentSections(scrapedContent: ScrapedContent): Array<{ question: string; answer: string; subcategory?: string }> {
    const sections: Array<{ question: string; answer: string; subcategory?: string }> = [];
    
    // Use headings as questions
    scrapedContent.headings.forEach(heading => {
      if (heading.length > 10 && heading.length < 200) {
        // Find content after this heading
        const headingIndex = scrapedContent.content.indexOf(heading);
        if (headingIndex !== -1) {
          const nextHeadingIndex = scrapedContent.headings.findIndex((h, i) => 
            i > scrapedContent.headings.indexOf(heading) && scrapedContent.content.indexOf(h) > headingIndex
          );
          
          const endIndex = nextHeadingIndex !== -1 
            ? scrapedContent.content.indexOf(scrapedContent.headings[nextHeadingIndex])
            : headingIndex + 500;
          
          const answer = scrapedContent.content.substring(headingIndex + heading.length, endIndex).trim();
          
          if (answer.length > 20) {
            sections.push({
              question: this.formatAsQuestion(heading),
              answer: this.cleanAnswer(answer),
              subcategory: this.extractSubcategory(heading)
            });
          }
        }
      }
    });

    return sections;
  }

  // Format heading as question
  private formatAsQuestion(heading: string): string {
    heading = heading.trim();
    
    // If already a question, return as is
    if (heading.endsWith('?')) {
      return heading;
    }
    
    // Convert to question format
    const questionWords = ['what', 'how', 'when', 'where', 'who', 'why'];
    const lowerHeading = heading.toLowerCase();
    
    if (lowerHeading.includes('time') || lowerHeading.includes('hour')) {
      return `What are the ${heading.toLowerCase()}?`;
    }
    if (lowerHeading.includes('location') || lowerHeading.includes('where')) {
      return `Where is ${heading.toLowerCase()}?`;
    }
    if (lowerHeading.includes('cost') || lowerHeading.includes('price') || lowerHeading.includes('fee')) {
      return `What is the ${heading.toLowerCase()}?`;
    }
    if (lowerHeading.includes('how to') || lowerHeading.includes('process')) {
      return `How do I ${heading.toLowerCase()}?`;
    }
    
    return `What is ${heading}?`;
  }

  // Extract keywords from text
  private extractKeywords(text: string): string[] {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));
    
    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    // Return top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // Calculate priority based on content relevance
  private calculatePriority(question: string, answer: string): number {
    const importantKeywords = ['flight', 'departure', 'arrival', 'gate', 'terminal', 'parking', 'taxi', 'bus', 'security', 'baggage', 'check-in'];
    const text = (question + ' ' + answer).toLowerCase();
    
    let priority = 1;
    importantKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        priority += 1;
      }
    });
    
    return Math.min(priority, 5);
  }

  // Helper methods
  private extractSubcategory(heading: string): string | undefined {
    const lowerHeading = heading.toLowerCase();
    
    if (lowerHeading.includes('domestic')) return 'domestic';
    if (lowerHeading.includes('international')) return 'international';
    if (lowerHeading.includes('arrival')) return 'arrivals';
    if (lowerHeading.includes('departure')) return 'departures';
    if (lowerHeading.includes('terminal')) return 'terminal';
    if (lowerHeading.includes('gate')) return 'gates';
    
    return undefined;
  }

  private cleanAnswer(answer: string): string {
    return answer
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit length
  }

  private summarizeContent(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ') + '.';
  }

  // Cache scraped content in database
  private async cacheScrapedContent(content: ScrapedContent): Promise<void> {
    try {
      await prisma.scrapingCache.upsert({
        where: { url: content.url },
        update: {
          title: content.title,
          content: content.content,
          headings: content.headings,
          links: content.links,
          lastScraped: content.lastScraped
        },
        create: {
          url: content.url,
          title: content.title,
          content: content.content,
          headings: content.headings,
          links: content.links,
          lastScraped: content.lastScraped
        }
      });
    } catch (error) {
      console.warn('Failed to cache scraped content:', error);
    }
  }

  // Save knowledge entries to database
  async saveKnowledgeEntries(entries: KnowledgeEntry[]): Promise<number> {
    let savedCount = 0;
    
    for (const entry of entries) {
      try {
        await prisma.knowledgeBase.create({
          data: {
            category: entry.category,
            subcategory: entry.subcategory,
            question: entry.question,
            answer: entry.answer,
            keywords: entry.keywords,
            sourceUrl: entry.sourceUrl,
            priority: entry.priority
          }
        });
        savedCount++;
      } catch (error) {
        console.warn('Failed to save knowledge entry:', error);
      }
    }
    
    return savedCount;
  }

  // Main method to scrape and process a website
  async scrapeAndProcess(url: string): Promise<{ success: boolean; entriesCreated: number; error?: string }> {
    try {
      // Scrape the website
      const scrapedContent = await this.scrapeWebsite(url);
      if (!scrapedContent) {
        return { success: false, entriesCreated: 0, error: 'Failed to scrape website' };
      }

      // Convert to knowledge entries
      const entries = await this.convertToKnowledgeEntries(scrapedContent);
      if (entries.length === 0) {
        return { success: false, entriesCreated: 0, error: 'No useful content found' };
      }

      // Save to database
      const savedCount = await this.saveKnowledgeEntries(entries);
      
      return { success: true, entriesCreated: savedCount };
      
    } catch (error) {
      return { 
        success: false, 
        entriesCreated: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const webScraperService = WebScraperService.getInstance(); 