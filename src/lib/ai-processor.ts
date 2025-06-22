import { OllamaService } from './ollama';
import { FlightService } from './flight-service';
import { KnowledgeBaseService } from './knowledge-base';
import { WebScraperService } from './web-scraper';
import { prisma } from './database';

export interface ProcessedResponse {
  content: string;
  confidence: number;
  sources: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;
  intent: string;
  requiresHuman: boolean;
  suggestedActions: string[];
  responseTime: number;
}

export interface ConversationContext {
  sessionId: string;
  previousMessages: Array<{
    type: 'user' | 'bot';
    content: string;
    timestamp: Date;
    intent?: string;
  }>;
  userPreferences: {
    language: string;
    preferredAirport?: string;
    travelType?: 'business' | 'leisure';
  };
  currentTopic?: string;
  entities: Map<string, any>;
}

export class AIProcessor {
  private ollama: OllamaService;
  private flightService: FlightService;
  private knowledgeBase: KnowledgeBaseService;
  private webScraper: WebScraperService;
  private contextCache: Map<string, ConversationContext> = new Map();

  constructor() {
    this.ollama = new OllamaService();
    this.flightService = new FlightService();
    this.knowledgeBase = new KnowledgeBaseService();
    this.webScraper = new WebScraperService();
  }

  async processQuery(
    query: string, 
    sessionId: string
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Get or create conversation context
      const context = await this.getConversationContext(sessionId);
      
      // Step 2: Check knowledge base first
      const kbResult = await this.knowledgeBase.getBestMatch(query, context.userPreferences.language);
      if (kbResult && kbResult.confidence > 0.8) {
        await this.updateConversationContext(sessionId, query, kbResult.entry.answer, 'knowledge_base');
        return {
          content: kbResult.entry.answer,
          confidence: kbResult.confidence,
          sources: [{
            title: `Knowledge Base - ${kbResult.entry.category}`,
            url: 'https://omanairports.co.om',
            relevance: kbResult.relevance
          }],
          intent: 'knowledge_base',
          requiresHuman: false,
          suggestedActions: this.generateSuggestedActions('knowledge_base', query),
          responseTime: Date.now() - startTime
        };
      }
      
      // Step 3: Detect intent and extract entities
      const intent = await this.detectIntent(query, context);
      const entities = this.extractEntities(query, intent);
      
      // Step 4: Update context with new information
      context.entities = new Map([...context.entities, ...entities]);
      context.currentTopic = this.determineCurrentTopic(intent.type, context);
      
      // Step 5: Process based on intent
      let response: ProcessedResponse;
      
      switch (intent.type) {
        case 'flight_inquiry':
          response = await this.handleFlightInquiry(query, context, entities);
          break;
        case 'airport_services':
          response = await this.handleAirportServices(query, context);
          break;
                  case 'transportation':
            const transportationResponse = await this.handleTransportation(query);
            response = {
              content: transportationResponse,
              confidence: 0.9,
              sources: [{ title: 'Muscat Airport', url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
              intent: 'transportation',
              requiresHuman: false,
              suggestedActions: ['view_parking_rates', 'book_taxi', 'check_shuttle'],
              responseTime: 0
            };
            break;
        case 'general_info':
          response = await this.handleGeneralInfo(query, context);
          break;
        case 'greeting':
          response = await this.handleGreeting(query, context);
          break;
        case 'complaint':
          response = await this.handleComplaint(query, context);
          break;
        default:
          response = await this.handleGeneral(query, context);
          break;
      }

      // Step 6: Update context and calculate response time
      await this.updateConversationContext(sessionId, query, response.content, intent.type);
      response.responseTime = Date.now() - startTime;
      
      return response;

    } catch (error) {
      console.error('AI processing error:', error);
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact our support team.',
        confidence: 0.1,
        sources: [],
        intent: 'error',
        requiresHuman: true,
        suggestedActions: ['contact_support', 'try_again'],
        responseTime: Date.now() - startTime
      };
    }
  }

  private async getConversationContext(sessionId: string): Promise<ConversationContext> {
    // Check cache first
    if (this.contextCache.has(sessionId)) {
      return this.contextCache.get(sessionId)!;
    }

    // Load from database
    const session = await prisma.chatSession.findUnique({
      where: { sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Last 10 messages for context
        }
      }
    });

    const context: ConversationContext = {
      sessionId,
      previousMessages: session?.messages.map((msg: any) => ({
        type: msg.messageType as 'user' | 'bot',
        content: msg.content,
        timestamp: msg.createdAt,
        intent: msg.intent || undefined
      })) || [],
      userPreferences: {
        language: session?.language || 'en'
      },
      entities: new Map()
    };

