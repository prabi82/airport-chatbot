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

  // Convert scraped content to knowledge base entries using AI
  async convertToKnowledgeEntries(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
    const entries: KnowledgeEntry[] = [];
    
    try {
      console.log('🤖 Using Gemini AI to create comprehensive knowledge base entries...');
      
      // Use AI to generate customer-focused Q&A pairs
      const aiGeneratedEntries = await this.generateAIKnowledgeEntries(scrapedContent);
      
      if (aiGeneratedEntries.length > 0) {
        entries.push(...aiGeneratedEntries);
        console.log(`✅ Generated ${aiGeneratedEntries.length} AI-powered knowledge entries`);
      } else {
        console.log('⚠️ AI generation failed, falling back to basic extraction...');
        // Fallback to original method if AI fails
        const basicEntries = await this.convertToBasicKnowledgeEntries(scrapedContent);
        entries.push(...basicEntries);
      }

      return entries;
      
    } catch (error) {
      console.error('Error converting to knowledge entries:', error);
      // Fallback to basic extraction
      const basicEntries = await this.convertToBasicKnowledgeEntries(scrapedContent);
      return basicEntries;
    }
  }

  // AI-powered knowledge entry generation
  private async generateAIKnowledgeEntries(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
    try {
      // Check if Gemini API is available
      if (!process.env.GEMINI_API_KEY) {
        console.log('❌ Gemini API key not found, skipping AI generation');
        return [];
      }

      // For comprehensive pages, use sectioned approach
      if (this.shouldUseSectionedApproach(scrapedContent)) {
        console.log('📚 Using sectioned approach for comprehensive content...');
        return this.generateSectionedKnowledgeEntries(scrapedContent);
      }
      
      // Standard single-pass approach for smaller content
      const cleanContent = this.prepareContentForAI(scrapedContent);
      const prompt = this.createKnowledgeGenerationPrompt(cleanContent, scrapedContent.url);
      const aiResponse = await this.callGeminiForKnowledgeGeneration(prompt);
      
      if (aiResponse) {
        const parsedEntries = this.parseAIResponse(aiResponse, scrapedContent.url);
        return parsedEntries;
      }
      
      return [];
      
    } catch (error) {
      console.error('Error in AI knowledge generation:', error);
      return [];
    }
  }

  // Determine if we should use sectioned approach for comprehensive coverage
  private shouldUseSectionedApproach(scrapedContent: ScrapedContent): boolean {
    const contentLength = scrapedContent.content.length;
    const wordCount = scrapedContent.content.split(/\s+/).length;
    const sectionCount = (scrapedContent.content.match(/###|##|#/g) || []).length;
    const headingCount = scrapedContent.headings.length;
    
    // Detect simple service pages that should NEVER use sectioned approach
    const contentLower = scrapedContent.content.toLowerCase();
    const isSimpleServicePage = contentLower.includes('spa') || 
                               contentLower.includes('relax') ||
                               contentLower.includes('massage') ||
                               contentLower.includes('lounge') ||
                               contentLower.includes('medical') ||
                               contentLower.includes('currency exchange') ||
                               contentLower.includes('baggage') ||
                               contentLower.includes('wifi') ||
                               contentLower.includes('lost property') ||
                               (contentLower.includes('duty free') && contentLength < 3000);
    
    // Enhanced analysis for comprehensive content with more realistic thresholds
    const isToFromPage = scrapedContent.url.includes('to-from');
    const isComprehensivePage = scrapedContent.url.includes('airport-experience') || 
                               scrapedContent.url.includes('shop-dine') ||
                               scrapedContent.url.includes('facilities') ||
                               scrapedContent.url.includes('transport');
    
    // Never use sectioned approach for simple service pages
    if (isSimpleServicePage) {
      console.log(`📊 Simple Service Page Detected - Using SINGLE-PASS approach`);
      return false;
    }
    
    // More realistic thresholds - don't overprocess simple pages
    const shouldSection = isToFromPage || isComprehensivePage || 
                         (contentLength > 10000 && wordCount > 1500) || 
                         (sectionCount > 8 && contentLength > 6000) || 
                         (headingCount > 10 && contentLength > 5000);
    
    console.log(`📊 Intelligent Content Analysis: 
    - Length: ${contentLength} chars
    - Words: ${wordCount}
    - Sections: ${sectionCount}
    - Headings: ${headingCount}
    - Is Simple Service Page: ${isSimpleServicePage}
    - Is To/From Page: ${isToFromPage}
    - Is Comprehensive: ${isComprehensivePage}
    - Decision: ${shouldSection ? 'SECTIONED APPROACH (Comprehensive)' : 'SINGLE-PASS (Focused)'}`);
    
    return shouldSection;
  }

  // Enhanced sectioned approach with deeper analysis
  private async generateSectionedKnowledgeEntries(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
    const allEntries: KnowledgeEntry[] = [];
    
    try {
      // Enhanced section splitting with better content analysis
      const sections = this.splitContentIntoSections(scrapedContent);
      console.log(`📝 Processing ${sections.length} content sections with intelligent analysis...`);
      
      // Process each section with intelligent entry count calculation
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        console.log(`🔄 Processing section ${i + 1}/${sections.length}: ${section.title}`);
        
        // Analyze section complexity for targeted entry generation
        const sectionAnalysis = this.analyzeSectionComplexity(section);
        console.log(`  📊 Section Analysis: ${sectionAnalysis.targetEntries} entries needed (${sectionAnalysis.complexity} complexity)`);
        
        // Skip sections with very little content
        if (sectionAnalysis.targetEntries < 2 && section.content.length < 200) {
          console.log(`  ⏭️ Skipping minimal section "${section.title}" (insufficient content)`);
          continue;
        }
        
        // Create enhanced focused prompt for this section
        const sectionPrompt = this.createEnhancedSectionPrompt(section, scrapedContent.url, sectionAnalysis);
        const aiResponse = await this.callGeminiForKnowledgeGeneration(sectionPrompt);
        
        if (aiResponse) {
          const sectionEntries = this.parseAIResponse(aiResponse, scrapedContent.url);
          if (sectionEntries.length > 0) {
            allEntries.push(...sectionEntries);
            console.log(`  ✅ Generated ${sectionEntries.length} entries for section "${section.title}"`);
          } else {
            console.log(`  ⚠️ No entries generated for section "${section.title}"`);
          }
        } else {
          console.log(`  ❌ AI generation failed for section "${section.title}"`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`🎉 Total entries generated: ${allEntries.length} across ${sections.length} sections`);
      
      // Only use fallback for genuinely large/comprehensive pages
      if (allEntries.length < 8 && scrapedContent.content.length > 15000 && scrapedContent.url.includes('to-from')) {
        console.log(`🔄 Comprehensive page with fewer entries than expected (${allEntries.length}), trying targeted fallback...`);
        const fallbackEntries = await this.generateComprehensiveFallback(scrapedContent);
        allEntries.push(...fallbackEntries);
        console.log(`📈 Added ${fallbackEntries.length} fallback entries, total: ${allEntries.length}`);
      }
      
      return allEntries;
      
    } catch (error) {
      console.error('❌ Error in enhanced sectioned generation:', error);
      // Fallback to standard approach
      const cleanContent = this.prepareContentForAI(scrapedContent);
      const prompt = this.createKnowledgeGenerationPrompt(cleanContent, scrapedContent.url);
      const aiResponse = await this.callGeminiForKnowledgeGeneration(prompt);
      
      if (aiResponse) {
        return this.parseAIResponse(aiResponse, scrapedContent.url);
      }
      return [];
    }
  }

  // Analyze section complexity to determine appropriate number of entries
  private analyzeSectionComplexity(section: {title: string; content: string}): {
    complexity: 'low' | 'medium' | 'high' | 'very-high';
    targetEntries: number;
    hasDetails: boolean;
    hasPricing: boolean;
    hasProcedures: boolean;
  } {
    const content = section.content.toLowerCase();
    const contentLength = section.content.length;
    const wordCount = section.content.split(/\s+/).length;
    
    // Detect content types
    const hasPricing = /\$|€|£|omr|rial|price|cost|fee|tariff|charge/.test(content);
    const hasProcedures = /step|procedure|process|how to|follow|instruction/.test(content);
    const hasContact = /phone|email|contact|call|\+\d+/.test(content);
    const hasTables = (section.content.match(/\|.*\|/g) || []).length > 0;
    const hasLists = (section.content.match(/^\s*[\-\*\+•]/gm) || []).length > 2;
    const hasDetails = hasPricing || hasProcedures || hasContact || hasTables || hasLists;
    
    // Much more conservative base calculation
    let targetEntries = 1; // Very low minimum
    
    // Content length factor (very conservative scaling)
    if (contentLength > 4000) targetEntries += 4;
    else if (contentLength > 2000) targetEntries += 3;
    else if (contentLength > 1000) targetEntries += 2;
    else if (contentLength > 500) targetEntries += 1;
    else if (contentLength > 200) targetEntries += 1;
    
    // Word count factor (conservative)
    if (wordCount > 600) targetEntries += 2;
    else if (wordCount > 300) targetEntries += 1;
    else if (wordCount > 150) targetEntries += 1;
    
    // Content type bonuses (very conservative)
    if (hasPricing) targetEntries += 2; // Pricing deserves multiple Q&As
    if (hasProcedures) targetEntries += 2; // Procedures need step-by-step coverage
    if (hasContact) targetEntries += 1; // Contact info deserves separate entry
    if (hasTables) targetEntries += 1; // Tables contain structured data
    if (hasLists) targetEntries += 1; // Lists indicate multiple items/options
    
    // Specific section type bonuses (conservative)
    const sectionTitle = section.title.toLowerCase();
    if (sectionTitle.includes('parking') && hasPricing) targetEntries += 2; // Parking with rates
    if (sectionTitle.includes('taxi') && hasPricing) targetEntries += 1; // Taxi with rates
    if (sectionTitle.includes('car rental')) targetEntries += 2; // Car rental companies
    if (sectionTitle.includes('duty free') || sectionTitle.includes('shopping')) {
      // For simple shopping pages like duty-free, be very conservative
      if (contentLength < 800) targetEntries = Math.min(2, targetEntries);
      else targetEntries += 1;
    }
    if (sectionTitle.includes('access') || sectionTitle.includes('direction')) targetEntries += 1; // Directions
    if (sectionTitle.includes('drop-off') || sectionTitle.includes('pick-up')) targetEntries += 2; // Drop-off procedures
    
    // Very conservative caps for simple content
    if (contentLength < 600 && wordCount < 100) {
      targetEntries = Math.min(2, targetEntries); // Very simple sections
    } else if (contentLength < 1200 && wordCount < 200) {
      targetEntries = Math.min(3, targetEntries); // Simple sections
    } else if (contentLength < 2000 && wordCount < 350) {
      targetEntries = Math.min(5, targetEntries); // Medium-simple sections
    }
    
    // Determine complexity level
    let complexity: 'low' | 'medium' | 'high' | 'very-high';
    if (targetEntries >= 8) complexity = 'very-high';
    else if (targetEntries >= 6) complexity = 'high';
    else if (targetEntries >= 4) complexity = 'medium';
    else complexity = 'low';
    
    // Conservative cap on maximum entries per section
    targetEntries = Math.min(10, Math.max(1, targetEntries));
    
    return {
      complexity,
      targetEntries,
      hasDetails,
      hasPricing,
      hasProcedures
    };
  }

  // Create enhanced section prompt with intelligent targeting
  private createEnhancedSectionPrompt(
    section: {title: string; content: string}, 
    url: string, 
    analysis: {complexity: string; targetEntries: number; hasDetails: boolean; hasPricing: boolean; hasProcedures: boolean}
  ): string {
    const category = this.determineCategory(url, section.content);
    
    return `As an expert content analyst for Oman Airports, analyze this specific section and create comprehensive, customer-focused knowledge base entries.

SECTION: ${section.title}
COMPLEXITY: ${analysis.complexity.toUpperCase()}
TARGET ENTRIES: ${analysis.targetEntries}

CONTENT ANALYSIS:
- Has Pricing/Rates: ${analysis.hasPricing ? 'YES' : 'NO'}
- Has Procedures: ${analysis.hasProcedures ? 'YES' : 'NO'}
- Has Detailed Info: ${analysis.hasDetails ? 'YES' : 'NO'}

SECTION CONTENT:
${section.content}

CRITICAL INSTRUCTIONS:
1. Generate EXACTLY ${analysis.targetEntries} specific, detailed question-answer pairs
2. Each question must be unique and cover different aspects of this section
3. Cover ALL major information points in this section comprehensively
4. For pricing tables: Create separate entries for different time periods/categories
5. For procedures: Break down into logical step-by-step questions
6. For contact info: Create specific entries for phone numbers, locations, hours
7. For options/choices: Create separate entries for each major option
8. Questions should be natural and conversational
9. Answers must be specific with exact details (numbers, locations, procedures)
10. Each answer should be 1-4 sentences with immediately useful information

FOCUS AREAS FOR THIS SECTION:
${analysis.hasPricing ? '- Create detailed pricing questions for different scenarios\n' : ''}${analysis.hasProcedures ? '- Break procedures into step-by-step questions\n' : ''}${analysis.hasDetails ? '- Extract all specific details (times, locations, phone numbers)\n' : ''}
- Cover practical traveler concerns about ${section.title}
- Include specific operational details and requirements
- Address common customer pain points for this service

CATEGORY: ${category}
SOURCE: ${url}

FORMAT AS JSON:
{
  "entries": [
    {
      "question": "Specific detailed question about ${section.title}",
      "answer": "Comprehensive answer with specific details from content",
      "category": "${category}",
      "subcategory": "${section.title}",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "priority": 1-5
    }
  ]
}

REMEMBER: Generate ${analysis.targetEntries} entries that thoroughly cover this section's content.`;
  }

  // Comprehensive fallback for cases where sectioned approach didn't generate enough entries
  private async generateComprehensiveFallback(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
    console.log('🔄 Executing comprehensive fallback analysis...');
    
    const comprehensivePrompt = `As an expert content analyst for Oman Airports, this webpage contains extensive information that needs comprehensive coverage. Analyze ALL content and create detailed knowledge base entries.

WEBPAGE: ${scrapedContent.title}
URL: ${scrapedContent.url}

FULL CONTENT:
${scrapedContent.content.substring(0, 8000)}${scrapedContent.content.length > 8000 ? '\n... (content continues)' : ''}

COMPREHENSIVE ANALYSIS REQUIRED:
1. This appears to be comprehensive airport information that needs thorough coverage
2. Generate 20-25 detailed question-answer pairs covering ALL aspects
3. Break down complex information into specific, actionable questions
4. Cover pricing, procedures, locations, contact information, timing, and requirements
5. Create entries for different user scenarios (arriving, departing, picking up, parking, etc.)
6. Each entry should be immediately useful to airport travelers
7. Include specific details like phone numbers, addresses, rates, procedures

FOCUS ON:
- Transportation options (taxi, car rental, bus, parking)
- Detailed pricing for all services
- Step-by-step procedures for different scenarios
- Contact information and locations
- Access routes and directions
- Time limits and restrictions
- Special services and facilities

FORMAT AS JSON with comprehensive entries array.`;

    const aiResponse = await this.callGeminiForKnowledgeGeneration(comprehensivePrompt);
    
    if (aiResponse) {
      const entries = this.parseAIResponse(aiResponse, scrapedContent.url);
      console.log(`📊 Comprehensive fallback generated ${entries.length} additional entries`);
      return entries;
    }
    
    return [];
  }

  // Prepare content for AI processing
  private prepareContentForAI(scrapedContent: ScrapedContent): string {
    let content = `Title: ${scrapedContent.title}\n\n`;
    
    // Add headings as structure
    if (scrapedContent.headings.length > 0) {
      content += `Headings:\n${scrapedContent.headings.join('\n')}\n\n`;
    }
    
    // Add main content (increased limit for comprehensive pages)
    const maxContentLength = 5000; // Increased for better coverage
    let mainContent = scrapedContent.content;
    if (mainContent.length > maxContentLength) {
      mainContent = mainContent.substring(0, maxContentLength) + '...';
    }
    
    content += `Content:\n${mainContent}`;
    
    return content;
  }

  // Split content into logical sections for processing with enhanced detection
  private splitContentIntoSections(scrapedContent: ScrapedContent): Array<{title: string; content: string}> {
    const sections: Array<{title: string; content: string}> = [];
    const lines = scrapedContent.content.split('\n');
    
    let currentSection: {title: string; content: string} | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Enhanced heading detection - more patterns for airport content
      const isHeading = trimmedLine.match(/^#{1,4}\s+(.+)/) || // Markdown headings
                       (trimmedLine.length > 0 && trimmedLine.length < 80 && 
                        (trimmedLine.includes('Access Road') || 
                         trimmedLine.includes('Pick Up') || 
                         trimmedLine.includes('Drop-off') ||
                         trimmedLine.includes('Car Parking') ||
                         trimmedLine.includes('Taxi') ||
                         trimmedLine.includes('Car Rental') ||
                         trimmedLine.includes('Shuttle Bus') ||
                         trimmedLine.includes('Parking Fares') ||
                         trimmedLine.includes('Hotel buses') ||
                         trimmedLine.includes('Public transportation') ||
                         trimmedLine.includes('Driver service') ||
                         trimmedLine.match(/^[A-Z][A-Za-z\s&-]{5,50}$/) && // Title case patterns
                         !trimmedLine.includes('|') && // Not table content
                         !trimmedLine.match(/^\d+/) && // Not starting with numbers
                         !trimmedLine.includes('OMR') && // Not pricing
                         !trimmedLine.includes('€') &&
                         !trimmedLine.includes('$')));
      
      if (isHeading) {
        // Save previous section if exists and has substantial content
        if (currentSection && currentSection.content.trim().length > 150) { // Lower threshold for richer sections
          sections.push(currentSection);
        }
        
        // Start new section
        let title = trimmedLine.replace(/^#+\s*/, '').trim();
        
        // Clean up title
        title = title.replace(/[#*]+/g, '').trim();
        if (title.length > 60) {
          title = title.substring(0, 60) + '...';
        }
        
        currentSection = { title, content: line + '\n' };
      } else if (currentSection) {
        // Add to current section
        currentSection.content += line + '\n';
      } else {
        // Create initial section if no heading found yet
        if (!currentSection) {
          currentSection = { title: 'Overview', content: line + '\n' };
        }
      }
    }
    
    // Add final section
    if (currentSection && currentSection.content.trim().length > 150) {
      sections.push(currentSection);
    }
    
    // If no sections found or very few, use content-based splitting
    if (sections.length <= 1) {
      console.log('📝 Using content-based section splitting for comprehensive coverage...');
      const contentBasedSections = this.createContentBasedSections(scrapedContent);
      sections.push(...contentBasedSections);
    }
    
    // Split large sections to keep manageable sizes but allow for comprehensive coverage
    const finalSections: Array<{title: string; content: string}> = [];
    for (const section of sections) {
      if (section.content.length > 5000) { // Increased threshold for more content per section
        const chunks = this.splitLargeSection(section);
        finalSections.push(...chunks);
      } else {
        finalSections.push(section);
      }
    }
    
    console.log(`📋 Split content into ${finalSections.length} sections: ${finalSections.map(s => s.title).join(', ')}`);
    
    return finalSections;
  }

  // Create content-based sections when structure detection fails
  private createContentBasedSections(scrapedContent: ScrapedContent): Array<{title: string; content: string}> {
    const content = scrapedContent.content;
    const sections: Array<{title: string; content: string}> = [];
    
    // Look for major topic indicators in airport content
    const topicIndicators = [
      { pattern: /(access|direction|route|road|highway)/i, title: 'Access and Directions' },
      { pattern: /(pick.*up|drop.*off|forecourt)/i, title: 'Pick-up and Drop-off' },
      { pattern: /(parking|car park|tariff)/i, title: 'Car Parking' },
      { pattern: /(taxi|cab|fare)/i, title: 'Taxi Services' },
      { pattern: /(car rental|rental car|rent.*car)/i, title: 'Car Rental' },
      { pattern: /(bus|shuttle|transport|mwasalat)/i, title: 'Public Transportation' },
      { pattern: /(contact|phone|support|call)/i, title: 'Contact Information' },
      { pattern: /(facility|service|lounge|amenity)/i, title: 'Airport Facilities' }
    ];
    
    const paragraphs = content.split('\n\n');
    let currentSection: {title: string; content: string} | null = null;
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length < 50) continue; // Skip short paragraphs
      
      // Find best matching topic
      let bestMatch = null;
      for (const indicator of topicIndicators) {
        if (indicator.pattern.test(paragraph)) {
          bestMatch = indicator;
          break;
        }
      }
      
      if (bestMatch && (!currentSection || currentSection.title !== bestMatch.title)) {
        // Save previous section
        if (currentSection && currentSection.content.trim().length > 200) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = { title: bestMatch.title, content: paragraph + '\n\n' };
      } else if (currentSection) {
        // Add to current section
        currentSection.content += paragraph + '\n\n';
      } else {
        // Create general section
        if (!currentSection) {
          currentSection = { title: 'General Information', content: paragraph + '\n\n' };
        }
      }
    }
    
    // Add final section
    if (currentSection && currentSection.content.trim().length > 200) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  // Split large sections into manageable chunks
  private splitLargeSection(section: {title: string; content: string}): Array<{title: string; content: string}> {
    const chunks: Array<{title: string; content: string}> = [];
    const paragraphs = section.content.split('\n\n');
    
    let currentChunk = '';
    let chunkIndex = 1;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > 3500) {
        if (currentChunk.trim()) {
          chunks.push({
            title: `${section.title} (Part ${chunkIndex})`,
            content: currentChunk.trim()
          });
          chunkIndex++;
        }
        currentChunk = paragraph + '\n\n';
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        title: chunkIndex > 1 ? `${section.title} (Part ${chunkIndex})` : section.title,
        content: currentChunk.trim()
      });
    }
    
    return chunks;
  }

  // Create AI prompt for knowledge generation
  private createKnowledgeGenerationPrompt(content: string, url: string): string {
    const category = this.determineCategory(url, content);
    
    // Determine number of entries based on content length and complexity
    const targetEntries = this.calculateOptimalEntryCount(content);
    
    return `As an expert content analyst for Oman Airports, analyze the following webpage content and create comprehensive, customer-focused knowledge base entries.

WEBPAGE CONTENT:
${content}

INSTRUCTIONS:
1. Create ${targetEntries} specific question-answer pairs that customers would realistically ask about this content
2. Cover ALL major sections and subsections of the content thoroughly
3. Questions should be natural, conversational, and specific (not generic)
4. Answers should be comprehensive, helpful, and directly address the question
5. Focus on practical information travelers would need
6. Include specific details like hours, locations, services, prices when available
7. Each answer should be 1-3 sentences and immediately helpful
8. Ensure you cover different aspects: procedures, costs, locations, timing, contact info, etc.

CATEGORY CONTEXT: ${category}
URL SOURCE: ${url}

FORMAT YOUR RESPONSE AS JSON:
{
  "entries": [
    {
      "question": "Specific customer question",
      "answer": "Comprehensive, helpful answer with specific details",
      "category": "${category}",
      "subcategory": "Optional subcategory",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "priority": 1-5
    }
  ]
}

EXAMPLE GOOD QUESTIONS FOR COMPREHENSIVE COVERAGE:
- "What are the parking rates for short-term parking at Muscat Airport?"
- "How much does it cost to use the drop-off area for more than 10 minutes?"
- "Which car rental companies are available at the airport?"
- "What is the contact number for airport taxi services?"
- "How do I get from Muscat city center to the airport by bus?"
- "Are there shuttle services from hotels to the airport?"
- "What are the directions from Seeb to Muscat Airport?"
- "Where is the designated drop-off area for first and business class passengers?"

COVERAGE REQUIREMENTS:
- Address EVERY major section and subsection in the content
- Include specific numerical data (prices, times, contact numbers)
- Cover procedural information (how to access, where to find, what to do)
- Include comparative information (different options available)
- Address location-specific details (which terminal, which area, which level)

Generate responses that are specific, practical, and immediately useful to airport travelers.`;
  }

  // Calculate optimal number of entries based on content characteristics
  private calculateOptimalEntryCount(content: string): number {
    const contentLength = content.length;
    const wordCount = content.split(/\s+/).length;
    const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;
    const sectionCount = (content.match(/###|##|#/g) || []).length;
    const tableCount = (content.match(/\|.*\|/g) || []).length;
    const listCount = (content.match(/^\s*[\-\*\+]\s/gm) || []).length;
    
    // Very conservative base calculation
    let entryCount = 2; // Conservative minimum base
    
    // Content length factor (conservative proportional scaling)
    if (contentLength > 20000) entryCount += 20; // Very comprehensive pages like "to-from"
    else if (contentLength > 15000) entryCount += 15; // Large comprehensive pages
    else if (contentLength > 10000) entryCount += 12; // Medium comprehensive pages
    else if (contentLength > 5000) entryCount += 8; // Medium pages
    else if (contentLength > 2000) entryCount += 4; // Small-medium pages
    else if (contentLength > 1000) entryCount += 2; // Small pages
    else if (contentLength > 500) entryCount += 1; // Very small pages
    
    // Word count factor (conservative quality indicator)
    if (wordCount > 3000) entryCount += 8; // Very detailed content
    else if (wordCount > 2000) entryCount += 6;
    else if (wordCount > 1000) entryCount += 4;
    else if (wordCount > 500) entryCount += 2;
    else if (wordCount > 200) entryCount += 1;
    else if (wordCount > 100) entryCount += 1;
    
    // Structure complexity factor (very conservative)
    if (sectionCount > 20) entryCount += 6; // Many sections
    else if (sectionCount > 15) entryCount += 5;
    else if (sectionCount > 10) entryCount += 3;
    else if (sectionCount > 5) entryCount += 2;
    else if (sectionCount > 2) entryCount += 1;
    
    // Tables and lists indicate detailed information (very conservative bonuses)
    if (tableCount > 10) entryCount += 4; // Extensive tables
    else if (tableCount > 5) entryCount += 3;
    else if (tableCount > 2) entryCount += 2;
    else if (tableCount > 0) entryCount += 1; // Any tables deserve attention
    
    if (listCount > 20) entryCount += 3; // Extensive lists
    else if (listCount > 10) entryCount += 2;
    else if (listCount > 5) entryCount += 1;
    else if (listCount > 2) entryCount += 1;
    
    // Enhanced content type specific bonuses (very conservative)
    const contentLower = content.toLowerCase();
    if (contentLower.includes('parking') && contentLower.includes('tariff')) entryCount += 3; // Parking with rates
    if (contentLower.includes('taxi') && contentLower.includes('fare')) entryCount += 2; // Taxi with rates
    if (contentLower.includes('car rental')) entryCount += 3; // Car rental companies
    if (contentLower.includes('contact') || contentLower.includes('phone')) entryCount += 1; // Contact info
    if (contentLower.includes('procedure') || contentLower.includes('step')) entryCount += 2; // Procedures
    
    // Special handling for simple service pages (very aggressive caps)
    const isSimpleServicePage = contentLower.includes('spa') || 
                               contentLower.includes('relax') ||
                               contentLower.includes('massage') ||
                               contentLower.includes('lounge') ||
                               contentLower.includes('medical') ||
                               contentLower.includes('currency exchange') ||
                               contentLower.includes('baggage') ||
                               contentLower.includes('wifi') ||
                               contentLower.includes('lost property');
    
    if (isSimpleServicePage) {
      // For simple service pages, apply ultra-aggressive caps
      if (contentLength < 4000 && wordCount < 600) {
        entryCount = Math.min(4, entryCount); // Cap at 4 for simple service pages
      } else if (contentLength < 6000 && wordCount < 1000) {
        entryCount = Math.min(6, entryCount); // Cap at 6 for medium service pages
      } else {
        entryCount = Math.min(8, entryCount); // Cap at 8 even for larger service pages
      }
      
      // Apply immediate hard caps for service pages regardless of other factors
      if (contentLength < 2000) {
        entryCount = Math.min(3, entryCount); // Ultra conservative for very short service pages
      }
    }
    
    // Special handling for simple shopping/duty-free pages
    if (contentLower.includes('duty free') || contentLower.includes('shopping')) {
      // For simple shopping pages, apply very aggressive conservative scaling
      if (contentLength < 2000 && wordCount < 350) {
        entryCount = Math.min(3, entryCount); // Cap at 3 for very simple shopping pages
      } else if (contentLength < 4000 && wordCount < 700) {
        entryCount = Math.min(5, entryCount); // Cap at 5 for simple shopping pages
      } else {
        entryCount += 1; // Small bonus for shopping content
      }
    }
    
    // Page type analysis for appropriate scaling
    const isAirportContent = contentLower.includes('airport') || contentLower.includes('muscat');
    const isComprehensivePage = contentLower.includes('to-from') || 
                               contentLower.includes('transport') ||
                               (contentLower.includes('parking') && contentLower.includes('tariff'));
    
    // Apply multiplier only for genuinely comprehensive content
    let multiplier = 1;
    if (isAirportContent && isComprehensivePage && contentLength > 10000) {
      multiplier = 1.4; // Moderate boost for comprehensive airport pages
    } else if (isAirportContent && contentLength > 5000) {
      multiplier = 1.1; // Small boost for airport content
    }
    
    entryCount = Math.floor(entryCount * multiplier);
    
    // Very intelligent caps based on content analysis
    let maxEntries = 30; // Conservative maximum
    let minEntries = 2; // Realistic minimum
    
    // For simple pages, apply very early caps with enhanced service page detection
    if (contentLength < 1500 && wordCount < 250) {
      maxEntries = 3; // Very simple pages (like basic duty-free, spa)
      minEntries = 2;
    } else if (contentLength < 2500 && wordCount < 400) {
      maxEntries = 4; // Simple pages
      minEntries = 2;
    } else if (contentLength < 4000 && wordCount < 650) {
      maxEntries = 6; // Small-medium pages
    } else if (contentLength < 6000 && wordCount < 1000) {
      maxEntries = 8; // Medium pages
    }
    
    // Apply even stricter caps for identified simple service pages
    if (isSimpleServicePage) {
      if (contentLength < 3000 && wordCount < 500) {
        maxEntries = Math.min(maxEntries, 4); // Force cap at 4 for simple service pages
      } else if (contentLength < 5000 && wordCount < 800) {
        maxEntries = Math.min(maxEntries, 6); // Force cap at 6 for medium service pages
      } else {
        maxEntries = Math.min(maxEntries, 8); // Cap at 8 for any service page
      }
    }
    
    const finalCount = Math.min(maxEntries, Math.max(minEntries, entryCount));
    
    console.log(`📊 Conservative Content Analysis:
    - Length: ${contentLength} chars
    - Words: ${wordCount}
    - Sections: ${sectionCount}
    - Tables: ${tableCount}
    - Lists: ${listCount}
    - Is Simple Service Page: ${isSimpleServicePage}
    - Is Airport Content: ${isAirportContent}
    - Is Comprehensive Page: ${isComprehensivePage}
    - Multiplier: ${multiplier}x
    - Raw Count: ${entryCount}
    - Final Target: ${finalCount} (min: ${minEntries}, max: ${maxEntries})`);
    
    return finalCount;
  }

  // Call Gemini AI for knowledge generation
  private async callGeminiForKnowledgeGeneration(prompt: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.3, // Lower temperature for more factual responses
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096, // Increased for more entries
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH"
              }
            ]
          })
        }
      );

      if (!response.ok) {
        console.error('Gemini API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      
      console.error('Unexpected Gemini response format:', data);
      return null;
      
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return null;
    }
  }

  // Parse AI response into knowledge entries
  private parseAIResponse(aiResponse: string, sourceUrl: string): KnowledgeEntry[] {
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return parsed.entries.map((entry: any) => ({
          question: entry.question || '',
          answer: entry.answer || '',
          category: entry.category || 'General',
          subcategory: entry.subcategory || undefined,
          keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
          sourceUrl: sourceUrl,
          priority: typeof entry.priority === 'number' ? entry.priority : 3
        })).filter((entry: KnowledgeEntry) => entry.question && entry.answer);
      }
      
      return [];
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('AI Response was:', aiResponse);
      return [];
    }
  }

  // Fallback: Original basic knowledge entry conversion
  private async convertToBasicKnowledgeEntries(scrapedContent: ScrapedContent): Promise<KnowledgeEntry[]> {
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
      console.error('Error in basic knowledge conversion:', error);
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