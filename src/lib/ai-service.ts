import { prisma } from './database';

interface AIResponse {
  content: string;
  confidence: number;
  sources: Array<{ title: string; url: string; relevance: number }>;
  intent: string;
  suggestedActions: string[];
  responseTime: number;
}

interface KnowledgeEntry {
  id: number;
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
}

export class AIService {
  private knowledgeBase: KnowledgeEntry[] = [];
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load knowledge base from database
      const entries = await prisma.knowledgeBase.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }
      });
      
      this.knowledgeBase = entries.map((entry: any) => ({
        id: entry.id,
        category: entry.category,
        subcategory: entry.subcategory,
        question: entry.question,
        answer: entry.answer,
        keywords: entry.keywords,
        priority: entry.priority
      }));
      
      console.log(`🧠 AI Service initialized with ${this.knowledgeBase.length} knowledge entries`);
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to load knowledge base from database, using fallback:', error);
      this.loadFallbackKnowledge();
      this.initialized = true;
    }
  }

  private loadFallbackKnowledge() {
    this.knowledgeBase = [
      {
        id: 1,
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
        keywords: ['burj al sahwa', 'directions', 'roundabout', 'highway', 'route', 'drive', 'get to airport', 'how to reach'],
        priority: 3
      },
      {
        id: 2,
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
        keywords: ['public transport', 'bus', 'mwasalat', 'shuttle', 'route', 'transportation', 'public bus', 'city transport'],
        priority: 3
      },
      {
        id: 3,
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
        keywords: ['car rental', 'rent a car', 'rental companies', 'avis', 'hertz', 'budget', 'europcar', 'sixt', 'vehicle rental', 'car hire'],
        priority: 3
      },
      {
        id: 4,
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
        keywords: ['taxi', 'cab', '24/7', 'rates', 'careem', 'uber', 'airport taxi', 'transportation', 'ride'],
        priority: 3
      },
      {
        id: 5,
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
        keywords: ['parking', 'park', 'rates', 'P1', 'P2', 'P3', 'payment', 'cost', 'parking fees', 'car park'],
        priority: 3
      }
    ];
  }

  async processQuery(query: string, sessionId: string): Promise<AIResponse> {
    const startTime = Date.now();
    
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`🤖 AI analyzing query: "${query}"`);

    // Step 1: Semantic Analysis - Extract intent and key concepts
    const analysis = this.analyzeQuery(query);
    console.log(`📊 Query analysis:`, analysis);

    // Step 2: Find relevant knowledge entries using semantic matching
    const relevantEntries = this.findRelevantEntries(query, analysis);
    console.log(`🔍 Found ${relevantEntries.length} relevant entries`);

    // Step 3: Generate response based on best match
    const response = this.generateResponse(query, relevantEntries, analysis);
    
    const responseTime = Date.now() - startTime;
    console.log(`⚡ AI response generated in ${responseTime}ms`);

    return {
      ...response,
      responseTime
    };
  }

  private analyzeQuery(query: string) {
    const lowerQuery = query.toLowerCase();
    
    // Extract intent
    let intent = 'general';
    let concepts: string[] = [];
    let questionType = 'general';
    
    // Question type analysis
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('where')) {
      questionType = 'informational';
    } else if (lowerQuery.includes('is') || lowerQuery.includes('are') || lowerQuery.includes('do')) {
      questionType = 'yes_no';
    } else if (lowerQuery.includes('which') || lowerQuery.includes('what')) {
      questionType = 'selection';
    }

    // Intent classification with better synonym detection and priority ordering
    // Check for specific transportation types first (highest priority)
    if (lowerQuery.includes('taxi') || lowerQuery.includes('cab') || lowerQuery.includes('careem') || lowerQuery.includes('uber')) {
      intent = 'taxi';
      concepts.push('taxi', 'cab', 'ride', 'transport');
    }
    else if (lowerQuery.includes('car rental') || lowerQuery.includes('rent a car') || lowerQuery.includes('rental') || lowerQuery.includes('hire') || 
             (lowerQuery.includes('rent') && lowerQuery.includes('car')) || 
             (lowerQuery.includes('companies') && (lowerQuery.includes('car') || lowerQuery.includes('rental')))) {
      intent = 'car_rental';
      concepts.push('rental', 'car', 'vehicle', 'hire', 'companies');
    }
    else if (lowerQuery.includes('public transport') || lowerQuery.includes('bus') || lowerQuery.includes('shuttle') || 
             lowerQuery.includes('public bus') || lowerQuery.includes('mwasalat') || lowerQuery.includes('transportation')) {
      intent = 'public_transport';
      concepts.push('transportation', 'public', 'bus', 'shuttle');
    }
    else if (lowerQuery.includes('direction') || lowerQuery.includes('how to get') || lowerQuery.includes('route') || 
             lowerQuery.includes('reach') || lowerQuery.includes('way to') || lowerQuery.includes('navigate')) {
      intent = 'directions';
      concepts.push('navigation', 'route', 'travel');
    }
    else if (lowerQuery.includes('park') || lowerQuery.includes('parking')) {
      intent = 'parking';
      concepts.push('parking', 'car', 'fees', 'rates');
    }
    // Fallback for cost/rate questions without specific context
    else if (lowerQuery.includes('cost') || lowerQuery.includes('rate') || lowerQuery.includes('price') || lowerQuery.includes('how much')) {
      // Try to infer from context
      if (lowerQuery.includes('city') || lowerQuery.includes('center') || lowerQuery.includes('downtown')) {
        intent = 'taxi'; // Most likely asking about taxi rates to city
        concepts.push('taxi', 'rates', 'cost');
      } else {
        intent = 'general'; // Keep as general for better matching
        concepts.push('cost', 'rates', 'price');
      }
    }

    // Extract location/landmark references
    const locations = [];
    if (lowerQuery.includes('burj al sahwa') || lowerQuery.includes('roundabout')) {
      locations.push('burj_al_sahwa');
    }
    if (lowerQuery.includes('muscat') || lowerQuery.includes('airport')) {
      locations.push('muscat_airport');
    }

    return {
      intent,
      concepts,
      questionType,
      locations,
      originalQuery: query,
      processedQuery: lowerQuery
    };
  }

  private findRelevantEntries(query: string, analysis: any) {
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    
    return this.knowledgeBase.map(entry => {
      let score = 0;
      
      // Intent matching (high weight)
      if (entry.subcategory === analysis.intent) {
        score += 60;  // Increased weight for direct intent match
      }
      
      // Category matching
      if (entry.category === analysis.intent || analysis.concepts.includes(entry.category)) {
        score += 40;
      }
      
      // Keyword matching with semantic understanding
      const keywordMatches = entry.keywords.filter(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // Exact match
        if (lowerQuery.includes(keywordLower)) return true;
        
        // Partial match
        if (keywordLower.split(' ').some(word => lowerQuery.includes(word))) return true;
        
        // Synonym matching (basic)
        if (this.areSynonyms(keywordLower, lowerQuery)) return true;
        
        return false;
      });
      
      score += keywordMatches.length * 15;  // Increased keyword weight
      
      // Question similarity
      const questionWords = entry.question.toLowerCase().split(/\s+/);
      const commonWords = queryWords.filter(word => questionWords.includes(word));
      score += commonWords.length * 8;
      
      // Concept matching
      analysis.concepts.forEach((concept: string) => {
        if (entry.keywords.some(keyword => keyword.toLowerCase().includes(concept))) {
          score += 20;
        }
      });
      
      // Special boost for exact question type matches
      if (analysis.questionType === 'selection' && entry.question.toLowerCase().includes('which')) {
        score += 25;
      }
      
      return {
        entry,
        score,
        relevance: Math.min(score / 120, 1)  // Adjusted max score
      };
    })
    .filter(item => item.score > 15) // Slightly higher threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3 most relevant
  }

  private areSynonyms(keyword: string, query: string): boolean {
    const synonyms = {
      'car rental': ['rent a car', 'vehicle rental', 'car hire', 'rental car', 'rental companies', 'available companies'],
      'taxi': ['cab', 'ride', 'transport', 'careem', 'uber'],
      'bus': ['public transport', 'transportation', 'shuttle', 'public bus'],
      'parking': ['car park', 'park'],
      'directions': ['route', 'how to get', 'navigation', 'way to', 'reach'],
      'available': ['open', 'operating', 'working', 'companies']
    };
    
    for (const [key, values] of Object.entries(synonyms)) {
      if (keyword.includes(key) && values.some(synonym => query.includes(synonym))) {
        return true;
      }
    }
    
    return false;
  }

  private generateResponse(query: string, relevantEntries: any[], analysis: any) {
    if (relevantEntries.length === 0) {
      return this.generateFallbackResponse(analysis);
    }
    
    const bestMatch = relevantEntries[0];
    
    if (bestMatch.relevance > 0.25) {  // Lowered threshold for better matching
      // Generate response based on question type and specificity
      const responseContent = this.generateTargetedResponse(query, bestMatch.entry, analysis);
      
      return {
        content: responseContent,
        confidence: bestMatch.relevance,
        sources: [{
          title: `${bestMatch.entry.category} - ${bestMatch.entry.subcategory}`,
          url: 'https://www.muscatairport.co.om',
          relevance: bestMatch.relevance
        }],
        intent: bestMatch.entry.subcategory,
        suggestedActions: this.getSuggestedActions(bestMatch.entry.subcategory)
      };
    } else {
      // Lower confidence - combine multiple sources or use fallback
      return this.generateCombinedResponse(relevantEntries, analysis);
    }
  }

  private generateTargetedResponse(query: string, entry: KnowledgeEntry, analysis: any): string {
    const lowerQuery = query.toLowerCase();
    const questionType = analysis.questionType;
    
    // Handle specific question patterns with concise responses
    
    // YES/NO Questions
    if (questionType === 'yes_no' || lowerQuery.match(/^(is|are|do|does|can|will|would)/)) {
      return this.generateYesNoResponse(lowerQuery, entry);
    }
    
    // Availability Questions
    if (lowerQuery.includes('available') || lowerQuery.includes('open') || lowerQuery.includes('operating')) {
      return this.generateAvailabilityResponse(lowerQuery, entry);
    }
    
    // Rate/Cost Questions  
    if (lowerQuery.includes('cost') || lowerQuery.includes('rate') || lowerQuery.includes('price') || lowerQuery.includes('how much')) {
      return this.generateRateResponse(lowerQuery, entry);
    }
    
    // Location Questions
    if (lowerQuery.includes('where') || lowerQuery.includes('location') || lowerQuery.includes('find')) {
      return this.generateLocationResponse(lowerQuery, entry);
    }
    
    // Time/Schedule Questions
    if (lowerQuery.includes('when') || lowerQuery.includes('time') || lowerQuery.includes('schedule') || lowerQuery.includes('hours')) {
      return this.generateTimeResponse(lowerQuery, entry);
    }
    
    // How Questions (but not "how much")
    if (lowerQuery.startsWith('how') && !lowerQuery.includes('much')) {
      return this.generateHowResponse(lowerQuery, entry);
    }
    
    // Which/What Questions (selection type)
    if (lowerQuery.includes('which') || lowerQuery.includes('what') || questionType === 'selection') {
      return this.generateSelectionResponse(lowerQuery, entry);
    }
    
    // Default to full answer for complex queries
    return entry.answer;
  }

  private generateYesNoResponse(query: string, entry: KnowledgeEntry): string {
    const subcategory = entry.subcategory;
    
    if (query.includes('taxi') || subcategory === 'taxi') {
      return `✅ **Yes, taxis are available at Muscat Airport.**

• 24/7 service outside arrivals hall
• Airport taxis, private taxis, and ride-hailing (Careem/Uber)
• Rates: 4-12 OMR to city areas

*Need more details about rates or booking?*`;
    }
    
    if (query.includes('public transport') || query.includes('bus') || subcategory === 'public_transport') {
      return `✅ **Yes, public transportation is available from Muscat Airport.**

• Mwasalat buses to Ruwi and Seeb
• Service: 6:00 AM - 10:00 PM (every 30-45 minutes)
• Fare: 500 Baisa - 1 OMR

*Would you like route details or schedules?*`;
    }
    
    if (query.includes('car rental') || query.includes('rent') || subcategory === 'car_rental') {
      return `✅ **Yes, car rental services are available at Muscat Airport.**

• Multiple companies: Avis, Hertz, Budget, Europcar, Sixt
• Located in arrivals hall
• 24/7 service for major brands

*Need information about specific companies or rates?*`;
    }
    
    if (query.includes('park') || subcategory === 'parking') {
      return `✅ **Yes, parking is available at Muscat Airport.**

• Multiple parking areas (P1, P2, P3)
• 24/7 availability with CCTV surveillance
• Rates: First 30 minutes free, then 2-5 OMR per day

*Want to know specific rates or locations?*`;
    }
    
    return `✅ **Yes, ${subcategory.replace('_', ' ')} services are available at Muscat Airport.**\n\n*Ask for more specific details if needed.*`;
  }

  private generateAvailabilityResponse(query: string, entry: KnowledgeEntry): string {
    if (entry.subcategory === 'taxi') {
      return `🚕 **Taxi Availability:** 24/7 service available outside arrivals hall. No advance booking required.`;
    }
    
    if (entry.subcategory === 'public_transport') {
      return `🚌 **Public Transport Availability:** Mwasalat buses operate 6:00 AM - 10:00 PM, every 30-45 minutes.`;
    }
    
    if (entry.subcategory === 'car_rental') {
      return `🚗 **Car Rental Availability:** Major brands available 24/7 in arrivals hall. Local companies have varying hours.`;
    }
    
    if (entry.subcategory === 'parking') {
      return `🅿️ **Parking Availability:** 24/7 parking in multiple areas (P1, P2, P3) with real-time availability.`;
    }
    
    return entry.answer.split('\n\n')[0]; // Return first section
  }

  private generateRateResponse(query: string, entry: KnowledgeEntry): string {
    if (entry.subcategory === 'taxi') {
      return `🚕 **Taxi Rates from Muscat Airport:**
• To City Center: 8-12 OMR
• To Seeb: 4-6 OMR  
• To Nizwa: 25-30 OMR
• To Sur: 35-40 OMR

*All taxis use meters and accept credit cards.*`;
    }
    
    if (entry.subcategory === 'public_transport') {
      return `🚌 **Public Transport Rates:**
• Mwasalat bus fare: 500 Baisa - 1 OMR
• Hotel shuttles: Usually complimentary (check with hotel)`;
    }
    
    if (entry.subcategory === 'parking') {
      return `🅿️ **Parking Rates at Muscat Airport:**
• First 30 minutes: Free
• 1-2 hours: 2 OMR
• 2-24 hours: 5 OMR per day
• Long-term (P3): 3 OMR per day`;
    }
    
    // Extract rate information from full answer
    const rateSection = entry.answer.match(/\*\*Rates?:\*\*([\s\S]*?)(\*\*|$)/);
    if (rateSection) {
      return `💰 **Rates:**${rateSection[1].trim()}`;
    }
    
    return entry.answer.split('\n\n')[1] || entry.answer; // Try to get rates section
  }

  private generateLocationResponse(query: string, entry: KnowledgeEntry): string {
    if (entry.subcategory === 'taxi') {
      return `📍 **Taxi Location:** Outside arrivals hall - clearly marked taxi stand area.`;
    }
    
    if (entry.subcategory === 'public_transport') {
      return `📍 **Bus Stop Location:** Outside arrivals hall, well-signposted Mwasalat bus stop.`;
    }
    
    if (entry.subcategory === 'car_rental') {
      return `📍 **Car Rental Location:** All major car rental desks are in the arrivals hall for easy access.`;
    }
    
    if (entry.subcategory === 'parking') {
      return `📍 **Parking Locations:**
• P1: Short-term (closest to terminal)
• P2: Medium-term parking  
• P3: Long-term parking (most economical)`;
    }
    
    return entry.answer.split('\n\n')[0]; // Return first section
  }

  private generateTimeResponse(query: string, entry: KnowledgeEntry): string {
    if (entry.subcategory === 'taxi') {
      return `⏰ **Taxi Operating Hours:** 24/7 service - taxis are always available at the airport.`;
    }
    
    if (entry.subcategory === 'public_transport') {
      return `⏰ **Bus Schedule:**
• Operating Hours: 6:00 AM - 10:00 PM
• Frequency: Every 30-45 minutes
• Routes to Ruwi and Seeb`;
    }
    
    if (entry.subcategory === 'car_rental') {
      return `⏰ **Car Rental Hours:**
• Major brands (Avis, Hertz, Budget): 24/7
• Local companies: Varies (typically 8 AM - 10 PM)`;
    }
    
    if (entry.subcategory === 'parking') {
      return `⏰ **Parking Hours:** 24/7 availability with CCTV surveillance and security.`;
    }
    
    return entry.answer.split('\n\n')[1] || entry.answer;
  }

  private generateHowResponse(query: string, entry: KnowledgeEntry): string {
    if (query.includes('get to') || query.includes('reach')) {
      return entry.answer; // Full directions
    }
    
    // For other "how" questions, provide procedural information
    return entry.answer.split('\n\n').slice(0, 2).join('\n\n'); // First two sections
  }

  private generateSelectionResponse(query: string, entry: KnowledgeEntry): string {
    if (entry.subcategory === 'car_rental') {
      return `🚗 **Car Rental Companies at Muscat Airport:**

**International:** Avis, Hertz, Budget, Europcar, Sixt
**Local:** Mark Rent a Car, Fast Rent a Car, United Car Rental

*All located in arrivals hall. Major brands offer 24/7 service.*`;
    }
    
    // For other selection questions, return the full answer
    return entry.answer;
  }

  private generateFallbackResponse(analysis: any) {
    return {
      content: `🏢 **Muscat International Airport Information:**

I understand you're asking about ${analysis.intent || 'airport services'}. I can help you with:

**🚗 Transportation:**
- Car rental companies (Avis, Hertz, Budget, Europcar, Sixt)
- Taxi services (24/7 availability, rates to different locations)
- Public bus routes (Mwasalat services)
- Hotel shuttle services

**🗺️ Directions:**
- Driving directions to the airport
- Routes from major landmarks
- Highway access information

**🅿️ Parking:**
- Parking rates and zones (P1, P2, P3)
- Payment methods and features

Could you please rephrase your question or be more specific about what you'd like to know?`,
      confidence: 0.3,
      sources: [{ title: 'Muscat Airport Guide', url: 'https://www.muscatairport.co.om', relevance: 0.5 }],
      intent: 'clarification',
      suggestedActions: ['ask_specific', 'browse_services', 'contact_support']
    };
  }

  private generateCombinedResponse(relevantEntries: any[], analysis: any) {
    // Combine information from multiple relevant entries
    const combinedInfo = relevantEntries.slice(0, 2).map(item => ({
      category: item.entry.subcategory,
      content: item.entry.answer.split('\n')[0] // Get the first line/summary
    }));

    return {
      content: `🔍 **Based on your question about ${analysis.intent}:**

${combinedInfo.map(info => `**${info.category.toUpperCase()}:**\n${info.content}`).join('\n\n')}

Would you like more detailed information about any of these options?`,
      confidence: 0.6,
      sources: relevantEntries.map(item => ({
        title: `${item.entry.category} - ${item.entry.subcategory}`,
        url: 'https://www.muscatairport.co.om',
        relevance: item.relevance
      })),
      intent: 'combined',
      suggestedActions: ['get_details', 'ask_specific', 'browse_more']
    };
  }

  private getSuggestedActions(subcategory: string): string[] {
    const actionMap: { [key: string]: string[] } = {
      'car_rental': ['book_online', 'compare_rates', 'check_requirements'],
      'taxi': ['check_rates', 'book_ride', 'contact_taxi'],
      'public_transport': ['check_schedule', 'find_stops', 'plan_route'],
      'parking': ['view_rates', 'check_availability', 'find_location'],
      'directions': ['view_map', 'check_traffic', 'get_gps']
    };
    
    return actionMap[subcategory] || ['ask_more', 'contact_support'];
  }
}

export const aiService = new AIService(); 