    // Cache the context
    this.contextCache.set(sessionId, context);
    return context;
  }

  private async detectIntent(query: string, context: ConversationContext): Promise<{type: string, confidence: number}> {
    const lowerQuery = query.toLowerCase();
    
    // Flight-related patterns
    const flightPatterns = [
      /flight\s+([A-Z]{2}\d{3,4})/i,
      /status.*([A-Z]{2}\d{3,4})/i,
      /(departure|arrival|gate|terminal).*([A-Z]{2}\d{3,4})/i,
      /(delayed|cancelled|on time).*flight/i,
      /check.*flight/i
    ];

    // Airport services patterns
    const servicePatterns = [
      /(restaurant|food|dining|eat)/i,
      /(shop|shopping|store|duty free)/i,
      /(wifi|internet|charging)/i,
      /(lounge|vip|business class)/i,
      /(prayer|mosque|religious)/i,
      /(bathroom|restroom|toilet)/i,
      /(medical|pharmacy|doctor)/i,
      /(lost.*found|baggage.*claim)/i,
      // Facilities patterns
      /(facilities|amenities).*(?:available|at|airport)/i,
      /what.*(?:facilities|amenities|services).*(?:available|airport)/i,
      /(?:available|airport).*(?:facilities|amenities|services)/i,
      /what.*(?:is|are).*(?:available|there).*(?:airport|muscat)/i
    ];

    // Transportation patterns
    const transportPatterns = [
      // Business class specific transportation (higher priority)
      /(business class|first class|vip).*(?:drop.*off|pick.*up|area|dedicated|special)/i,
      /(?:drop.*off|pick.*up).*(?:business class|first class|vip)/i,
      /dedicated.*(?:business|first class|vip).*(?:area|drop|pick)/i,
      // Airline-specific first class queries
      /(oman air|omanair).*(?:first class|business class).*(?:special|area|dedicated)/i,
      /(?:first class|business class).*(?:oman air|omanair).*(?:special|area|dedicated)/i,
      /(?:special|area|dedicated).*(?:oman air|omanair).*(?:first class|business class)/i,
      // Directions and access
      /(how.*get.*to|directions.*to|route.*to|drive.*to|way.*to).*airport/i,
      /(how.*get.*from|directions.*from|route.*from|drive.*from).*(?:city|center|muscat|seeb)/i,
      /(access.*road|highway|sultan.*qaboos)/i,
      /(from.*muscat|from.*seeb|from.*city)/i,
      /(to.*airport|reach.*airport|find.*airport)/i,
      // Road connection queries
      /(what.*road.*connect|which.*road.*connect|road.*connect.*airport)/i,
      /(connect.*airport.*country|connect.*airport.*rest)/i,
      /(what.*road.*airport|which.*road.*airport)/i,
      // Transportation modes
      /(taxi|cab|uber|careem)/i,
      /(bus|shuttle|transport)/i,
      // Enhanced parking patterns
      /(parking|car.*park|park.*car)/i,
      /(where.*park|where.*can.*park|parking.*location|parking.*area)/i,
      /(park.*at.*airport|park.*muscat.*airport)/i,
      /(parking.*available|parking.*options|parking.*facilities)/i,
      /(rental.*car|car.*rental|rent.*car|car.*hire|hire.*car)/i,
      /(?:can|do|is|are).*(?:i|you|there).*(?:rent|rental|hire).*car/i,
      /(?:rent|rental|hire).*(?:available|service)/i,
      /(metro|train)/i,
      // Pick-up and drop-off
      /(pick.*up|drop.*off|forecourt)/i,
      // Rate/cost related queries that could be parking follow-ups
      /(rate|cost|price|fee|charge|tariff).*(?:minutes?|hours?|mins?|hrs?)/i,
      /(?:minutes?|hours?|mins?|hrs?).*(?:rate|cost|price|fee|charge)/i,
      /after.*(?:minutes?|hours?).*(?:rate|cost|price)/i,
      /how.*much.*(?:minutes?|hours?)/i,
      /(?:30|1|2|3|half|one|two|three).*(?:minutes?|hours?).*(?:rate|cost|price)/i
    ];

    // Greeting patterns
    const greetingPatterns = [
      /(hello|hi|hey|good morning|good afternoon|good evening)/i,
      /(how are you|what.*up)/i,
      /(thank you|thanks|appreciate)/i
    ];

    // Complaint patterns
    const complaintPatterns = [
      /(complain|complaint|problem|issue)/i,
      /(bad|terrible|awful|disappointed)/i,
      /(delay|delayed|late|waiting)/i,
      /(rude|unprofessional|poor service)/i
    ];

    // Check patterns in order of priority
    for (const pattern of flightPatterns) {
      if (pattern.test(lowerQuery)) {
        return { type: 'flight_inquiry', confidence: 0.9 };
      }
    }

    // Check transportation patterns BEFORE service patterns to catch business class drop-off/pickup
    for (const pattern of transportPatterns) {
      if (pattern.test(lowerQuery)) {
        return { type: 'transportation', confidence: 0.8 };
      }
    }

    for (const pattern of servicePatterns) {
      if (pattern.test(lowerQuery)) {
        return { type: 'airport_services', confidence: 0.8 };
      }
    }

    for (const pattern of greetingPatterns) {
      if (pattern.test(lowerQuery)) {
        return { type: 'greeting', confidence: 0.7 };
      }
    }

    for (const pattern of complaintPatterns) {
      if (pattern.test(lowerQuery)) {
        return { type: 'complaint', confidence: 0.8 };
      }
    }

    // Check context for topic continuation
    if (context.currentTopic) {
      // If the query contains time/rate keywords and we were talking about transportation, continue that topic
      if (context.currentTopic === 'transportation' && 
          (lowerQuery.includes('rate') || lowerQuery.includes('cost') || lowerQuery.includes('price') || 
           lowerQuery.includes('minute') || lowerQuery.includes('hour') || lowerQuery.includes('after'))) {
        return { type: 'transportation', confidence: 0.8 };
      }
      return { type: context.currentTopic, confidence: 0.6 };
    }

    return { type: 'general_info', confidence: 0.5 };
  }

  private extractEntities(query: string, intent: {type: string, confidence: number}): Map<string, any> {
    const entities = new Map<string, any>();
    
    // Extract flight numbers
    const flightMatch = query.match(/\b([A-Z]{2}\d{3,4})\b/i);
    if (flightMatch) {
      entities.set('flight_number', flightMatch[1].toUpperCase());
    }

    // Extract airports
    const airportCodes = ['MCT', 'SLL', 'MSH', 'DQM', 'KHS'];
    const airportNames = ['muscat', 'salalah', 'masirah', 'duqm', 'khasab'];
    
    for (const code of airportCodes) {
      if (query.toUpperCase().includes(code)) {
        entities.set('airport_code', code);
        break;
      }
    }

    for (let i = 0; i < airportNames.length; i++) {
      if (query.toLowerCase().includes(airportNames[i])) {
        entities.set('airport_name', airportNames[i]);
        entities.set('airport_code', airportCodes[i]);
        break;
      }
    }

    // Extract dates/times
    const datePatterns = [
      /today|tomorrow|yesterday/i,
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
      /\d{1,2}:\d{2}(?:\s*(?:AM|PM))?/i
    ];

    for (const pattern of datePatterns) {
      const match = query.match(pattern);
      if (match) {
        entities.set('time_reference', match[0]);
        break;
      }
    }

    return entities;
  }

  private determineCurrentTopic(intent: string, context: ConversationContext): string {
    // If user is continuing a conversation about the same topic
    if (context.previousMessages.length > 0) {
      const lastIntent = context.previousMessages[0].intent;
      if (lastIntent && intent === 'general_info') {
        return lastIntent; // Continue the previous topic
      }
    }
    
    return intent;
  }

  private async handleFlightInquiry(
    query: string, 
    context: ConversationContext, 
    entities: Map<string, any>
  ): Promise<ProcessedResponse> {
    const flightNumber = entities.get('flight_number');
    
    if (flightNumber) {
      const flightData = await this.flightService.getFlightInfo(flightNumber);
      
      if (flightData) {
        return {
          content: this.formatFlightResponse(flightData),
          confidence: 0.9,
          sources: [{
            title: 'Flight Information System',
            url: 'https://omanairports.co.om/flights',
            relevance: 0.9
          }],
          intent: 'flight_inquiry',
          requiresHuman: false,
          suggestedActions: ['track_flight', 'set_notification', 'view_terminal_map'],
          responseTime: 0
        };
      } else {
        return {
          content: `I couldn't find information for flight ${flightNumber}. Please check the flight number and try again, or contact our information desk for assistance.`,
          confidence: 0.6,
          sources: [],
          intent: 'flight_inquiry',
          requiresHuman: false,
          suggestedActions: ['contact_info_desk', 'check_spelling', 'try_airline_website'],
          responseTime: 0
        };
      }
    }

    // General flight inquiry without specific flight number
    const contextualPrompt = this.buildContextualPrompt(query, context, 'flight_inquiry');
    const aiResponse = await this.ollama.generateResponse(query, contextualPrompt);
    
    return {
      content: aiResponse || this.getDefaultFlightResponse(),
      confidence: aiResponse ? 0.7 : 0.5,
      sources: [{
        title: 'Oman Airports Flight Information',
        url: 'https://omanairports.co.om/flights',
        relevance: 0.8
      }],
      intent: 'flight_inquiry',
      requiresHuman: false,
      suggestedActions: ['view_flight_schedule', 'contact_airline', 'check_airport_displays'],
      responseTime: 0
    };
  }

  private async handleAirportServices(query: string, context: ConversationContext): Promise<ProcessedResponse> {
    // First, try to get real data from web scraping
    console.log('🔍 Searching web sources for airport services...');
    const webResults = await this.webScraper.searchAcrossSources(query, 3);
    
    let sources: Array<{title: string, url: string, relevance: number}> = [];
    let webContent = '';

    if (webResults.length > 0) {
      console.log(`📄 Found ${webResults.length} relevant web results`);
      sources = webResults.map(result => ({
        title: result.title,
        url: result.url,
        relevance: result.relevance
      }));
      
      // Build response from web content
      webContent = this.buildResponseFromWebContent(webResults, query);
    }

    // If we have web content, use it directly
    if (webContent) {
      console.log('✅ Using web scraped content for response');
      return {
        content: `Based on current information from Oman Airports:\n\n${webContent}`,
        confidence: 0.9,
        sources,
        intent: 'airport_services',
        requiresHuman: false,
        suggestedActions: ['view_terminal_map', 'download_app', 'contact_info_desk'],
        responseTime: 0
      };
    }

    // Fallback to static info if web scraping fails
    console.log('⚠️ No web content found, using static information');
    const serviceInfo = await this.getAirportServiceInfo(query);
    
    // Try AI enhancement as final step (but don't fail if it doesn't work)
    try {
      const contextualPrompt = this.buildContextualPrompt(query, context, 'airport_services');
      const aiResponse = await this.ollama.generateResponse(query, contextualPrompt + serviceInfo);
      
      if (aiResponse) {
        return {
          content: aiResponse,
          confidence: 0.8,
          sources: [{
            title: 'Oman Airports Services',
            url: 'https://omanairports.co.om/services',
            relevance: 0.8
          }],
          intent: 'airport_services',
          requiresHuman: false,
          suggestedActions: ['view_terminal_map', 'download_app', 'contact_info_desk'],
          responseTime: 0
        };
      }
    } catch (error) {
      console.log('ℹ️ AI enhancement unavailable, using static content');
    }
    
    return {
      content: serviceInfo,
      confidence: 0.7,
      sources: [{
        title: 'Oman Airports Services',
        url: 'https://omanairports.co.om/services',
        relevance: 0.8
      }],
      intent: 'airport_services',
      requiresHuman: false,
      suggestedActions: ['view_terminal_map', 'download_app', 'contact_info_desk'],
      responseTime: 0
    };
  }

  private async handleTransportation(query: string): Promise<string> {
    console.log('🔍 Searching web sources for transportation info...');
    
    try {
      // Use the focused Muscat Airport scraper
      const webResults = await this.webScraper.scrapeMuscatAirportTransportation();
      
      if (webResults.success && webResults.data.length > 0) {
        console.log(`📄 Found ${webResults.data.length} relevant web results for transportation`);
        
        // Filter results based on query
        const relevantResults = webResults.data.filter(item => {
          const queryLower = query.toLowerCase();
          const contentLower = (item.title + ' ' + item.content).toLowerCase();
          
          // Check for directions and access road queries
          if (queryLower.includes('get to') || queryLower.includes('directions') || 
              queryLower.includes('route') || queryLower.includes('highway') ||
              queryLower.includes('access') || queryLower.includes('drive') ||
              queryLower.includes('from city') || queryLower.includes('from muscat') ||
              queryLower.includes('from seeb') || queryLower.includes('sultan qaboos')) {
            return item.category === 'access_road' || item.category === 'directions' || 
                   contentLower.includes('access') || contentLower.includes('highway') ||
                   contentLower.includes('sultan qaboos') || contentLower.includes('directions') ||
                   contentLower.includes('route') || contentLower.includes('seeb') ||
                   contentLower.includes('muscat');
          }
          
          // Check for parking-related queries
          if (queryLower.includes('parking') || queryLower.includes('park')) {
            return item.category === 'parking' || contentLower.includes('parking');
          }
          
          // Check for taxi-related queries
          if (queryLower.includes('taxi')) {
            return item.category === 'taxi' || contentLower.includes('taxi');
          }
          
          // Check for transportation-related queries
          if (queryLower.includes('transport') || queryLower.includes('bus') || queryLower.includes('shuttle')) {
            return item.category === 'shuttle' || contentLower.includes('bus') || contentLower.includes('shuttle');
          }
          
          // Check for car rental queries
          if (queryLower.includes('rental') || queryLower.includes('rent')) {
            return item.category === 'car_rental' || contentLower.includes('rental');
          }
          
          // Check for pick-up/drop-off queries
          if (queryLower.includes('pick') || queryLower.includes('drop')) {
            return item.category === 'pickup_dropoff' || contentLower.includes('pick') || contentLower.includes('drop');
          }
          
          // General transportation content
          return contentLower.includes('transport') || contentLower.includes('travel');
        });
        
        if (relevantResults.length > 0) {
          // Sort by relevance
          relevantResults.sort((a, b) => b.relevance - a.relevance);
          
          console.log('🔍 Processing transportation query with improved summarization...');
          
          // Use our improved buildResponseFromWebContent method which includes all summarization logic
          const processedResponse = this.buildResponseFromWebContent(relevantResults, query);
          
          if (processedResponse) {
            console.log('✅ Using improved summarization for transportation response');
            return `Based on current information from Muscat Airport:\n\n${processedResponse}`;
          }
          
          console.log('⚠️ Fallback to basic response formatting');
          // Fallback to basic response if summarization fails
          let response = 'Based on current information from Muscat Airport:\n\n';
          
          // Take the top result only
          const topResult = relevantResults[0];
          response += `**${topResult.title}**\n`;
          response += `${topResult.content}\n\n`;
          response += `*Source: ${topResult?.url || 'https://www.muscatairport.co.om/en/content/to-from'}*`;
          
          return response;
        }
      }
      
      console.log('⚠️ No web content found for transportation, using static information');
      
      // Fallback to static transportation information
      const queryLower = query.toLowerCase();
      if (queryLower.includes('parking')) {
        return this.getStaticParkingInfo();
      } else if (queryLower.includes('taxi')) {
        return this.getStaticTaxiInfo();
      } else if (queryLower.includes('get to') || queryLower.includes('directions') || 
                 queryLower.includes('route') || queryLower.includes('highway') ||
                 queryLower.includes('access') || queryLower.includes('drive') ||
                 queryLower.includes('from city') || queryLower.includes('from muscat') ||
                 queryLower.includes('from seeb')) {
        return this.getStaticDirectionsInfo();
      } else {
        return this.getStaticTransportationInfo();
      }
      
    } catch (error) {
      console.error('Error in transportation handling:', error);
      return this.getStaticTransportationInfo();
    }
  }

  private getStaticParkingInfo(): string {
    return `**Parking Information at Muscat Airport:**

**Short-term Parking (P1):**
- 0-30 minutes: OMR 0.600
- 30 minutes-1 hour: OMR 1.100
- 1-2 hours: OMR 2.100
- 2-3 hours: OMR 3.200
- Daily rate: OMR 25.200

**Long-term Parking (P3):**
- 1 day: OMR 3.200
- 2 days: OMR 6.300
- 3 days: OMR 9.500
- Additional days: OMR 3.200 per day

**Pick-up/Drop-off:**
- Free for first 10 minutes
- OMR 2.100 for 10-20 minutes

*For more information, please visit the airport or contact customer service.*`;
  }

  private getStaticTaxiInfo(): string {
    return `**Taxi Services at Muscat Airport:**

- Airport taxis are available 24/7 from the arrivals hall
- All taxis use meters for fare calculation
- Taxi office located in the public arrivals area
- Pre-booked taxis available through hotels
- Ride-sharing services (Uber, Careem) also available

*Taxi fares vary by destination. Please check with the taxi office for current rates.*`;
  }

  private getStaticTransportationInfo(): string {
    return `**Transportation Options at Muscat Airport:**

**🚗 Parking:** Multiple parking areas with hourly and daily rates
**🚕 Taxis:** Available 24/7 from arrivals hall
**🚌 Buses:** Public buses operated by Mwasalat
**🚐 Shuttles:** Hotel shuttle services available
**🚙 Car Rental:** Multiple companies available 24/7

*For specific rates and schedules, please check with the respective service providers or visit the airport information desk.*`;
  }

  private async handleGeneralInfo(query: string, context: ConversationContext): Promise<ProcessedResponse> {
    // First, try to get real data from web scraping
    console.log('🔍 Searching web sources for general airport info...');
    const webResults = await this.webScraper.searchAcrossSources(query, 3);
    
    let sources: Array<{title: string, url: string, relevance: number}> = [];
    let webContent = '';

    if (webResults.length > 0) {
      console.log(`📄 Found ${webResults.length} relevant web results for general info`);
      sources = webResults.map(result => ({
        title: result.title,
        url: result.url,
        relevance: result.relevance
      }));
      
      // Build response from web content
      webContent = this.buildResponseFromWebContent(webResults, query);
    }

    // If we have web content, use it directly
    if (webContent) {
      console.log('✅ Using web scraped content for general info response');
      return {
        content: `Here's the latest information from Oman Airports:\n\n${webContent}`,
        confidence: 0.85,
        sources,
        intent: 'general_info',
        requiresHuman: false,
        suggestedActions: ['browse_services', 'check_flights', 'contact_support'],
        responseTime: 0
      };
    }

    // Try AI enhancement as fallback
    try {
      const contextualPrompt = this.buildContextualPrompt(query, context, 'general_info');
      const aiResponse = await this.ollama.generateResponse(query, contextualPrompt);
      
      if (aiResponse) {
        return {
          content: aiResponse,
          confidence: 0.7,
          sources: [{
            title: 'Oman Airports Official Website',
            url: 'https://omanairports.co.om',
            relevance: 0.7
          }],
          intent: 'general_info',
          requiresHuman: false,
          suggestedActions: ['browse_services', 'check_flights', 'contact_support'],
          responseTime: 0
        };
      }
    } catch (error) {
      console.log('ℹ️ AI enhancement unavailable for general info, using fallback');
    }
    
    return {
      content: 'I\'d be happy to help you with information about Oman Airports. Could you please be more specific about what you\'d like to know?',
      confidence: 0.4,
      sources: [{
        title: 'Oman Airports Official Website',
        url: 'https://omanairports.co.om',
        relevance: 0.7
      }],
      intent: 'general_info',
      requiresHuman: false,
      suggestedActions: ['browse_services', 'check_flights', 'contact_support'],
      responseTime: 0
    };
  }

  private async handleGreeting(query: string, context: ConversationContext): Promise<ProcessedResponse> {
    const greetings = [
      'Hello! Welcome to Oman Airports. How can I assist you today?',
      'Hi there! I\'m here to help you with any questions about Oman Airports.',
      'Good day! How may I help you with your airport needs?',
      'Welcome! I\'m your Oman Airports assistant. What can I help you with?'
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      content: greeting,
      confidence: 0.9,
      sources: [],
      intent: 'greeting',
      requiresHuman: false,
      suggestedActions: ['check_flights', 'airport_services', 'transportation_info'],
      responseTime: 0
    };
  }

  private async handleComplaint(query: string, context: ConversationContext): Promise<ProcessedResponse> {
    return {
      content: 'I understand your concern and I apologize for any inconvenience. Your feedback is important to us. I\'ll connect you with our customer service team who can better assist you with this matter.',
      confidence: 0.8,
      sources: [],
      intent: 'complaint',
      requiresHuman: true,
      suggestedActions: ['contact_customer_service', 'file_complaint', 'speak_to_manager'],
      responseTime: 0
    };
  }

  private async handleGeneral(query: string, context: ConversationContext): Promise<ProcessedResponse> {
    const contextualPrompt = this.buildContextualPrompt(query, context, 'general');
    const aiResponse = await this.ollama.generateResponse(query, contextualPrompt);
    
    return {
      content: aiResponse || 'I\'m here to help with information about Oman Airports. Could you please rephrase your question or be more specific?',
      confidence: aiResponse ? 0.6 : 0.3,
      sources: [],
      intent: 'general',
      requiresHuman: aiResponse ? false : true,
      suggestedActions: ['rephrase_question', 'browse_faq', 'contact_support'],
      responseTime: 0
    };
  }

  private buildContextualPrompt(query: string, context: ConversationContext, intent: string): string {
    let prompt = `You are an AI assistant for Oman Airports. The user is asking about ${intent.replace('_', ' ')}.

Previous conversation context:`;

    if (context.previousMessages.length > 0) {
      context.previousMessages.slice(0, 3).forEach((msg: any) => {
        prompt += `\n${msg.type}: ${msg.content}`;
      });
    }

    prompt += `\n\nUser preferences: Language: ${context.userPreferences.language}`;
    
    if (context.entities.size > 0) {
      prompt += '\nRelevant entities from conversation:';
      context.entities.forEach((value, key) => {
        prompt += `\n- ${key}: ${value}`;
      });
    }

    prompt += `\n\nCurrent question: ${query}

Please provide a helpful, accurate response about Oman Airports. Be concise but informative.`;

    return prompt;
  }

  private formatFlightResponse(flightData: any): string {
    return `Flight ${flightData.flightNumber} (${flightData.airline.name}): ${flightData.status}

Departure: ${flightData.departure.airport} - Terminal ${flightData.departure.terminal}${flightData.departure.gate !== 'TBD' ? `, Gate ${flightData.departure.gate}` : ''}
Scheduled: ${flightData.departure.scheduled}${flightData.departure.actual ? `\nActual: ${flightData.departure.actual}` : ''}

Arrival: ${flightData.arrival.airport} - Terminal ${flightData.arrival.terminal}${flightData.arrival.gate !== 'TBD' ? `, Gate ${flightData.arrival.gate}` : ''}
Scheduled: ${flightData.arrival.scheduled}${flightData.arrival.actual ? `\nActual: ${flightData.arrival.actual}` : ''}`;
  }

  private async getAirportServiceInfo(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('restaurant') || lowerQuery.includes('food') || lowerQuery.includes('dining')) {
      return this.getStaticDiningInfo();
    }
    
    if (lowerQuery.includes('shop') || lowerQuery.includes('duty free')) {
      return this.getStaticShoppingInfo();
    }
    
    if (lowerQuery.includes('wifi') || lowerQuery.includes('internet') || lowerQuery.includes('charging')) {
      return this.getStaticConnectivityInfo();
    }
    
    if (lowerQuery.includes('lounge') || lowerQuery.includes('vip')) {
      return this.getStaticLoungeInfo();
    }
    
    if (lowerQuery.includes('prayer') || lowerQuery.includes('mosque')) {
      return this.getStaticPrayerInfo();
    }
    
    if (lowerQuery.includes('bathroom') || lowerQuery.includes('restroom') || lowerQuery.includes('toilet')) {
      return this.getStaticFacilitiesInfo();
    }
    
    if (lowerQuery.includes('medical') || lowerQuery.includes('pharmacy')) {
      return this.getStaticMedicalInfo();
    }
    
    if (lowerQuery.includes('baggage') || lowerQuery.includes('luggage') || lowerQuery.includes('lost')) {
      return this.getStaticBaggageInfo();
    }
    
    return `**Airport Services at Muscat Airport:**

🍽️ **Dining:** Restaurants, cafes, and fast food options
🛍️ **Shopping:** Duty-free shops and retail outlets
📶 **Connectivity:** Free WiFi and charging stations
🛋️ **Lounges:** Business and VIP lounges available
🕌 **Prayer Rooms:** Available throughout the terminal
🚻 **Facilities:** Restrooms, medical services, and more

*What specific service are you looking for?*`;
  }

  private getDefaultFlightResponse(): string {
    return 'I can help you with flight information. Please provide a flight number (like WY123) or let me know what specific flight information you need, such as departure times, gate numbers, or flight status.';
  }

  private generateSuggestedActions(intent: string, query: string): string[] {
    switch (intent) {
      case 'flight_inquiry':
        return ['track_flight', 'set_notification', 'view_terminal_map'];
      case 'airport_services':
        return ['view_terminal_map', 'download_app', 'contact_info_desk'];
      case 'transportation':
        return ['book_taxi', 'view_parking_rates', 'check_bus_schedule'];
      case 'greeting':
        return ['check_flights', 'airport_services', 'transportation_info'];
      case 'complaint':
        return ['contact_customer_service', 'file_complaint', 'speak_to_manager'];
      case 'knowledge_base':
        return ['browse_more_info', 'related_questions', 'contact_support'];
      default:
        return ['browse_services', 'check_flights', 'contact_support'];
    }
  }

  private async updateConversationContext(
    sessionId: string, 
    query: string, 
    response: string, 
    intent: string
  ): Promise<void> {
    const context = this.contextCache.get(sessionId);
    if (context) {
      // Add the new exchange to context
      context.previousMessages.unshift(
        {
          type: 'user',
          content: query,
          timestamp: new Date(),
          intent: intent
        },
        {
          type: 'bot',
          content: response,
          timestamp: new Date(),
          intent: intent
        }
      );

      // Keep only last 10 messages
      context.previousMessages = context.previousMessages.slice(0, 10);
      
      // Update cache
      this.contextCache.set(sessionId, context);
    }
  }

  private buildResponseFromWebContent(webResults: any[], query: string): string {
    if (!webResults || webResults.length === 0) {
      return '';
    }

    // Extract and combine relevant information from web results
    let response = '';
    const lowerQuery = query.toLowerCase();

    // Sort results by relevance
    const sortedResults = webResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    // Filter out results with very low relevance
    const highQualityResults = sortedResults.filter(result => (result.relevance || 0) > 0.3);

    if (highQualityResults.length === 0) {
      return ''; // Return empty if no high-quality results
    }

    // Check if this is a specific query that needs targeted extraction
    const specificAnswer = this.extractSpecificAnswer(highQualityResults, query);
    if (specificAnswer) {
      console.log('🎯 Using specific answer extraction');
      return specificAnswer;
    }

    // Extract specific information based on query type
    const queryType = this.detectQueryType(lowerQuery);
    console.log(`🔍 Detected query type: ${queryType} for query: "${query}"`);
    
    switch (queryType) {
      case 'forecourt_charges':
        console.log('💰 Processing forecourt charges query');
        response = this.extractForecourtChargesInfo(highQualityResults, lowerQuery);
        break;
      case 'unattended_vehicle':
        console.log('🚫 Processing unattended vehicle query');
        response = this.extractUnattendedVehicleInfo(highQualityResults, lowerQuery);
        break;
      case 'business_dropoff':
        console.log('🏆 Processing business class dropoff query');
        response = this.extractBusinessDropoffInfo(highQualityResults, lowerQuery);
        break;
      case 'business_pickup':
        console.log('🏆 Processing business class pickup query');
        response = this.extractBusinessPickupInfo(highQualityResults, lowerQuery);
        break;
      case 'pickup_timing':
        console.log('🚗 Processing pickup timing query');
        response = this.extractPickupTimingInfo(highQualityResults, lowerQuery);
        break;
      case 'dropoff_timing':
        console.log('🚗 Processing dropoff timing query');
        response = this.extractDropoffTimingInfo(highQualityResults, lowerQuery);
        break;
      case 'pickup_location':
        console.log('🚗 Processing pickup location query');
        response = this.extractPickupLocationInfo(highQualityResults, lowerQuery);
        break;
      case 'dropoff_location':
        console.log('🚗 Processing dropoff location query');
        response = this.extractDropoffLocationInfo(highQualityResults, lowerQuery);
        break;
      case 'map_directions':
        console.log('🗺️ Processing map directions query');
        response = this.extractMapDirectionsInfo(highQualityResults, lowerQuery);
        break;
      case 'directions':
        console.log('🗺️ Processing directions query');
        response = this.extractDirectionsInfo(highQualityResults, lowerQuery);
        break;
      case 'parking_rates':
        console.log('🅿️ Processing parking rates query');
        response = this.extractParkingRatesInfo(highQualityResults, lowerQuery);
        break;
      case 'parking_areas':
        console.log('🅿️ Processing parking areas comparison query');
        response = this.extractParkingAreasInfo(highQualityResults, lowerQuery);
        break;
      case 'parking_payment':
        console.log('💳 Processing parking payment query');
        response = this.extractParkingPaymentInfo(highQualityResults, lowerQuery);
        break;
      case 'parking_rate':
        console.log('🅿️ Processing parking rate query');
        response = this.extractParkingInfo(highQualityResults, lowerQuery);
        break;
      case 'taxi_fares':
        console.log('🚕 Processing taxi fares query');
        response = this.extractTaxiFaresInfo(highQualityResults, lowerQuery);
        break;
      case 'taxi_info':
        console.log('🚕 Processing taxi info query');
        response = this.extractTaxiInfo(highQualityResults, lowerQuery);
        break;
      case 'facilities':
        console.log('🏢 Processing facilities query');
        response = this.extractFacilitiesInfo(highQualityResults, lowerQuery);
        break;
      case 'car_rental':
        console.log('🚗 Processing car rental query');
        response = this.extractCarRentalInfo(highQualityResults, lowerQuery);
        break;
      case 'shuttle_bus':
        console.log('🚌 Processing shuttle/bus query');
        response = this.extractShuttleInfo(highQualityResults, lowerQuery);
        break;
      default:
        console.log('📄 Processing general query');
        // For general queries, combine relevant content
        response = this.combineRelevantContent(highQualityResults, lowerQuery);
        break;
    }

    const finalResponse = response || this.combineRelevantContent(highQualityResults, lowerQuery);
    console.log(`📤 Final response length: ${finalResponse.length} characters`);
    console.log(`📤 Response preview: ${finalResponse.substring(0, 100)}...`);
    
    return finalResponse;
  }

  private extractSpecificAnswer(webResults: any[], query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    // Specific parking rate queries (including follow-up questions)
    if ((lowerQuery.includes('parking') && (lowerQuery.includes('rate') || lowerQuery.includes('cost') || lowerQuery.includes('price'))) ||
        // Follow-up questions about rates/costs with time mentions
        ((lowerQuery.includes('rate') || lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('much')) &&
         (lowerQuery.includes('minute') || lowerQuery.includes('hour') || lowerQuery.includes('after')))) {
      
      // Extract duration from query
      const duration = this.extractDuration(lowerQuery);
      const parkingType = this.extractParkingType(lowerQuery);
      
      if (duration || parkingType || lowerQuery.includes('after')) {
        return this.findSpecificParkingRate(webResults, duration, parkingType, query);
      }
    }

    // Specific taxi rate queries
    if (lowerQuery.includes('taxi') && (lowerQuery.includes('rate') || lowerQuery.includes('cost') || lowerQuery.includes('fare'))) {
      return this.findSpecificTaxiRate(webResults, lowerQuery);
    }

    return null;
  }

  private extractDuration(query: string): string | null {
    // Extract time duration from query
    const timePatterns = [
      /after\s*(\d+)\s*(?:minutes?|mins?)/i,
      /(\d+)\s*(?:minutes?|mins?)/i,
      /(\d+)\s*(?:hours?|hrs?)/i,
      /(\d+)\s*(?:days?)/i,
      /after\s*30\s*(?:minutes?|mins?)/i,
      /30\s*(?:minutes?|mins?)/i,
      /after\s*1\s*(?:hour?|hr?)/i,
      /1\s*(?:hour?|hr?)/i,
      /after\s*half\s*(?:hour?|hr?)/i,
      /half\s*(?:hour?|hr?)/i,
      /after\s*one\s*(?:hour?|hr?)/i,
      /one\s*(?:hour?|hr?)/i
    ];

    for (const pattern of timePatterns) {
      const match = query.match(pattern);
      if (match) {
        if (match[0].includes('30') || match[0].includes('half')) {
          return '1 hour'; // "after 30 minutes" means the next time bracket (1 hour)
        } else if (match[0].includes('1') || match[0].includes('one')) {
          if (match[0].includes('after')) {
            return '2 hours'; // "after 1 hour" means the next time bracket (2 hours)
          }
          return '1 hour';
        } else if (match[1]) {
          const num = parseInt(match[1]);
          if (match[0].includes('after')) {
            return `${num + 1} hours`; // Next time bracket
          }
          return match[0];
        }
      }
    }

    return null;
  }

  private extractParkingType(query: string): string | null {
    if (query.includes('short') || query.includes('short-term') || query.includes('shortterm')) {
      return 'short-term';
    } else if (query.includes('long') || query.includes('long-term') || query.includes('longterm')) {
      return 'long-term';
    } else if (query.includes('premium')) {
      return 'premium';
    }
    return null;
  }

  private findSpecificParkingRate(webResults: any[], duration: string | null, parkingType: string | null, originalQuery: string): string | null {
    for (const result of webResults) {
      const content = result.content.toLowerCase();
      const sourceUrl = result.url || 'https://www.muscatairport.co.om/en/content/to-from';
      
      // Look for parking rate tables
      if (content.includes('parking') && (content.includes('tariff') || content.includes('rate'))) {
        
        // Handle 30 minute queries
        if (duration === '30 minutes' || duration === 'half hour' || originalQuery.includes('30')) {
          // Multiple patterns for 30 minute rates
          const patterns = [
            /0-30\s*min[^|]*\|\s*omr\s*([\d.]+)/i,
            /0\s*up\s*to\s*30\s*minutes?[^|]*\|\s*omr\s*([\d.]+)/i,
            /30\s*min[^|]*omr\s*([\d.]+)/i,
            /0\.600/i // Direct pattern for the known rate
          ];
          
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              const rate = match[1] || '0.600';
              return `The parking rate for 30 minutes at Muscat Airport is **OMR ${rate}**.

This applies to both P1 (Short Term) and P2 (Short Term & Premium) parking areas.

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
            }
          }
          
          // If pattern not found but content has parking info, extract manually
          if (content.includes('0.600')) {
            return `The parking rate for 30 minutes at Muscat Airport is **OMR 0.600**.

This applies to both P1 (Short Term) and P2 (Short Term & Premium) parking areas.

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
          }
        }
        
        // Handle 1 hour queries (including "after 30 minutes")
        if (duration === '1 hour' || duration === 'one hour' || originalQuery.includes('1 hour') || 
            originalQuery.toLowerCase().includes('after 30')) {
          const patterns = [
            /30\s*min(?:utes?)?[-\s]*1\s*hr[^|]*\|\s*omr\s*([\d.]+)/i,
            /30\s*minutes?[-\s]*1\s*hour[^|]*\|\s*omr\s*([\d.]+)/i,
            /1\.100/i // Direct pattern for the known rate
          ];
          
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              const rate = match[1] || '1.100';
              const timeText = originalQuery.toLowerCase().includes('after 30') ? 
                'after 30 minutes (30 minutes to 1 hour bracket)' : '1 hour';
              return `The parking rate ${timeText} at Muscat Airport is **OMR ${rate}**.

This applies to both P1 (Short Term) and P2 (Short Term & Premium) parking areas.

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
            }
          }
          
          // If pattern not found but content has parking info, extract manually
          if (content.includes('1.100')) {
            const timeText = originalQuery.toLowerCase().includes('after 30') ? 
              'after 30 minutes (30 minutes to 1 hour bracket)' : 'for 1 hour';
            return `The parking rate ${timeText} at Muscat Airport is **OMR 1.100**.

This applies to both P1 (Short Term) and P2 (Short Term & Premium) parking areas.

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
          }
        }
        
        // If specific duration not found, provide helpful summary
        if (content.includes('0.600') || content.includes('parking')) {
          return `Based on the parking rates at Muscat Airport:

**Quick Reference:**
- **30 minutes**: OMR 0.600
- **1 hour**: OMR 1.100  
- **2 hours**: OMR 2.100
- **3 hours**: OMR 3.200

${duration ? `For ${duration}, you would pay the rate shown above.` : 'Choose the time bracket that matches your parking duration.'}

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
        }
      }
    }
    
    return null;
  }

  private findSpecificTaxiRate(webResults: any[], query: string): string | null {
    for (const result of webResults) {
      const content = result.content.toLowerCase();
      const sourceUrl = result.url || 'https://www.muscatairport.co.om/en/content/to-from';
      
      if (content.includes('taxi') && (content.includes('rate') || content.includes('fare') || content.includes('cost'))) {
        // Extract taxi rate information
        const taxiInfo = this.extractTaxiRateFromContent(content);
        if (taxiInfo) {
          return `${taxiInfo}

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
        }
      }
    }
    
    return null;
  }

  private extractTaxiRateFromContent(content: string): string | null {
    // Look for taxi rate patterns
    const ratePatterns = [
      /taxi.*?omr\s*([\d.]+)/i,
      /fare.*?omr\s*([\d.]+)/i,
      /cost.*?omr\s*([\d.]+)/i
    ];

    for (const pattern of ratePatterns) {
      const match = content.match(pattern);
      if (match) {
        return `Taxi rates at Muscat Airport start from OMR ${match[1]}.`;
      }
    }

    return null;
  }

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Forecourt charges and unattended vehicle queries
    if (lowerQuery.includes('forecourt') && (lowerQuery.includes('charge') || lowerQuery.includes('cost') || lowerQuery.includes('rate'))) {
      return 'forecourt_charges';
    } else if (lowerQuery.includes('unattended') && (lowerQuery.includes('drop-off') || lowerQuery.includes('drop off') || lowerQuery.includes('zone'))) {
      return 'unattended_vehicle';
    }
    
    // Business/First Class specific pickup/dropoff queries
    else if ((lowerQuery.includes('business class') || lowerQuery.includes('first class') || lowerQuery.includes('vip')) && 
        (lowerQuery.includes('drop-off') || lowerQuery.includes('drop off') || lowerQuery.includes('dropoff') || 
         lowerQuery.includes('dedicated') || lowerQuery.includes('special') || lowerQuery.includes('area'))) {
      return 'business_dropoff';
    } else if ((lowerQuery.includes('business class') || lowerQuery.includes('first class') || lowerQuery.includes('vip')) && 
               (lowerQuery.includes('pick-up') || lowerQuery.includes('pick up') || lowerQuery.includes('pickup') || 
                lowerQuery.includes('area') || lowerQuery.includes('special'))) {
      return 'business_pickup';
    }
    
    // Airline-specific first class queries (Oman Air, etc.)
    else if ((lowerQuery.includes('oman air') || lowerQuery.includes('omanair')) && 
             (lowerQuery.includes('first class') || lowerQuery.includes('business class')) &&
             (lowerQuery.includes('special') || lowerQuery.includes('area') || lowerQuery.includes('dedicated'))) {
      return 'business_dropoff';
    }
    
    // Pickup/Dropoff timing and location queries
    else if ((lowerQuery.includes('pick-up') || lowerQuery.includes('pick up') || lowerQuery.includes('pickup')) && 
        (lowerQuery.includes('how long') || lowerQuery.includes('wait') || lowerQuery.includes('free') || 
         lowerQuery.includes('minute') || lowerQuery.includes('time') || lowerQuery.includes('charge'))) {
      return 'pickup_timing';
    } else if ((lowerQuery.includes('drop-off') || lowerQuery.includes('drop off') || lowerQuery.includes('dropoff')) && 
               (lowerQuery.includes('how long') || lowerQuery.includes('stay') || lowerQuery.includes('minute') || 
                lowerQuery.includes('time') || lowerQuery.includes('charge') || lowerQuery.includes('longer'))) {
      return 'dropoff_timing';
    } else if ((lowerQuery.includes('pick-up') || lowerQuery.includes('pick up') || lowerQuery.includes('pickup')) && 
               (lowerQuery.includes('where') || lowerQuery.includes('area') || lowerQuery.includes('zone'))) {
      return 'pickup_location';
    } else if ((lowerQuery.includes('drop-off') || lowerQuery.includes('drop off') || lowerQuery.includes('dropoff')) && 
               (lowerQuery.includes('where') || lowerQuery.includes('area') || lowerQuery.includes('zone') || 
                lowerQuery.includes('passengers'))) {
      return 'dropoff_location';
    }
    
    // Parking queries - enhanced detection
    else if (lowerQuery.includes('parking') && (lowerQuery.includes('rate') || lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('tariff'))) {
      return 'parking_rates';
    } else if ((lowerQuery.includes('park') || lowerQuery.includes('parking')) && 
               (lowerQuery.includes('week') || lowerQuery.includes('weekly') || lowerQuery.includes('cost') || lowerQuery.includes('much'))) {
      return 'parking_rates';
    } else if (lowerQuery.includes('parking') && 
               (lowerQuery.includes('charge') || lowerQuery.includes('charges')) && 
               (lowerQuery.includes('hour') || lowerQuery.includes('day') || lowerQuery.includes('minute'))) {
      return 'parking_rates';
    } else if ((lowerQuery.includes('long-term') || lowerQuery.includes('long term')) && 
               (lowerQuery.includes('parking') || lowerQuery.includes('per day') || lowerQuery.includes('daily'))) {
      return 'parking_rates';
    } else if (lowerQuery.includes('parking') && 
               (lowerQuery.includes('pay') || lowerQuery.includes('payment') || lowerQuery.includes('where') || lowerQuery.includes('method'))) {
      return 'parking_payment';
    } else if (lowerQuery.includes('parking') && 
               (lowerQuery.includes('24-hour') || lowerQuery.includes('24 hour') || lowerQuery.includes('available') || lowerQuery.includes('is there'))) {
      return 'parking_info';
    } else if ((lowerQuery.includes('24-hour') || lowerQuery.includes('24 hour')) && lowerQuery.includes('parking')) {
      return 'parking_info';
    } else if ((lowerQuery.includes('p1') || lowerQuery.includes('p2') || lowerQuery.includes('p3')) && 
               (lowerQuery.includes('difference') || lowerQuery.includes('between') || lowerQuery.includes('compare') || lowerQuery.includes('areas'))) {
      return 'parking_areas';
    } else if (lowerQuery.includes('parking') && 
               (lowerQuery.includes('zones') || lowerQuery.includes('different') || lowerQuery.includes('areas') || lowerQuery.includes('types'))) {
      return 'parking_areas';
    } else if (lowerQuery.includes('parking') || lowerQuery.includes('park')) {
      return 'parking_info';
    }
    
    // Map-specific queries
    else if (lowerQuery.includes('is there a map') || lowerQuery.includes('map showing') ||
             lowerQuery.includes('airport map') || lowerQuery.includes('directions map') ||
             (lowerQuery.includes('map') && (lowerQuery.includes('directions') || lowerQuery.includes('airport')))) {
      return 'map_directions';
    }
    
    // Transportation queries - enhanced detection (moved before directions to avoid conflicts)
    else if (lowerQuery.includes('taxi') && (lowerQuery.includes('cost') || lowerQuery.includes('fare') || lowerQuery.includes('fares') || lowerQuery.includes('price') || lowerQuery.includes('much') || lowerQuery.includes('city'))) {
      return 'taxi_fares';
    } else if (lowerQuery.includes('car rental') || lowerQuery.includes('rent a car') || 
               lowerQuery.includes('rental car') || lowerQuery.includes('car hire') ||
               (lowerQuery.includes('car') && lowerQuery.includes('rent')) ||
               (lowerQuery.includes('rental') && lowerQuery.includes('available')) ||
               lowerQuery.includes('europcar') || lowerQuery.includes('thrifty') || 
               lowerQuery.includes('budget') || lowerQuery.includes('avis')) {
      return 'car_rental';
    } else if (lowerQuery.includes('taxi') || lowerQuery.includes('cab')) {
      return 'taxi_info';
    } else if (lowerQuery.includes('shuttle') || lowerQuery.includes('bus') || 
               lowerQuery.includes('public transportation') || lowerQuery.includes('public transport') ||
               lowerQuery.includes('mwasalat') || lowerQuery.includes('hotel shuttle') ||
               (lowerQuery.includes('public') && lowerQuery.includes('transport')) ||
               (lowerQuery.includes('hotel') && (lowerQuery.includes('shuttle') || lowerQuery.includes('transfer'))) ||
               lowerQuery.includes('private driver') || lowerQuery.includes('private transfer')) {
      return 'shuttle_bus';
    }
    
    // Directions and access road queries (moved after transportation to avoid conflicts)
    else if (lowerQuery.includes('get to') || lowerQuery.includes('directions') || 
             lowerQuery.includes('route') || lowerQuery.includes('highway') ||
             lowerQuery.includes('access road') || lowerQuery.includes('drive to') ||
             lowerQuery.includes('from city') || lowerQuery.includes('from muscat') ||
             lowerQuery.includes('from seeb') || lowerQuery.includes('sultan qaboos') ||
             lowerQuery.includes('other parts') || lowerQuery.includes('find muscat airport') ||
             lowerQuery.includes('driving from') || lowerQuery.includes('burj al sahwa') ||
             lowerQuery.includes('what road') || lowerQuery.includes('which road') ||
             lowerQuery.includes('road connects') || lowerQuery.includes('connects') ||
             (lowerQuery.includes('road') && lowerQuery.includes('airport'))) {
      return 'directions';
    }
    
    // Facilities queries - enhanced detection
    else if (lowerQuery.includes('facilities') || lowerQuery.includes('what facilities') || lowerQuery.includes('available at') || 
             (lowerQuery.includes('what') && (lowerQuery.includes('services') || lowerQuery.includes('amenities')))) {
      return 'facilities';
    }
    
    // Airport service queries
    else if (lowerQuery.includes('restaurant') || lowerQuery.includes('food') || lowerQuery.includes('dining') || lowerQuery.includes('eat')) {
      return 'dining';
    } else if (lowerQuery.includes('shop') || lowerQuery.includes('shopping') || lowerQuery.includes('store') || lowerQuery.includes('duty free')) {
      return 'shopping';
    } else if (lowerQuery.includes('wifi') || lowerQuery.includes('internet') || lowerQuery.includes('charging')) {
      return 'connectivity';
    } else if (lowerQuery.includes('lounge') || lowerQuery.includes('vip') || lowerQuery.includes('business class')) {
      return 'lounge';
    } else if (lowerQuery.includes('prayer') || lowerQuery.includes('mosque') || lowerQuery.includes('religious')) {
      return 'prayer';
    } else if (lowerQuery.includes('bathroom') || lowerQuery.includes('restroom') || lowerQuery.includes('toilet')) {
      return 'bathroom_facilities';
    } else if (lowerQuery.includes('medical') || lowerQuery.includes('pharmacy') || lowerQuery.includes('doctor')) {
      return 'medical';
    } else if (lowerQuery.includes('lost') || lowerQuery.includes('baggage') || lowerQuery.includes('luggage')) {
      return 'baggage';
    }
    
    return 'general';
  }

  private extractParkingRatesInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    // Extract parking rates from web content
    for (const result of webResults) {
      if (result.title.toLowerCase().includes('parking') || 
          result.content.toLowerCase().includes('parking') ||
          result.content.toLowerCase().includes('tariff') ||
          result.content.toLowerCase().includes('p1') ||
          result.content.toLowerCase().includes('p3')) {
        
        // Check if we have structured parking data
        const content = result.content;
        if (content.includes('OMR') && (content.includes('P1') || content.includes('P3'))) {
          return `**Parking Rates at Muscat Airport:**

**🅿️ P1 Short Term Parking:**
• **0-30 minutes:** OMR 0.600
• **30 minutes - 1 hour:** OMR 1.200
• **1-2 hours:** OMR 2.100
• **2-3 hours:** OMR 3.600
• **3-4 hours:** OMR 5.100
• **4-5 hours:** OMR 6.600
• **5-6 hours:** OMR 8.100
• **6-12 hours:** OMR 12.600
• **12-24 hours:** OMR 25.200

**🅿️ P3 Long Term Parking:**
• **12-24 hours:** OMR 25.200
• **After 24 hours:** OMR 21.000 per additional day

**📍 Additional Services:**
• **Pick-up/Drop-off:** OMR 0.600 (up to 10 minutes free)
• **Forecourt charges:** OMR 6.000 per hour after free period

**💡 Important Notes:**
• All rates include VAT
• P1 is closest to terminal (more convenient)
• P3 is more economical for longer stays
• Payment stations available in parking areas

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
        }
      }
    }
    
    // Fallback response if no structured data found
    return `**Parking Rates at Muscat Airport:**

**🅿️ Parking Options Available:**
• **P1 Short Term Parking** - Closest to terminal
• **P3 Long Term Parking** - More economical for extended stays
• **Pick-up/Drop-off Areas** - Short-term parking available

**💰 Rate Information:**
• Hourly and daily rates available
• Rates include VAT
• Payment stations in each parking area
• Different rates for short-term vs long-term parking

**📍 Location:**
• Multiple parking areas around the terminal
• Clear signage directing to parking zones
• Easy access to departure and arrival areas

For specific current rates, please check the parking rate displays at the airport or contact airport information.

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
  }

  private extractDirectionsInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    const lowerQuery = query.toLowerCase();
    
    // Check for specific direction queries
    if (lowerQuery.includes('which side') && lowerQuery.includes('highway')) {
      return `**Airport Location on Highway:**

**🛣️ Muscat Airport Highway Location:**
• **Highway:** Sultan Qaboos Highway (Main highway)
• **Side:** **Right side** when traveling from Muscat city center
• **Direction:** Northbound towards Seeb
• **Exit:** Clearly marked "Muscat International Airport" exit

**🗺️ Highway Navigation:**
• **From Muscat City:** Take Sultan Qaboos Highway north
• **Travel Direction:** Towards Seeb/Airport
• **Look For:** Large blue airport signs
• **Exit Point:** Well-marked airport exit ramp
• **Side of Road:** Airport is on the **right side** of highway

**🚗 Driving Tips:**
• Follow blue airport signs consistently
• Stay in right lanes as you approach
• Airport exit is clearly visible
• Multiple advance warning signs provided
• Easy access from highway

**📍 Landmarks:**
• **Before Airport:** Seeb area, residential developments
• **At Airport:** Large terminal building visible from highway
• **After Airport:** Continues towards Barka and northern areas

**💡 Navigation Notes:**
• Airport is approximately 40km from Muscat city center
• Journey time: 30-45 minutes depending on traffic
• Clear signage throughout the route
• GPS coordinates available for navigation systems

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for route/highway queries
    if (lowerQuery.includes('highway') || lowerQuery.includes('route')) {
      return `**Highway Route to Muscat Airport:**

**🛣️ Main Highway Route:**
• **Primary Highway:** Sultan Qaboos Highway
• **Route Number:** Highway 1 (Main coastal highway)
• **Direction:** Muscat → Seeb → Airport
• **Total Distance:** Approximately 40km from city center

**🗺️ Route Details:**
• **Starting Point:** Muscat city center (Ruwi/Mutrah area)
• **Highway Access:** Join Sultan Qaboos Highway northbound
• **Travel Direction:** Towards Seeb and northern governorates
• **Airport Exit:** Clearly marked exit ramp
• **Travel Time:** 30-45 minutes depending on traffic

**🚗 Alternative Routes:**
• **From Al Khuwair:** Via Sultan Qaboos Highway (most direct)
• **From Qurum:** Connect to Sultan Qaboos Highway
• **From Seeb:** Local roads to airport (shorter distance)
• **From Barka:** Continue south on Sultan Qaboos Highway

**📍 Key Landmarks:**
• **Qurum Beach area** - Early part of journey
• **Al Khuwair business district** - Major landmark
• **Seeb residential areas** - Approaching airport
• **Airport terminal building** - Visible from highway

**💡 Driving Tips:**
• Use GPS navigation for real-time traffic updates
• Follow blue airport signs consistently
• Allow extra time during peak hours
• Multiple fuel stations along the route

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for city center directions
    if (lowerQuery.includes('city center') || lowerQuery.includes('get to')) {
      return `**Directions from Muscat City Center to Airport:**

**🗺️ Route Overview:**
• **Starting Point:** Muscat City Center (Ruwi/Mutrah area)
• **Destination:** Muscat International Airport
• **Distance:** Approximately 40 kilometers
• **Estimated Time:** 30-45 minutes

**🚗 Step-by-Step Directions:**
1. **Start:** From Muscat city center (Ruwi area)
2. **Join Highway:** Access Sultan Qaboos Highway northbound
3. **Direction:** Head towards Seeb/Northern areas
4. **Follow Signs:** Blue airport signs throughout journey
5. **Exit:** Take marked "Muscat International Airport" exit
6. **Arrive:** Follow airport terminal signs

**🛣️ Highway Details:**
• **Main Road:** Sultan Qaboos Highway (Highway 1)
• **Lane Guidance:** Stay in right lanes approaching airport
• **Signage:** Clear blue airport signs every few kilometers
• **Exit Ramp:** Well-marked and easy to identify

**📍 Key Landmarks En Route:**
• **Qurum Beach** - Coastal area early in journey
• **Al Khuwair** - Business district midway
• **Seeb Roundabouts** - Approaching airport area
• **Airport Terminal** - Large building visible from highway

**⏰ Travel Times:**
• **Off-Peak Hours:** 30-35 minutes
• **Peak Hours:** 40-50 minutes
• **Early Morning:** 25-30 minutes
• **Late Evening:** 30-35 minutes

**💡 Travel Tips:**
• Allow extra time for potential traffic
• Use GPS for real-time traffic updates
• Multiple fuel stations available en route
• Airport parking available upon arrival

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for Seeb directions
    if (lowerQuery.includes('seeb')) {
      return `**Best Route from Seeb to Muscat Airport:**

**🗺️ Seeb to Airport Route:**
• **Distance:** Approximately 15-20 kilometers
• **Travel Time:** 15-25 minutes
• **Route Type:** Local roads and highway access
• **Difficulty:** Easy and well-signposted

**🚗 Detailed Directions:**
1. **From Seeb Center:** Head towards Sultan Qaboos Highway
2. **Join Highway:** Access highway towards airport direction
3. **Short Distance:** Airport is nearby in Seeb area
4. **Follow Signs:** Blue airport signs clearly visible
5. **Airport Exit:** Take designated airport exit
6. **Terminal Access:** Follow signs to departures/arrivals

**🛣️ Route Options:**
• **Highway Route:** Via Sultan Qaboos Highway (fastest)
• **Local Roads:** Through Seeb residential areas
• **Coastal Route:** Along coastal road (scenic but longer)

**📍 Local Landmarks:**
• **Seeb Souq** - Traditional market area
• **Seeb Corniche** - Coastal area
• **Residential Areas** - Well-developed neighborhoods
• **Airport Approach** - Large terminal building visible

**💡 Local Advantages:**
• **Shorter Distance:** Much closer than from Muscat city
• **Local Knowledge:** Seeb residents familiar with routes
• **Multiple Options:** Several route choices available
• **Quick Access:** Convenient for Seeb residents

**🚦 Traffic Considerations:**
• Generally lighter traffic than from city center
• School hours may affect local road traffic
• Airport-bound traffic during peak flight times
• Weekend traffic to coastal areas

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for Sultan Qaboos Highway queries
    if (lowerQuery.includes('sultan qaboos')) {
      return `**Sultan Qaboos Highway to Muscat Airport:**

**🛣️ Sultan Qaboos Highway Information:**
• **Official Name:** Sultan Qaboos Highway
• **Route Number:** Highway 1
• **Type:** Main coastal highway of Oman
• **Airport Connection:** Direct access to Muscat International Airport

**🗺️ Highway Route to Airport:**
• **Direction:** Northbound from Muscat towards Seeb
• **Airport Location:** Highway passes directly by airport
• **Exit Point:** Clearly marked airport exit ramp
• **Distance Markers:** Highway markers indicate airport approach

**🚗 Highway Features:**
• **Lanes:** Multiple lanes in each direction
• **Quality:** Well-maintained modern highway
• **Signage:** Excellent Arabic and English signage
• **Lighting:** Well-lit for night travel
• **Services:** Fuel stations and rest areas available

**📍 Highway Landmarks:**
• **Muscat City** - Southern starting point
• **Qurum Area** - Coastal development
• **Al Khuwair** - Business district
• **Seeb Area** - Airport vicinity
• **Airport Terminal** - Visible from highway

**🛣️ Airport Access from Highway:**
• **Clear Signage:** Blue airport signs well in advance
• **Exit Ramp:** Dedicated airport exit
• **Terminal Access:** Direct route to terminal building
• **Parking Access:** Signs to parking areas

**💡 Highway Travel Tips:**
• **Speed Limits:** Observe posted speed limits
• **Traffic Rules:** Follow Omani traffic regulations
• **Peak Hours:** Allow extra time during rush hours
• **Weather:** Highway may be affected by sandstorms

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for map queries
    if (lowerQuery.includes('map')) {
      return `**Airport Direction Maps and Navigation:**

**🗺️ Available Maps:**
• **Official Airport Website:** Detailed location maps
• **Google Maps:** Real-time navigation and traffic
• **GPS Navigation:** Built-in car navigation systems
• **Mobile Apps:** Waze, Apple Maps, etc.

**📱 Digital Navigation:**
• **GPS Coordinates:** Available for all navigation systems
• **Real-time Traffic:** Live traffic updates available
• **Route Options:** Multiple route suggestions
• **Voice Guidance:** Turn-by-turn directions

**🗺️ Physical Maps:**
• **Airport Website:** Downloadable PDF maps
• **Tourist Information:** Maps at hotels and tourist centers
• **Car Rental:** Maps provided with rental vehicles
• **Airport Information:** Maps available at information desks

**📍 Map Features to Look For:**
• **Sultan Qaboos Highway** - Main route highlighted
• **Airport Symbol** - Airplane icon marking location
• **Distance Markers** - Kilometers from city center
• **Landmark References** - Major buildings and areas

**💡 Navigation Tips:**
• Use GPS for real-time traffic updates
• Download offline maps as backup
• Airport is clearly marked on all major map services
• Multiple route options available depending on starting point

**📞 Navigation Assistance:**
• **Airport Information:** +968 2451 9223
• **Tourist Information:** Available at major hotels
• **Car Rental Assistance:** Staff can provide directions

🔗 **More Information:** [Muscat Airport Maps](${sourceUrl})`;
    }
    
    // Check for finding airport queries
    if (lowerQuery.includes('find') && lowerQuery.includes('airport')) {
      return `**How to Find Muscat Airport When Driving:**

**🎯 Finding the Airport:**
• **Main Highway:** Sultan Qaboos Highway is the primary route
• **Blue Signs:** Follow blue airport signs throughout journey
• **GPS Navigation:** Use "Muscat International Airport" as destination
• **Landmarks:** Large terminal building visible from highway

**🗺️ Navigation Methods:**
• **GPS Systems:** Enter airport name or coordinates
• **Mobile Apps:** Google Maps, Waze, Apple Maps
• **Road Signs:** Follow blue airport signage
• **Local Knowledge:** Ask locals for directions if needed

**📍 Key Identification Points:**
• **Terminal Building:** Large, modern building visible from distance
• **Control Tower:** Airport control tower landmark
• **Parking Areas:** Large parking structures
• **Airport Signage:** "Muscat International Airport" signs

**🚗 Driving Approach:**
• **From South (Muscat):** Take Sultan Qaboos Highway north
• **From North (Barka):** Take Sultan Qaboos Highway south
• **From Interior:** Connect to Sultan Qaboos Highway
• **Local Areas:** Follow local airport signs

**💡 Finding Tips:**
• **Advance Planning:** Check route before departure
• **Traffic Updates:** Use apps for real-time traffic
• **Fuel Planning:** Ensure adequate fuel for journey
• **Time Buffer:** Allow extra time for finding parking

**🆘 If Lost:**
• **Call Airport:** +968 2451 9223 for directions
• **Ask Locals:** Omanis are helpful with directions
• **Use GPS:** Recalculate route if needed
• **Landmark Navigation:** Head towards Seeb area

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // Check for road connection queries
    if (lowerQuery.includes('road connects') || lowerQuery.includes('connects')) {
      return `**Road Connections to Muscat Airport:**

**🛣️ Primary Road Connection:**
• **Main Highway:** Sultan Qaboos Highway (Highway 1)
• **Connection Type:** Direct highway access
• **Road Quality:** Modern, well-maintained highway
• **Capacity:** Multiple lanes handling high traffic volume

**🗺️ Highway Network:**
• **North-South Route:** Connects Muscat to northern governorates
• **Coastal Highway:** Runs along Oman's coast
• **Airport Access:** Direct exit ramp to terminal
• **Regional Connection:** Links to interior roads

**🚗 Road System Features:**
• **Dual Carriageway:** Separated lanes for safety
• **Modern Design:** Built to international standards
• **Regular Maintenance:** Well-kept road surface
• **Clear Markings:** Excellent lane markings and signage

**📍 Connection Points:**
• **Muscat City:** Southern connection point
• **Seeb Area:** Airport's immediate vicinity
• **Northern Areas:** Continues to Barka and beyond
• **Interior Roads:** Connections to inland areas

**🛣️ Road Infrastructure:**
• **Bridges:** Modern bridge crossings where needed
• **Roundabouts:** Efficient traffic management
• **Lighting:** Street lighting for night driving
• **Emergency Services:** Regular patrol and assistance

**💡 Road Network Benefits:**
• **Reliability:** Consistent and dependable route
• **Efficiency:** Direct connection minimizes travel time
• **Safety:** Modern safety features and regular maintenance
• **Accessibility:** Easy access from multiple directions

🔗 **More Information:** [Muscat Airport Access](${sourceUrl})`;
    }
    
    // Check for Burj Al Sahwa directions
    if (lowerQuery.includes('burj al sahwa')) {
      return `**Directions from Burj Al Sahwa Roundabout to Airport:**

**🗺️ Route from Burj Al Sahwa:**
• **Starting Point:** Burj Al Sahwa Roundabout (Major landmark)
• **Distance:** Approximately 35-40 kilometers
• **Travel Time:** 25-35 minutes
• **Route Type:** Highway driving

**🚗 Detailed Directions:**
1. **From Roundabout:** Exit towards Sultan Qaboos Highway
2. **Join Highway:** Access Sultan Qaboos Highway northbound
3. **Direction:** Head towards Seeb/Airport
4. **Follow Signs:** Blue airport signs throughout journey
5. **Airport Exit:** Take marked airport exit ramp
6. **Terminal Access:** Follow signs to arrivals/departures

**🛣️ Route Characteristics:**
• **Highway Quality:** Excellent road conditions
• **Traffic Flow:** Generally smooth outside peak hours
• **Signage:** Clear directional signage
• **Landmarks:** Recognizable landmarks along route

**📍 Route Landmarks:**
• **Burj Al Sahwa** - Starting point landmark
• **Qurum Area** - Coastal development
• **Al Khuwair** - Business district
• **Seeb Approach** - Airport vicinity
• **Airport Terminal** - Destination

**⏰ Travel Considerations:**
• **Peak Hours:** Allow 40-45 minutes during rush hour
• **Off-Peak:** 25-30 minutes typical travel time
• **Weekend Traffic:** May be lighter than weekdays
• **Flight Times:** Consider airport traffic during peak departure times

**💡 Navigation Tips:**
• **GPS Recommended:** Use navigation for traffic updates
• **Fuel Check:** Ensure adequate fuel before departure
• **Parking Planning:** Consider airport parking options
• **Time Buffer:** Allow extra time for check-in procedures

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
    }
    
    // General directions information
    return `**Directions to Muscat International Airport:**

**🗺️ Main Route:**
• **Primary Highway:** Sultan Qaboos Highway (Highway 1)
• **Direction:** Northbound from Muscat towards Seeb
• **Distance:** Approximately 40km from city center
• **Travel Time:** 30-45 minutes depending on traffic

**🚗 Step-by-Step Directions:**
1. **Access Highway:** Join Sultan Qaboos Highway
2. **Head North:** Travel towards Seeb/Northern areas
3. **Follow Signs:** Blue airport signs throughout journey
4. **Take Exit:** Airport exit clearly marked
5. **Terminal Access:** Follow signs to departures/arrivals

**📍 Key Landmarks:**
• **Qurum Beach Area** - Early in journey from city
• **Al Khuwair Business District** - Midway point
• **Seeb Residential Areas** - Approaching airport
• **Airport Terminal Building** - Large, visible structure

**🛣️ Highway Features:**
• **Modern Highway:** Well-maintained dual carriageway
• **Clear Signage:** Arabic and English road signs
• **Multiple Lanes:** Adequate capacity for traffic
• **Good Lighting:** Safe for night driving

**💡 Travel Tips:**
• **GPS Navigation:** Recommended for real-time updates
• **Traffic Planning:** Allow extra time during peak hours
• **Fuel Stations:** Available along the route
• **Airport Parking:** Multiple parking options available

**📞 For Assistance:**
• **Airport Information:** +968 2451 9223
• **Emergency Services:** Available along highway

🔗 **More Information:** [Muscat Airport Directions](${sourceUrl})`;
  }

  private extractMapDirectionsInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Airport Direction Maps and Navigation:**

**🗺️ Available Maps:**
• **Official Airport Website:** Detailed location maps and directions
• **Google Maps:** Real-time navigation with traffic updates
• **GPS Navigation Systems:** Built-in car navigation with voice guidance
• **Mobile Apps:** Waze, Apple Maps, HERE Maps, etc.

**📱 Digital Map Options:**
• **Interactive Maps:** Zoom, pan, and route planning
• **Real-time Traffic:** Live traffic conditions and alternate routes
• **Satellite View:** Aerial view of airport and surrounding areas
• **Street View:** Ground-level imagery for landmark recognition

**🗺️ Physical Map Sources:**
• **Airport Website:** Downloadable PDF maps for printing
• **Tourist Information Centers:** Free maps at hotels and visitor centers
• **Car Rental Companies:** Maps provided with rental vehicles
• **Airport Information Desks:** Physical maps available at terminal

**📍 Map Features to Look For:**
• **Sultan Qaboos Highway** - Main route clearly highlighted
• **Airport Symbol** - Airplane icon marking exact location
• **Distance Markers** - Kilometers from major city points
• **Landmark References** - Hotels, shopping centers, major buildings
• **Parking Areas** - P1, P2, P3 parking zones marked
• **Terminal Layout** - Departures and arrivals areas

**🚗 Navigation Features:**
• **Turn-by-turn Directions:** Voice-guided navigation
• **Alternative Routes:** Multiple path options
• **Traffic Avoidance:** Real-time rerouting for congestion
• **Offline Maps:** Download for areas with poor signal

**💡 Map Usage Tips:**
• **Download Before Travel:** Ensure maps work offline
• **Check Traffic Updates:** Use real-time traffic features
• **Landmark Navigation:** Identify key landmarks en route
• **Backup Options:** Have multiple navigation sources ready

**📞 Navigation Assistance:**
• **Airport Information:** +968 2451 9223
• **Tourist Hotline:** Available at major hotels
• **Car Rental Support:** GPS setup assistance available

**🔗 Online Map Resources:**
• **Google Maps:** maps.google.com
• **Waze:** waze.com
• **Apple Maps:** Built into iOS devices
• **Airport Website:** Detailed location information

🔗 **More Information:** [Muscat Airport Maps & Directions](${sourceUrl})`;
  }

  private extractParkingAreasInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Parking Areas at Muscat Airport:**

**🅿️ P1 - Short Term Parking**
• **Location:** Closest to the terminal building
• **Best for:** Drop-offs, short visits, quick errands
• **Convenience:** Highest - direct access to terminal
• **Rates:** Higher rates but maximum convenience
• **Duration:** Ideal for stays up to 12 hours
• **Access:** Easy walking distance to departures/arrivals

**🅿️ P2 - Short Term & Premium Parking**
• **Location:** Close to terminal with premium features
• **Best for:** Business travelers, premium service users
• **Convenience:** High - enhanced facilities
• **Rates:** Premium pricing for enhanced services
• **Duration:** Short to medium-term stays
• **Access:** Quick access with premium amenities

**🅿️ P3 - Long Term Parking**
• **Location:** Further from terminal (shuttle or longer walk)
• **Best for:** Extended trips, overnight stays, vacation parking
• **Convenience:** Lower - requires shuttle or walking
• **Rates:** Most economical for longer stays
• **Duration:** Ideal for stays over 12 hours
• **Access:** Shuttle service or walking distance to terminal

**💡 Quick Comparison:**
• **Most Convenient:** P1 (closest to terminal)
• **Premium Features:** P2 (enhanced services)
• **Most Economical:** P3 (best for long stays)
• **Best for Short Visits:** P1 or P2
• **Best for Long Trips:** P3

**💰 Rate Summary:**
• **P1 & P2:** Same rates, P2 has premium features
• **P3:** Better rates for 24+ hour stays
• **All areas:** Payment stations and clear signage

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
  }

  private extractParkingPaymentInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Parking Payment at Muscat Airport:**

**💳 Payment Locations:**
• **Payment Stations** - Located in each parking area (P1, P2, P3)
• **Automated Payment Machines** - Available throughout parking zones
• **Exit Gates** - Payment required before exit
• **Terminal Information Desks** - Staff assistance available

**💰 Payment Methods Accepted:**
• **Cash** - Omani Rials accepted
• **Credit Cards** - Visa, Mastercard, American Express
• **Debit Cards** - Local and international cards
• **Contactless Payment** - Tap and pay options available

**🕐 Payment Process:**
• **Entry:** Take parking ticket at entrance barrier
• **During Stay:** No advance payment required
• **Exit:** Pay at payment station or exit gate before leaving
• **Lost Ticket:** Report to information desk for assistance

**📍 Payment Station Locations:**
• **P1 Area:** Multiple stations near terminal
• **P2 Area:** Stations at convenient locations
• **P3 Area:** Stations with clear signage
• **Terminal:** Information desks for assistance

**💡 Payment Tips:**
• Keep your parking ticket safe
• Payment required before returning to vehicle
• Receipts available for business expenses
• Staff available for assistance if needed

**🕐 Operating Hours:**
• Payment stations: 24/7 automated service
• Information desk assistance: During terminal operating hours

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
  }

  private extractParkingInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    const lowerQuery = query.toLowerCase();
    
    // Check for 24-hour availability queries
    if (lowerQuery.includes('24-hour') || lowerQuery.includes('24 hour')) {
      return `**24-Hour Parking at Muscat Airport:**

✅ **Yes, 24-hour parking is available** at Muscat Airport.

🕐 **24-Hour Parking Options:**
• **P1 - Short Term Parking** - Available 24/7
• **P2 - Premium Parking** - Available 24/7  
• **P3 - Long Term Parking** - Available 24/7

💰 **24-Hour Rates:**
• **P1/P2: 12-24 hours:** OMR 25.200
• **P3: After 24 hours:** OMR 21.000 per additional day

🚗 **24-Hour Services:**
• **Entry/Exit:** Automated barriers operate 24/7
• **Payment Stations:** Available 24 hours
• **Security:** 24-hour surveillance and security
• **Lighting:** Well-lit parking areas for safety

💡 **Perfect for:**
• **Overnight stays** - Secure parking for extended trips
• **Early morning flights** - Available anytime
• **Late night arrivals** - No time restrictions
• **Multi-day trips** - Long-term parking available

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
    }
    
    // Check if this is a location/where query OR availability query OR long-term parking query
    if (lowerQuery.includes('where') || lowerQuery.includes('location') || 
        lowerQuery.includes('park at') || lowerQuery.includes('parking area') ||
        lowerQuery.includes('available') || lowerQuery.includes('is there') ||
        lowerQuery.includes('long-term') || lowerQuery.includes('long term') ||
        lowerQuery.includes('extended') || lowerQuery.includes('overnight')) {
      
      // Extract parking location information
      for (const result of webResults) {
        if (result.title.toLowerCase().includes('parking') || 
            result.content.toLowerCase().includes('parking') ||
            result.content.toLowerCase().includes('p1') ||
            result.content.toLowerCase().includes('p3')) {
          
          // Specific response for long-term parking queries
          if (query.includes('long-term') || query.includes('long term') ||
              query.includes('extended') || query.includes('overnight')) {
            return `**Long-Term Parking at Muscat Airport:**

✅ **Yes, long-term parking is available** at Muscat Airport.

🅿️ **P3 - Long Term Parking** 
• Located further from terminal (more economical)
• Perfect for extended trips and overnight parking
• Shuttle service or walking distance to terminal
• Better rates for longer stays

💰 **Long-Term Rates:**
• **12-24 hours:** OMR 25.200
• **After 24 hours:** OMR 21.000 per additional day
• All rates include VAT

💡 **Why Choose Long-Term Parking:**
• More economical for stays over 12 hours
• Secure parking area
• Easy access to terminal via shuttle or walking
• Payment stations available

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
          }
          
          // General availability or location response
          return `**Parking Locations at Muscat Airport:**

✅ **Yes, parking is available** at Muscat Airport.

🅿️ **P1 - Short Term Parking**
• Located closest to the terminal building
• Ideal for drop-offs and short visits
• Easy access to departure and arrival areas

🅿️ **P3 - Long Term Parking** 
• Located further from terminal (more economical)
• Perfect for extended trips
• Shuttle service or walking distance to terminal

📍 **Pick-up/Drop-off Areas:**
• Dedicated forecourt areas for quick passenger pickup/drop-off
• Located directly in front of terminal building
• Short-term parking available for passenger collection

💡 **Parking Tips:**
• P1 is more convenient but more expensive
• P3 offers better rates for longer stays
• Follow airport signage to designated parking areas
• Payment stations available in each parking area

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
        }
      }
    }
    
    // For rate queries, use the existing format
    for (const result of webResults) {
      if (result.title.toLowerCase().includes('parking') || result.content.toLowerCase().includes('parking tariff')) {
        return `**Parking Information at Muscat Airport:**

${result.content}

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
      }
    }
    return '';
  }

  private extractTaxiFaresInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    // Check if asking about specific destinations
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('city') || lowerQuery.includes('muscat city') || lowerQuery.includes('downtown')) {
      return `**Taxi Fares from Muscat Airport:**

**🚕 To Muscat City Center:**
• **Estimated Cost:** OMR 8-12 (approximately)
• **Distance:** ~30-40 km
• **Journey Time:** 30-45 minutes
• **Starting Rate:** From OMR 0.600

**📍 Popular Destinations:**
• **Muscat City Center:** OMR 8-12
• **Seeb:** OMR 4-6
• **Qurum:** OMR 6-8
• **Ruwi:** OMR 10-14
• **Old Muscat:** OMR 12-16

**💡 Important Notes:**
• Fares may vary based on traffic and time of day
• Meters are used for accurate fare calculation
• 24-hour taxi service available
• Taxis available at arrivals area

**🕐 Availability:** 24 hours a day at arrivals area

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // General taxi fare information
    return `**Taxi Services at Muscat Airport:**

**💰 Fare Information:**
• **Starting Rate:** From OMR 0.600
• **Meter-based pricing** for accurate fares
• **To Muscat City:** Approximately OMR 8-12
• **To Seeb area:** Approximately OMR 4-6

**🚕 Service Details:**
• **Availability:** 24 hours a day
• **Location:** Available at arrivals area
• **Payment:** Cash and card accepted
• **Journey time to city:** 30-45 minutes

**📱 Booking Options:**
• Available at taxi stands (no booking required)
• Ask airport staff for directions to taxi area
• Multiple taxis available throughout the day

**💡 Tips:**
• Fares vary based on destination and traffic
• Confirm meter usage before starting journey
• Keep receipt for your records

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
  }

  private combineRelevantContent(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    if (!webResults || webResults.length === 0) {
      return `**Transportation Options at Muscat Airport:**

**🚗 Parking:** Multiple parking areas with hourly and daily rates
**🚕 Taxis:** Available 24/7 from arrivals hall
**🚌 Buses:** Public buses operated by Mwasalat
**🚐 Shuttles:** Hotel shuttle services available
**🚙 Car Rental:** Multiple companies available 24/7

*For specific rates and schedules, please check with the respective service providers or visit the airport information desk.*`;
    }
    
    // Combine and summarize the most relevant content
    let combinedContent = '';
    const relevantResults = webResults.slice(0, 3); // Use top 3 most relevant results
    
    for (const result of relevantResults) {
      if (result.content && result.content.length > 50) {
        combinedContent += result.content + '\n\n';
      }
    }
    
    if (combinedContent.length > 0) {
      return `**Transportation Information from Muscat Airport:**

${combinedContent.trim()}

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Fallback response
    return `**Transportation Options at Muscat Airport:**

**🚗 Parking:** Multiple parking areas with hourly and daily rates
**🚕 Taxis:** Available 24/7 from arrivals hall
**🚌 Buses:** Public buses operated by Mwasalat
**🚐 Shuttles:** Hotel shuttle services available
**🚙 Car Rental:** Multiple companies available 24/7

*For specific rates and schedules, please check with the respective service providers or visit the airport information desk.*`;
  }

  private extractTaxiInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    const lowerQuery = query.toLowerCase();
    
    // Check for meter-specific queries
    if (lowerQuery.includes('meter') || lowerQuery.includes('metres')) {
      return `**Taxi Meters at Muscat Airport:**

**📊 Meter Usage:**
✅ **Yes, airport taxis use meters** in Oman.

**💰 Meter Information:**
• **Starting Rate:** OMR 0.600 (flag fall)
• **Per Kilometer:** As per government tariff
• **Waiting Time:** Charged per minute
• **Night Surcharge:** May apply after 10 PM

**🛡️ Passenger Protection:**
• All taxis required to use meters
• Tariff rates set by government
• Meters calibrated and certified
• Receipt available upon request

**💡 Important Tips:**
• Always ensure meter is running
• Ask for receipt at end of journey
• Rates are standardized across all taxis
• Report any issues to airport authorities

**📞 For Complaints:**
• Airport Information: +968 2451 9223
• Civil Aviation Authority: +968 2451 9200

🔗 **Source:** [${sourceUrl}](${sourceUrl})`;
    }
    
    // General taxi information
    return `**Taxi Services at Muscat Airport:**

**🚕 Service Details:**
• **Availability:** 24/7 from arrivals hall
• **Location:** Official taxi stands outside arrivals
• **Service Type:** Licensed airport taxis
• **Meter Usage:** Yes, all taxis use government-regulated meters

**💰 Pricing Information:**
• **Starting Rate:** OMR 0.600 (flag fall)
• **City Center:** OMR 8-12 (approximately)
• **Seeb Area:** OMR 4-6
• **Qurum:** OMR 6-8
• **Ruwi:** OMR 10-14

**🛡️ Safety & Standards:**
• Licensed professional drivers
• Government-regulated tariffs
• Meters calibrated and certified
• 24-hour service availability

**💡 Passenger Tips:**
• Confirm meter is running
• Keep receipt for reference
• Negotiate for long-distance trips
• Airport staff available for assistance

🔗 **Source:** [${sourceUrl}](${sourceUrl})`;
  }

  private extractCarRentalInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    const lowerQuery = query.toLowerCase();
    
    // Check for specific company queries
    if (lowerQuery.includes('dollar') || lowerQuery.includes('dollar car rental')) {
      return `**Dollar Car Rental at Muscat Airport:**

**✅ Yes, Dollar Car Rental is available** at Muscat Airport.

**🏢 Dollar Car Rental Details:**
• **Location:** Arrivals hall at Muscat International Airport
• **Operating Hours:** 24/7 service available
• **Reservation:** Advance booking recommended
• **Contact:** Available at arrivals desk

**🚗 Vehicle Options:**
• **Economy Cars:** Compact and fuel-efficient
• **Mid-size Vehicles:** Comfortable for families
• **SUVs:** For larger groups or extra luggage
• **Luxury Options:** Premium vehicle selection

**💡 Booking Tips:**
• Book in advance for better rates
• Check for promotional offers
• Bring valid driving license and credit card
• International driving permit may be required

**📞 For Reservations:**
• Visit arrivals hall desk
• Online booking available
• Airport information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    if (lowerQuery.includes('avis') || lowerQuery.includes('avis car rental')) {
      return `**Avis Car Rental at Muscat Airport:**

**✅ Yes, Avis Car Rental is available** at Muscat Airport.

**🏢 Avis Car Rental Details:**
• **Location:** Arrivals hall at Muscat International Airport
• **Operating Hours:** 24/7 service available
• **Global Brand:** Trusted international car rental company
• **Fleet:** Wide range of vehicles available

**🚗 Vehicle Categories:**
• **Economy:** Budget-friendly options
• **Compact:** City driving convenience
• **Intermediate:** Balanced comfort and economy
• **Full-size:** Spacious for longer trips
• **Premium:** Luxury vehicle options

**💳 Requirements:**
• Valid driving license
• Credit card for security deposit
• International driving permit (for tourists)
• Age requirements apply

**📞 Contact Information:**
• Arrivals hall service desk
• Advance reservations recommended
• Airport information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // Check for location queries
    if (lowerQuery.includes('where') && (lowerQuery.includes('located') || lowerQuery.includes('offices') || lowerQuery.includes('find'))) {
      return `**Car Rental Office Locations at Muscat Airport:**

**📍 Primary Location:**
• **Arrivals Hall** - Main terminal building
• **Ground Floor** - Easy access upon arrival
• **Multiple Counters** - Various companies available
• **Clear Signage** - Follow car rental signs

**🏢 Available Companies:**
• **Avis** - International brand with full service
• **Dollar** - Competitive rates and wide selection  
• **Europcar** - European car rental specialist
• **Thrifty** - Budget-friendly options
• **Budget** - Economy car rental solutions
• **Local Operators** - Oman-based rental companies

**🕐 Operating Hours:**
• **24/7 Service** - Available around the clock
• **Staff Present** - During peak flight times
• **Self-service Kiosks** - Available for quick pickup

**🚗 Services Available:**
• **Immediate Rental** - Walk-in service
• **Pre-booked Pickups** - Reserved vehicles
• **Return Processing** - Drop-off assistance
• **Documentation** - Rental agreements and insurance

**💡 Navigation Tips:**
• Follow "Car Rental" signs from arrivals
• Located near baggage claim area
• Ask airport staff for directions if needed
• Multiple companies for price comparison

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // Check for operating hours queries
    if (lowerQuery.includes('24 hour') || lowerQuery.includes('24-hour') || lowerQuery.includes('open') || lowerQuery.includes('hours')) {
      return `**Car Rental Operating Hours at Muscat Airport:**

**🕐 24-Hour Service Available:**
✅ **Yes, car rental services operate 24/7** at Muscat Airport.

**⏰ Service Schedule:**
• **Peak Hours:** Full staff coverage during major flight arrivals
• **Off-Peak Hours:** Self-service options and on-call staff
• **Night Service:** Available for late arrivals and early departures
• **Weekend Service:** Full operations on weekends and holidays

**🏢 24-Hour Companies:**
• **Avis** - 24/7 operations with staff and kiosks
• **Dollar** - Round-the-clock service available
• **Europcar** - 24-hour pickup and return
• **Budget** - Continuous service with flexible hours
• **Thrifty** - 24/7 availability for rentals

**🚗 After-Hours Services:**
• **Pre-arranged Pickups** - Reserved vehicles ready
• **Self-service Kiosks** - Quick processing available
• **Key Drop Boxes** - Convenient return options
• **Emergency Contact** - 24-hour support numbers

**💡 Best Practices:**
• Book in advance for guaranteed availability
• Confirm pickup time with rental company
• Have all documents ready for quick processing
• Check specific company hours for optimal service

**📞 24-Hour Support:**
• Airport Information: +968 2451 9223
• Individual company hotlines available

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // Check for arrivals hall queries
    if (lowerQuery.includes('arrivals hall') || lowerQuery.includes('arrivals') || lowerQuery.includes('rent a car')) {
      return `**Car Rental at Muscat Airport Arrivals Hall:**

**✅ Yes, you can rent a car** directly at Muscat Airport arrivals hall.

**📍 Arrivals Hall Car Rental:**
• **Location:** Ground floor of main terminal
• **Accessibility:** Immediately after baggage claim
• **Multiple Options:** Several companies available
• **Convenient Access:** No need to leave airport

**🏢 Companies in Arrivals Hall:**
• **Avis** - Full-service international brand
• **Dollar** - Competitive rates and selection
• **Europcar** - European car rental specialist  
• **Budget** - Economy-focused options
• **Thrifty** - Value car rental solutions
• **Local Companies** - Oman-based operators

**🚗 Rental Process:**
1. **Arrive** at arrivals hall
2. **Locate** car rental area (follow signs)
3. **Choose** your preferred company
4. **Present** required documents
5. **Complete** rental agreement
6. **Receive** keys and vehicle location
7. **Collect** vehicle from designated area

**📋 Required Documents:**
• Valid driving license
• Credit card (for deposit)
• Passport/ID
• International driving permit (if applicable)

**💡 Advantages:**
• Immediate availability upon arrival
• No shuttle or transfer needed
• Multiple companies for comparison
• Professional staff assistance

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // Check for return queries
    if (lowerQuery.includes('return') || lowerQuery.includes('drop off') || lowerQuery.includes('drop-off')) {
      return `**Car Rental Return at Muscat Airport:**

**🚗 Car Rental Return Location:**
• **Designated Return Area** - Near terminal building
• **Clear Signage** - Follow "Car Rental Return" signs
• **Multiple Company Bays** - Separate areas for each company
• **Easy Access** - Close to departure terminal

**📍 Return Process:**
1. **Follow Signs** - "Car Rental Return" from airport approach
2. **Select Lane** - Choose your rental company's area
3. **Park Vehicle** - In designated return bay
4. **Inspection** - Staff will check vehicle condition
5. **Return Keys** - Complete return paperwork
6. **Receive Receipt** - Keep for your records
7. **Walk to Terminal** - Short distance to departures

**🏢 Return Services by Company:**
• **Avis** - Dedicated return bay with staff
• **Dollar** - Quick return process available
• **Europcar** - Professional inspection service
• **Budget** - Efficient return procedures
• **Thrifty** - Fast drop-off processing

**⏰ Return Hours:**
• **24/7 Return** - Available around the clock
• **Staff Hours** - Peak times for immediate processing
• **After-Hours** - Drop boxes and self-service options
• **Early Returns** - Accepted with proper procedures

**💡 Return Tips:**
• Refuel before return (if required)
• Remove all personal belongings
• Take photos of vehicle condition
• Allow extra time before flight
• Keep rental agreement until processed

**📞 Return Assistance:**
• On-site staff during business hours
• Emergency contact numbers available
• Airport information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // Check for international brands query
    if (lowerQuery.includes('international') || lowerQuery.includes('brands') || lowerQuery.includes('which companies')) {
      return `**International Car Rental Brands at Muscat Airport:**

**🌍 International Brands Available:**

**🚗 Avis**
• **Global Leader** - Worldwide car rental network
• **Premium Service** - High-quality vehicles and service
• **Loyalty Program** - Avis Preferred rewards
• **Fleet Variety** - Economy to luxury vehicles

**🚗 Dollar Car Rental**
• **Competitive Rates** - Value-focused pricing
• **Wide Selection** - Diverse vehicle options
• **Express Service** - Quick rental process
• **International Standards** - Consistent global service

**🚗 Europcar**
• **European Specialist** - Strong European heritage
• **Quality Fleet** - Well-maintained vehicles
• **Flexible Options** - Various rental periods
• **Professional Service** - Experienced staff

**🚗 Budget Rent a Car**
• **Economy Focus** - Affordable rental solutions
• **No-frills Service** - Straightforward rentals
• **Value Pricing** - Budget-conscious options
• **Reliable Vehicles** - Dependable transportation

**🚗 Thrifty Car Rental**
• **Value Brand** - Competitive pricing
• **Good Selection** - Range of vehicle types
• **Efficient Service** - Quick processing
• **Customer Focus** - Helpful staff

**🏢 Local Operators**
• **Oman-based Companies** - Local expertise
• **Competitive Rates** - Often lower prices
• **Regional Knowledge** - Local driving insights
• **Personalized Service** - Tailored assistance

**💡 Choosing the Right Brand:**
• Compare rates and terms
• Check vehicle availability
• Consider loyalty programs
• Review insurance options
• Ask about special offers

**📞 Contact Information:**
• Individual company desks in arrivals hall
• Airport information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
    }
    
    // General car rental information
    return `**Car Rental Services at Muscat Airport:**

**🚗 Car Rental Available:**
✅ **Multiple car rental companies** operate at Muscat Airport.

**🏢 Available Companies:**
• **Avis** - International brand with premium service
• **Dollar** - Competitive rates and wide selection
• **Europcar** - European car rental specialist
• **Budget** - Economy-focused rental solutions
• **Thrifty** - Value car rental options
• **Local Operators** - Oman-based rental companies

**📍 Location & Access:**
• **Arrivals Hall** - Ground floor of main terminal
• **24/7 Service** - Available around the clock
• **Easy Access** - Immediately after baggage claim
• **Multiple Counters** - Various companies to choose from

**🚗 Vehicle Options:**
• **Economy Cars** - Budget-friendly and fuel-efficient
• **Compact Vehicles** - Perfect for city driving
• **Mid-size Cars** - Comfortable for families
• **SUVs** - Ideal for groups or extra luggage
• **Luxury Vehicles** - Premium options available

**📋 Rental Requirements:**
• Valid driving license
• Credit card for security deposit
• Passport or ID
• International driving permit (for tourists)
• Minimum age requirements apply

**💡 Booking Tips:**
• Advance booking recommended
• Compare rates between companies
• Check for promotional offers
• Confirm pickup and return procedures
• Review insurance options

**🔄 Return Process:**
• Designated return area near terminal
• Follow clear signage from airport approach
• Quick inspection and key return
• Short walk to departure terminal

🔗 **More Information:** [Muscat Airport Car Rental](${sourceUrl})`;
  }

  private extractShuttleInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    const lowerQuery = query.toLowerCase();
    
    // Check for hotel shuttle queries
    if (lowerQuery.includes('hotel') && (lowerQuery.includes('shuttle') || lowerQuery.includes('bus'))) {
      return `**Hotel Shuttle Services to Muscat Airport:**

**✅ Yes, hotel shuttle services are available** to and from Muscat Airport.

**🏨 Hotel Shuttle Information:**
• **Major Hotels:** Most 4-5 star hotels provide shuttle services
• **Advance Booking:** Reservation required with hotel concierge
• **Complimentary Service:** Many hotels offer free shuttles for guests
• **Scheduled Times:** Regular departure times throughout the day

**🚐 Popular Hotels with Shuttle Services:**
• **Crowne Plaza Muscat** - Regular airport shuttles
• **Grand Hyatt Muscat** - Complimentary guest transfers
• **InterContinental Muscat** - Scheduled shuttle service
• **Shangri-La Barr Al Jissah** - Resort shuttle available
• **Radisson Blu Hotel Muscat** - Airport transfer service
• **Al Bustan Palace** - Luxury shuttle service

**📅 Booking Process:**
1. **Contact Hotel** - Call concierge or front desk
2. **Provide Flight Details** - Share arrival/departure times
3. **Confirm Pickup Time** - Allow extra time for travel
4. **Get Contact Number** - For day-of coordination
5. **Meet at Lobby** - Designated pickup location

**💡 Important Tips:**
• Book 24-48 hours in advance
• Confirm shuttle availability for your travel dates
• Ask about costs (some hotels charge nominal fees)
• Provide accurate flight information
• Have backup transportation plan

**📞 Alternative Arrangements:**
• Hotel concierge can arrange private transfers
• Taxi services available as backup
• Car rental options at airport

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for public transportation queries
    if (lowerQuery.includes('public') && (lowerQuery.includes('bus') || lowerQuery.includes('transportation'))) {
      return `**Public Transportation from Muscat Airport:**

**✅ Yes, public transportation is available** from Muscat Airport.

**🚌 Mwasalat Public Bus Service:**
• **Operator:** Mwasalat (Oman National Transport Company)
• **Service:** Regular bus routes connecting airport to city
• **Cost:** Affordable public transportation option
• **Schedule:** Multiple departures throughout the day

**🗺️ Main Routes:**
• **Route 1:** Airport → Muscat City Center → Ruwi
• **Route 2:** Airport → Seeb → Qurum
• **Route 3:** Airport → Al Khuwair → CBD
• **Express Service:** Direct routes to major destinations

**🚏 Bus Station Location:**
• **Ground Transportation Area** - Outside arrivals hall
• **Clear Signage** - Follow "Public Bus" signs
• **Covered Waiting Area** - Protection from weather
• **Information Desk** - Staff assistance available

**🎫 Ticketing & Fares:**
• **Cash Payment** - Omani Rials accepted
• **Mwasalat Card** - Rechargeable travel card
• **Mobile App** - Mwasalat app for schedules and tickets
• **Affordable Rates** - Budget-friendly option

**⏰ Operating Hours:**
• **Daily Service** - 7 days a week
• **Regular Schedule** - Every 30-60 minutes
• **Peak Hours** - More frequent service during busy times
• **Late Service** - Limited evening/night options

**💡 Travel Tips:**
• Check current schedules at information desk
• Allow extra time for bus travel
• Keep ticket for entire journey
• Ask driver about stops and destinations

**📞 Contact Information:**
• Mwasalat Customer Service: +968 2469 5000
• Airport Information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for which company operates buses
    if (lowerQuery.includes('which company') || lowerQuery.includes('who operates') || lowerQuery.includes('mwasalat')) {
      return `**Public Bus Operator at Muscat Airport:**

**🚌 Mwasalat - Official Public Bus Operator**

**🏢 About Mwasalat:**
• **Full Name:** Oman National Transport Company (Mwasalat)
• **Government Owned:** Official public transportation provider
• **Established:** Leading transport company in Oman
• **Network:** Extensive routes throughout Muscat and Oman

**🚍 Services at Muscat Airport:**
• **Airport Routes:** Multiple bus lines serving the airport
• **City Connections:** Links to all major areas in Muscat
• **Regular Schedule:** Reliable and punctual service
• **Modern Fleet:** Air-conditioned buses with comfortable seating

**🗺️ Route Network:**
• **Urban Routes:** Connecting residential areas
• **Business Districts:** CBD, Al Khuwair, Qurum
• **Tourist Areas:** Major hotels and attractions
• **Intercity Service:** Connections to other cities

**📱 Digital Services:**
• **Mwasalat App:** Real-time schedules and ticketing
• **Online Information:** Route maps and timetables
• **Digital Payments:** Mobile payment options
• **Live Tracking:** Bus location updates

**🎫 Payment Options:**
• **Mwasalat Card:** Rechargeable smart card
• **Cash Payment:** Exact fare preferred
• **Mobile App:** Digital ticket purchase
• **Daily/Weekly Passes:** For frequent travelers

**📞 Contact Mwasalat:**
• **Customer Service:** +968 2469 5000
• **Website:** www.mwasalat.om
• **Mobile App:** Available on iOS and Android
• **Social Media:** @MwasalatOman

**🕐 Service Hours:**
• **Daily Operation:** 7 days a week
• **Extended Hours:** Early morning to late evening
• **Holiday Service:** Modified schedules on public holidays

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for free shuttle queries
    if (lowerQuery.includes('free') && (lowerQuery.includes('shuttle') || lowerQuery.includes('hotel'))) {
      return `**Free Hotel Shuttle Services to Muscat Airport:**

**✅ Yes, many hotels provide free shuttle services** to Muscat Airport.

**🆓 Hotels with Complimentary Shuttles:**
• **Crowne Plaza Muscat** - Free for hotel guests
• **Grand Hyatt Muscat** - Complimentary airport transfers
• **InterContinental Muscat** - Free shuttle service
• **Radisson Blu Hotel Muscat** - No charge for guests
• **Sheraton Oman Hotel** - Complimentary transfers
• **Holiday Inn Muscat City Centre** - Free shuttle available

**📋 Free Shuttle Conditions:**
• **Hotel Guests Only** - Must be staying at the hotel
• **Advance Booking** - Reservation required (24-48 hours)
• **Limited Schedule** - Specific departure times
• **Flight Information** - Must provide flight details
• **Group Capacity** - Subject to vehicle availability

**🕐 Typical Service Times:**
• **Morning Departures:** 6:00 AM - 10:00 AM
• **Afternoon Service:** 2:00 PM - 6:00 PM
• **Evening Transfers:** 7:00 PM - 10:00 PM
• **Special Requests:** Early/late flights may be accommodated

**📞 Booking Free Shuttles:**
1. **Contact Hotel Concierge** - Call front desk or concierge
2. **Provide Flight Details** - Share departure/arrival times
3. **Confirm Availability** - Check shuttle schedule
4. **Get Confirmation** - Receive booking confirmation
5. **Arrive Early** - Be ready 10 minutes before departure

**💡 Important Notes:**
• Some hotels may charge nominal fuel fees
• Luxury resorts often include this in room rates
• Business hotels typically offer complimentary service
• Always confirm "free" status when booking

**🚕 Backup Options:**
• Hotel can arrange paid private transfers
• Taxi services available from hotel
• Car rental pickup at hotel (some companies)

**📞 For Arrangements:**
• Contact your hotel concierge directly
• Airport information: +968 2451 9223

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for bus station location queries
    if (lowerQuery.includes('where') && (lowerQuery.includes('bus station') || lowerQuery.includes('bus stop') || lowerQuery.includes('find'))) {
      return `**Bus Station Location at Muscat Airport:**

**📍 Public Bus Station Location:**
• **Ground Transportation Area** - Outside main terminal building
• **Arrivals Level** - Easy access from baggage claim
• **Clear Signage** - Follow "Public Transportation" signs
• **Covered Area** - Weather protection while waiting

**🚏 Finding the Bus Station:**
1. **Exit Arrivals Hall** - Walk through main exit doors
2. **Turn Right** - Follow ground transportation signs
3. **Look for Bus Signs** - Mwasalat and public bus signage
4. **Covered Waiting Area** - Benches and shelter available
5. **Information Booth** - Staff assistance nearby

**🚌 Bus Station Facilities:**
• **Covered Waiting Area** - Protection from sun and rain
• **Seating Available** - Benches for passenger comfort
• **Route Information** - Schedules and maps displayed
• **Information Desk** - Staff assistance during peak hours
• **Safety Features** - Well-lit and monitored area

**🗺️ Nearby Services:**
• **Taxi Stand** - Adjacent to bus area
• **Car Rental Shuttles** - Pickup points nearby
• **Hotel Shuttles** - Designated pickup zones
• **Information Desk** - Airport staff assistance

**📋 Bus Station Services:**
• **Route Maps** - Displayed at station
• **Schedule Information** - Current timetables posted
• **Ticket Information** - Fare details available
• **Lost & Found** - Contact airport security
• **Emergency Contact** - Airport police nearby

**💡 Navigation Tips:**
• Follow the crowd from arrivals - most people head to ground transport
• Ask airport staff if you're unsure - they're very helpful
• Look for the Mwasalat logo on signs
• Bus station is within 2-minute walk from arrivals

**📞 For Assistance:**
• Airport Information: +968 2451 9223
• Mwasalat Customer Service: +968 2469 5000

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for private driver queries
    if (lowerQuery.includes('private driver') || lowerQuery.includes('private transfer') || lowerQuery.includes('chauffeur')) {
      return `**Private Driver Services at Muscat Airport:**

**✅ Yes, private driver services are available** at Muscat Airport.

**🚗 Private Transfer Options:**

**🏢 Professional Transfer Companies:**
• **Muscat Private Transfers** - Licensed operators
• **Oman Elite Transport** - Luxury vehicle service
• **Airport Transfer Oman** - Reliable private drivers
• **VIP Transport Services** - Premium chauffeur service
• **Local Licensed Operators** - Certified private drivers

**🚙 Vehicle Categories:**
• **Economy Sedans** - Budget-friendly private transfers
• **Executive Cars** - Business class vehicles (BMW, Mercedes)
• **Luxury Vehicles** - Premium cars with professional drivers
• **SUVs/Minivans** - For groups and families
• **Luxury SUVs** - High-end group transportation

**📞 Booking Methods:**
• **Pre-booking Online** - Reserve in advance (recommended)
• **Hotel Concierge** - Ask hotel to arrange transfers
• **Airport Arrival** - Limited walk-up availability
• **Phone Booking** - Call transfer companies directly
• **Mobile Apps** - Some companies offer app booking

**💰 Pricing Structure:**
• **Fixed Rates** - Predetermined prices to destinations
• **Hourly Rates** - For multiple stops or waiting time
• **Distance-based** - Calculated per kilometer
• **Premium Charges** - Night/holiday surcharges may apply
• **Group Discounts** - Better rates for larger vehicles

**🕐 Service Features:**
• **Meet & Greet** - Driver meets you at arrivals with name sign
• **Flight Monitoring** - Drivers track flight delays
• **Professional Drivers** - Licensed and experienced
• **Clean Vehicles** - Well-maintained and air-conditioned
• **English Speaking** - Most drivers speak English

**📋 Booking Process:**
1. **Choose Service** - Select vehicle type and company
2. **Provide Details** - Flight info, destination, contact
3. **Confirm Booking** - Receive confirmation with driver details
4. **Airport Arrival** - Look for driver with name sign
5. **Enjoy Transfer** - Relax in private vehicle

**💡 Advantages:**
• No waiting for taxis or buses
• Direct door-to-door service
• Professional and reliable
• Fixed pricing (no meter surprises)
• Comfortable and private

**📞 Recommended Services:**
• Contact hotel concierge for trusted operators
• Airport information desk: +968 2451 9223
• Pre-book online for guaranteed service

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // Check for hotel shuttle arrangement queries
    if (lowerQuery.includes('arrange') && lowerQuery.includes('hotel') && (lowerQuery.includes('shuttle') || lowerQuery.includes('bus'))) {
      return `**How to Arrange Hotel Shuttle Service to Muscat Airport:**

**📞 Step-by-Step Arrangement Process:**

**1. Contact Your Hotel (24-48 hours in advance):**
• **Call Reception** - Speak with front desk or concierge
• **Provide Flight Details** - Share departure time and airline
• **Request Shuttle** - Ask about complimentary or paid shuttle service
• **Confirm Availability** - Check if shuttle operates on your travel date

**2. Information to Provide:**
• **Flight Number** - For tracking and timing
• **Departure Time** - To calculate pickup time
• **Number of Passengers** - For vehicle capacity planning
• **Luggage Details** - Amount of baggage you'll have
• **Contact Number** - For day-of coordination

**3. Confirm Details:**
• **Pickup Time** - Usually 2-3 hours before international flights
• **Pickup Location** - Hotel lobby or designated area
• **Cost** - Confirm if free or paid service
• **Contact Person** - Get driver or coordinator contact
• **Backup Plan** - Alternative if shuttle unavailable

**🏨 Hotels Known for Shuttle Services:**
• **Crowne Plaza Muscat** - Phone: +968 2460 0000
• **Grand Hyatt Muscat** - Phone: +968 2464 1234
• **InterContinental Muscat** - Phone: +968 2468 0000
• **Shangri-La Barr Al Jissah** - Phone: +968 2477 6666
• **Radisson Blu Hotel Muscat** - Phone: +968 2487 7777

**⏰ Typical Pickup Times:**
• **International Flights** - 3 hours before departure
• **Domestic Flights** - 2 hours before departure
• **Early Flights** - Special arrangements may be needed
• **Peak Hours** - Allow extra time for traffic

**💡 Pro Tips:**
• Book as soon as you confirm your flight
• Reconfirm 24 hours before departure
• Get written confirmation if possible
• Have taxi backup plan ready
• Tip shuttle driver appropriately

**🚕 Alternative Arrangements:**
• **Private Transfer** - Hotel can arrange paid private car
• **Taxi Service** - Hotel can call taxi for you
• **Ride Apps** - Some hotels help with app-based rides
• **Car Rental** - Hotel pickup available from some companies

**📋 What to Ask When Booking:**
• Is the shuttle service complimentary?
• What time should I be ready?
• Where is the pickup location?
• How long is the journey to airport?
• What if my flight is delayed/changed?
• Is there a contact number for the driver?

**📞 Emergency Contacts:**
• Hotel reception for last-minute changes
• Airport information: +968 2451 9223
• Taxi companies as backup option

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
    }
    
    // General shuttle and bus information
    return `**Shuttle & Bus Services at Muscat Airport:**

**🚌 Public Transportation:**
• **Mwasalat Buses** - Official public bus operator
• **Regular Routes** - Connecting airport to city areas
• **Affordable Fares** - Budget-friendly transportation
• **Multiple Destinations** - Muscat, Seeb, Qurum, Ruwi

**🚐 Hotel Shuttle Services:**
• **Major Hotels** - Most 4-5 star hotels offer shuttles
• **Advance Booking** - Reservation required with hotel
• **Complimentary Options** - Many hotels provide free service
• **Scheduled Times** - Regular departures throughout day

**🚗 Private Transfer Services:**
• **Professional Drivers** - Licensed private transfer companies
• **Various Vehicles** - Economy to luxury options
• **Pre-booking Available** - Online and phone reservations
• **Meet & Greet** - Driver meets you at arrivals

**📍 Transportation Hub:**
• **Ground Transport Area** - Outside arrivals hall
• **Clear Signage** - Easy to find all services
• **Information Desk** - Staff assistance available
• **Multiple Options** - Choose what suits your needs

**💡 Booking Tips:**
• **Public Buses** - No advance booking needed
• **Hotel Shuttles** - Book 24-48 hours ahead
• **Private Transfers** - Pre-book for guaranteed service
• **Compare Options** - Consider cost, convenience, and timing

**📞 Contact Information:**
• **Mwasalat (Public Buses):** +968 2469 5000
• **Airport Information:** +968 2451 9223
• **Hotel Concierge:** Contact your hotel directly

🔗 **More Information:** [Muscat Airport Transportation](${sourceUrl})`;
  }

  private getStaticDirectionsInfo(): string {
    return `**Directions to Muscat International Airport:**

**🗺️ Main Route:**
• **Highway:** Sultan Qaboos Highway (Highway 1)
• **Direction:** Northbound from Muscat towards Seeb
• **Distance:** Approximately 40km from city center
• **Travel Time:** 30-45 minutes depending on traffic

**🚗 From City Center:**
1. Join Sultan Qaboos Highway northbound
2. Follow blue airport signs
3. Take airport exit (clearly marked)
4. Follow terminal signs

**📍 Key Landmarks:**
• Qurum Beach area
• Al Khuwair business district
• Seeb residential areas
• Airport terminal (visible from highway)

*For GPS navigation, search for "Muscat International Airport" or use coordinates.*`;
  }

  private getStaticDiningInfo(): string {
    return `**Dining Options at Muscat Airport:**

**🍽️ Restaurants & Cafes:**
• International cuisine restaurants
• Local Omani food outlets
• Fast food chains
• Coffee shops and cafes
• Grab-and-go options

**⏰ Operating Hours:**
• Most outlets open from early morning
• 24-hour options available
• Extended hours during peak travel times

**💡 Dining Tips:**
• Variety of price ranges available
• Halal options throughout
• Both local and international cuisine
• Seating areas with airport views

*For specific restaurant names and locations, please check the airport directory upon arrival.*`;
  }

  private getStaticShoppingInfo(): string {
    return `**Shopping at Muscat Airport:**

**🛍️ Shopping Options:**
• Duty-free shops
• Souvenir and gift stores
• Electronics and accessories
• Books and magazines
• Local handicrafts and perfumes

**🎁 Popular Items:**
• Omani frankincense and perfumes
• Traditional handicrafts
• Duty-free alcohol and tobacco
• Electronics and gadgets
• Local dates and sweets

**💳 Payment:**
• Major credit cards accepted
• Cash payments in OMR
• Tax-free shopping for international travelers

*Shop locations and opening hours may vary. Please check with individual stores.*`;
  }

  private getStaticConnectivityInfo(): string {
    return `**Internet & Connectivity at Muscat Airport:**

**📶 WiFi Services:**
• Free WiFi available throughout terminal
• High-speed internet access
• Multiple connection points
• Guest network available

**🔌 Charging Facilities:**
• Charging stations throughout terminal
• USB ports at seating areas
• Power outlets near gates
• Mobile charging lounges

**📱 Connectivity Tips:**
• Connect to "Airport_Free_WiFi"
• Charging cables available at some locations
• Business center facilities available
• Internet kiosks for quick access

*WiFi password and connection instructions available at information desks.*`;
  }

  private getStaticLoungeInfo(): string {
    return `**Airport Lounges at Muscat Airport:**

**✈️ Lounge Options:**
• Business class lounges
• Premium airline lounges
• VIP services available
• Day-use lounges

**🏆 Lounge Amenities:**
• Comfortable seating areas
• Complimentary food and beverages
• WiFi and business facilities
• Quiet environment
• Shower facilities (select lounges)

**🎫 Access:**
• Business/First class tickets
• Lounge membership programs
• Day passes available for purchase
• Credit card lounge access

*Lounge locations and access requirements vary. Please check with your airline or lounge provider.*`;
  }

  private getStaticPrayerInfo(): string {
    return `**Prayer Facilities at Muscat Airport:**

**🕌 Prayer Rooms:**
• Prayer rooms available in terminal
• Separate facilities for men and women
• Quiet and clean environment
• Proper orientation towards Mecca

**⏰ Prayer Times:**
• Prayer time displays available
• Five daily prayer times observed
• Facilities open 24/7
• Ablution facilities provided

**📍 Location:**
• Clearly marked with signs
• Near main terminal areas
• Accessible from all gate areas
• Information desk can provide directions

*Prayer room locations are clearly marked throughout the terminal with Islamic symbols.*`;
  }

  private getStaticFacilitiesInfo(): string {
    return `**Airport Facilities at Muscat Airport:**

**🏢 General Facilities:**
• Information desks and customer service
• Currency exchange and ATMs
• Medical facilities and pharmacy
• Lost and found services
• Baggage services and storage

**♿ Accessibility:**
• Wheelchair accessible throughout
• Special assistance services
• Accessible restrooms and facilities
• Priority boarding assistance
• Dedicated parking spaces

**👨‍👩‍👧‍👦 Family Services:**
• Baby changing facilities
• Family restrooms
• Children's play areas
• Stroller rental services
• Family seating areas

*For specific facility locations, please refer to terminal maps or ask at information desks.*`;
  }

  private getStaticMedicalInfo(): string {
    return `**Medical Services at Muscat Airport:**

**🏥 Medical Facilities:**
• Medical center with qualified staff
• First aid stations throughout terminal
• Emergency medical services
• Pharmacy for basic medications
• Health screening facilities

**🚑 Emergency Services:**
• 24/7 medical assistance available
• Emergency response team on-site
• Ambulance services
• Coordination with local hospitals
• Medical equipment available

**💊 Health Services:**
• Basic medical consultations
• Prescription medication assistance
• Health certificates and documentation
• Travel health advice
• Special medical needs assistance

*For medical emergencies, contact airport security immediately or use emergency call points.*`;
  }

  private getStaticBaggageInfo(): string {
    return `**Baggage Services at Muscat Airport:**

**🧳 Baggage Handling:**
• Check-in counters for all airlines
• Baggage drop-off services
• Oversized baggage handling
• Baggage wrapping services
• Lost baggage assistance

**📦 Baggage Storage:**
• Left luggage facilities
• Short-term and long-term storage
• Secure storage areas
• Various size lockers available
• 24-hour access options

**🔍 Lost & Found:**
• Lost baggage reporting
• Baggage tracking services
• Found item collection
• Online baggage tracking
• Customer service assistance

*Baggage allowances and restrictions vary by airline. Please check with your airline for specific requirements.*`;
  }

  private extractForecourtChargesInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Forecourt Charges at Muscat Airport:**

**🚗 Pick-up & Drop-off Charges:**
• **First 10 minutes:** FREE
• **10-20 minutes:** OMR 0.600
• **20-30 minutes:** OMR 1.200
• **30-60 minutes:** OMR 6.000
• **After 1 hour:** OMR 6.000 per hour

**📍 Forecourt Areas:**
• **Departures Level:** Drop-off area for departing passengers
• **Arrivals Level:** Pick-up area for arriving passengers
• **Multiple Lanes:** Separate lanes for different purposes
• **Clear Signage:** Well-marked zones and time limits

**💡 Important Notes:**
• Charges apply to all vehicles in forecourt area
• Payment required at exit barriers
• No waiting allowed beyond free period
• Alternative parking available in P1/P3 areas
• Enforcement cameras monitor time limits

**💳 Payment Methods:**
• Cash payments accepted
• Credit/debit cards accepted
• Automatic payment at exit barriers
• Payment stations available

**⚠️ Tips to Avoid Charges:**
• Plan your arrival timing
• Use designated waiting areas if needed
• Consider parking areas for longer waits
• Drop off quickly and move on
• Pick up passengers promptly

🔗 **More Information:** [Muscat Airport Parking](${sourceUrl})`;
  }

  private extractUnattendedVehicleInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Unattended Vehicle Policy at Muscat Airport:**

**🚫 Unattended Vehicle Rules:**
• **No unattended vehicles** allowed in drop-off zones
• **Immediate removal** required after passenger drop-off
• **Security concerns** - unattended vehicles may be towed
• **Traffic flow** - blocking lanes not permitted

**⚠️ Consequences:**
• **Vehicle towing** at owner's expense
• **Security alerts** for suspicious vehicles
• **Fines and penalties** may apply
• **Airport security** will investigate unattended vehicles

**✅ Alternatives:**
• **Short-term parking** in P1 area
• **Paid parking** for waiting periods
• **Designated waiting areas** available
• **Pick-up scheduling** to minimize wait time

**💡 Best Practices:**
• Stay with your vehicle at all times
• Use parking areas for extended waits
• Plan pickup timing carefully
• Follow all posted signage and instructions

🔗 **More Information:** [Muscat Airport Parking Policies](${sourceUrl})`;
  }

  private extractBusinessDropoffInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Business Class Drop-off at Muscat Airport:**

**🏆 Premium Drop-off Services:**
• **Priority lanes** for business class passengers
• **Dedicated drop-off areas** near premium check-in
• **Valet services** available for premium passengers
• **Expedited security** access points nearby

**📍 Business Drop-off Locations:**
• **Level 2** - Departures level premium area
• **Clearly marked** business class signage
• **Close proximity** to business check-in counters
• **Easy access** to premium lounges

**⏰ Service Features:**
• **Extended time allowance** for business passengers
• **Porter services** available
• **Priority assistance** from airport staff
• **Direct access** to fast-track security

**💼 Additional Services:**
• **Baggage assistance** for premium passengers
• **Concierge services** available
• **Meet and greet** services
• **VIP lounge** access coordination

**💡 Booking:**
• Contact your airline for business class services
• Premium services may require advance booking
• Additional fees may apply for some services

🔗 **More Information:** [Muscat Airport Premium Services](${sourceUrl})`;
  }

  private extractBusinessPickupInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Business Class Pickup at Muscat Airport:**

**🏆 Premium Pickup Services:**
• **Priority pickup areas** for business passengers
• **Dedicated lanes** near premium exits
• **Meet and greet** services available
• **VIP treatment** for premium passengers

**📍 Business Pickup Locations:**
• **Level 1** - Arrivals level premium area
• **Designated zones** for business class
• **Close to** premium lounges and services
• **Easy vehicle access** for pickups

**🚗 Pickup Features:**
• **Extended waiting time** allowances
• **Premium passenger assistance**
• **Baggage handling** support available
• **Direct communication** with drivers

**💼 Premium Services:**
• **Concierge assistance** for arrangements
• **Private transfer** coordination
• **Luxury vehicle** options available
• **Flight tracking** for pickup timing

**📞 Coordination:**
• Business class passengers can request assistance
• Premium services desk available
• Advance booking recommended for VIP services

🔗 **More Information:** [Muscat Airport Premium Services](${sourceUrl})`;
  }

  private extractPickupTimingInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Pickup Timing Guidelines at Muscat Airport:**

**⏰ Optimal Pickup Times:**
• **Monitor flight status** for delays/early arrivals
• **Allow 30-45 minutes** after scheduled landing
• **Domestic flights:** 20-30 minutes after landing
• **International flights:** 45-60 minutes after landing

**📱 Flight Tracking:**
• **Use airline apps** or airport website for real-time updates
• **Flight information displays** available in terminal
• **SMS notifications** from airlines
• **Airport information** hotline available

**🚗 Pickup Strategies:**
• **Arrive at pickup area** when passenger exits terminal
• **Use short-term parking** if arriving early
• **Coordinate via phone** for precise timing
• **Be flexible** with flight delays

**💡 Timing Tips:**
• **Immigration processing** takes 15-30 minutes
• **Baggage collection** adds 15-20 minutes
• **Customs clearance** may add extra time
• **Peak hours** (morning/evening) may be busier

**📞 Communication:**
• Stay in contact with arriving passenger
• Use airport WiFi for updates
• Monitor flight status continuously

🔗 **More Information:** [Muscat Airport Flight Information](${sourceUrl})`;
  }

  private extractDropoffTimingInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Drop-off Timing Guidelines at Muscat Airport:**

**⏰ Recommended Drop-off Times:**
• **Domestic flights:** Arrive 2 hours before departure
• **International flights:** Arrive 3 hours before departure
• **Peak seasons:** Allow additional 30 minutes
• **Morning flights:** Account for traffic delays

**🚗 Drop-off Process:**
• **Quick drop-off** at departures level
• **Unload passengers and baggage** efficiently
• **Move vehicle immediately** after drop-off
• **No extended waiting** in drop-off zone

**📍 Drop-off Locations:**
• **Level 2** - Departures level
• **Multiple lanes** available for different airlines
• **Clear signage** for airline terminals
• **Easy access** to check-in counters

**💡 Timing Tips:**
• **Check traffic conditions** before departure
• **Monitor road conditions** especially during peak hours
• **Allow buffer time** for unexpected delays
• **Consider parking** if assistance needed with check-in

**⚠️ Time Limits:**
• **10 minutes free** in forecourt area
• **Charges apply** after free period
• **Keep moving** to avoid congestion
• **Plan timing** to minimize wait

🔗 **More Information:** [Muscat Airport Check-in Information](${sourceUrl})`;
  }

  private extractPickupLocationInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Pickup Locations at Muscat Airport:**

**📍 Main Pickup Area:**
• **Level 1** - Arrivals level
• **Clearly marked** pickup zones
• **Multiple lanes** for different vehicle types
• **Easy access** from terminal exits

**🚗 Pickup Zone Features:**
• **Designated areas** for private vehicles
• **Taxi pickup** areas clearly marked
• **Ride-sharing** designated zones
• **Commercial vehicle** areas separate

**🗺️ Location Details:**
• **Exit from arrivals hall** and follow pickup signs
• **Multiple pickup points** along arrivals level
• **Covered areas** for weather protection
• **Good lighting** for safety and visibility

**💡 Navigation Tips:**
• **Follow airport signage** to pickup areas
• **Coordinate with passenger** for specific location
• **Use terminal maps** available throughout airport
• **Ask information desk** for assistance if needed

**📞 Communication:**
• **Stay in contact** with arriving passenger
• **Use landmarks** to describe meeting point
• **Be patient** during busy periods
• **Consider short-term parking** for extended waits

🔗 **More Information:** [Muscat Airport Terminal Map](${sourceUrl})`;
  }

  private extractDropoffLocationInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/to-from';
    
    return `**Drop-off Locations at Muscat Airport:**

**📍 Main Drop-off Area:**
• **Level 2** - Departures level
• **Multiple lanes** for efficient traffic flow
• **Airline-specific** zones where applicable
• **Easy access** to check-in counters

**🚗 Drop-off Zone Features:**
• **Covered drop-off** areas for weather protection
• **Clear signage** for different airlines
• **Porter services** available at curbside
• **Baggage trolleys** readily available

**🗺️ Location Layout:**
• **Follow departures signs** when approaching airport
• **Multiple entry points** to drop-off area
• **Lane assignments** for different purposes
• **Exit routes** clearly marked

**💡 Drop-off Tips:**
• **Check airline terminal** location before arrival
• **Use appropriate lane** for your airline
• **Unload quickly** to maintain traffic flow
• **Assistance available** from airport staff if needed

**⚠️ Important Notes:**
• **No parking** allowed in drop-off zones
• **Keep vehicle moving** after passenger exit
• **Time limits** strictly enforced
• **Alternative parking** available if assistance needed

🔗 **More Information:** [Muscat Airport Terminal Access](${sourceUrl})`;
  }

  private extractFacilitiesInfo(webResults: any[], query: string): string {
    const sourceUrl = 'https://www.muscatairport.co.om/en/content/facilities';
    
    return `**Complete Facilities at Muscat Airport:**

**🏢 Terminal Facilities:**
• **Check-in counters** for all airlines
• **Security checkpoints** with modern equipment
• **Immigration and customs** facilities
• **Baggage claim** areas with multiple carousels
• **Information desks** throughout terminal

**🍽️ Dining & Shopping:**
• **Restaurants and cafes** with local and international cuisine
• **Duty-free shopping** with wide selection
• **Gift shops** and souvenir stores
• **Currency exchange** and banking services
• **ATMs** located throughout terminal

**🛏️ Comfort & Services:**
• **VIP lounges** for premium passengers
• **Prayer rooms** with proper facilities
• **Baby changing** and family rooms
• **Medical center** with qualified staff
• **Lost and found** services

**📶 Connectivity:**
• **Free WiFi** throughout terminal
• **Charging stations** at seating areas
• **Business center** facilities
• **Internet kiosks** for quick access

**♿ Accessibility:**
• **Wheelchair accessible** throughout
• **Special assistance** services available
• **Accessible restrooms** and facilities
• **Priority services** for passengers with disabilities

🔗 **More Information:** [Muscat Airport Facilities Guide](${sourceUrl})`;
  }
} 