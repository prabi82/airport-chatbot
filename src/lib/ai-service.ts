// AI Service for Oman Airports Chatbot
// Supports multiple AI providers with free tiers

import { prisma } from './database';
import { getRelevantKnowledgeEntries } from './rag-service';
import { isOfficialSource, getStrictIntentsFromEnv, getStrictScoreThreshold, ALIASES } from './query-config';

interface AIResponse {
  message: string;
  success: boolean;
  provider: string;
  processingTime: number;
  knowledgeBaseUsed?: boolean;
  sources?: string[];
  kbEntryId?: string;
}

interface AIProvider {
  name: string;
  apiKey?: string;
  endpoint: string;
  model: string;
  available: boolean;
}

interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sourceUrl?: string;
}

interface ScoredKnowledgeEntry extends KnowledgeEntry {
  relevanceScore: number;
}

export class AIService {
  private static instance: AIService;
  private providers: AIProvider[] = [];
  private requestTracker: Map<string, number[]> = new Map(); // Track requests per minute
  private responseCache: Map<string, { ts: number; data: AIResponse }> = new Map();
  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes
  private strictIntents: Set<string> = getStrictIntentsFromEnv();
  private strictScore: number = getStrictScoreThreshold();

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private initializeProviders() {
    // Google AI Studio (Gemini API) - FREE with generous limits
    // Free tier: 1,500 requests/day, 60 requests/minute
    if (process.env.GEMINI_API_KEY) {
      this.providers.push({
        name: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.5-flash-lite-preview-06-17', // Latest Gemini 2.5 Flash-Lite with improved performance
        available: true
      });
    }

    // Hugging Face Inference API (Free: 1000 requests/day)
    if (process.env.HUGGINGFACE_API_KEY) {
      this.providers.push({
        name: 'huggingface',
        apiKey: process.env.HUGGINGFACE_API_KEY,
        endpoint: 'https://api-inference.huggingface.co/models',
        model: 'microsoft/DialoGPT-medium', // Good for conversations
        available: true
      });
    }

    // Local Ollama (for development)
    this.providers.push({
      name: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      available: false // Will be checked dynamically
    });
  }

  // Check if a question is related to airports/travel
  private isAirportRelatedQuestion(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Airport-related keywords
    const airportKeywords = [
      'airport', 'terminal', 'flight', 'boarding', 'gate', 'departure', 'arrival',
      'check-in', 'baggage', 'luggage', 'security', 'customs', 'immigration',
      'taxi', 'transport', 'bus', 'parking', 'car rental', 'rental car',
      'dining', 'restaurant', 'food', 'coffee', 'shop', 'shopping', 'store',
      'lounge', 'wifi', 'internet', 'currency', 'exchange', 'atm', 'bank',
      'pharmacy', 'medical', 'hotel', 'accommodation', 'travel', 'trip',
      'muscat', 'oman', 'mct', 'omanairports', 'visa', 'passport'
    ];
    
    // Service-related keywords that are likely airport questions
    const serviceKeywords = [
      'where can i', 'how do i', 'what time', 'is there', 'are there',
      'can i find', 'available', 'open', 'hours', 'cost', 'price', 'fee'
    ];
    
    // Check for airport keywords
    const hasAirportKeywords = airportKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Check for service questions that might be airport-related
    const hasServiceKeywords = serviceKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    return hasAirportKeywords || hasServiceKeywords;
  }

  // Enhanced knowledge base search
  async searchKnowledgeBase(query: string): Promise<ScoredKnowledgeEntry[]> {
    // Alias normalization (runtime only, non-destructive)
    const normalizedQuery = this.normalizeQuery(query);
    const queryLower = normalizedQuery.toLowerCase();
    
    // PRIORITY OVERRIDE: Check for lounge pricing queries FIRST (before vector search)
    // This ensures we get the correct pricing entries even if vector search returns other results
    // Handle both "primeclass" (one word) and "prime class" (two words) variations
    const hasLoungeKeyword = queryLower.includes('lounge') || 
                            queryLower.includes('primeclass') || 
                            queryLower.includes('prime class');
    const hasPricingKeyword = queryLower.includes('price') || queryLower.includes('cost') || 
                             queryLower.includes('charges') || queryLower.includes('pricing') ||
                             queryLower.includes('rate') || queryLower.includes('fee') ||
                             queryLower.includes('charge') || queryLower.includes('how much') ||
                             queryLower.includes('know about');
    const isLoungePricingQuery = hasLoungeKeyword && hasPricingKeyword;
    
    if (isLoungePricingQuery) {
      console.log('[AIService] Lounge pricing query detected, prioritizing lounge category entries');
      try {
        const loungeEntries = await prisma.knowledgeBase.findMany({
          where: {
            OR: [
              { category: 'lounge', isActive: true },
              { category: 'primeclass', isActive: true },
              { category: 'lounge_facilities', isActive: true },
              { question: { contains: 'lounge', mode: 'insensitive' }, isActive: true },
              { answer: { contains: 'lounge', mode: 'insensitive' }, isActive: true }
            ]
          },
          orderBy: { priority: 'desc' },
          take: 20
        });
        
        if (loungeEntries.length > 0) {
          // Filter for pricing-related entries and add high relevance scores
          const pricingEntries = loungeEntries.filter((entry: any) => {
            const questionLower = (entry.question || '').toLowerCase();
            const answerLower = (entry.answer || '').toLowerCase();
            return questionLower.includes('cost') || questionLower.includes('price') || 
                   questionLower.includes('fee') || questionLower.includes('charge') ||
                   answerLower.includes('omr') || answerLower.includes('25') || 
                   answerLower.includes('vat') || answerLower.includes('cost') ||
                   answerLower.includes('price') || answerLower.includes('fee') ||
                   answerLower.includes('charge') || answerLower.includes('pricing');
          });
          
          const entriesToUse = pricingEntries.length > 0 ? pricingEntries : loungeEntries;
          const scoredLoungeEntries: ScoredKnowledgeEntry[] = entriesToUse.map((entry: any, index) => ({
            ...entry,
            sourceUrl: entry.sourceUrl ?? undefined,
            relevanceScore: 1000 - index // High scores for lounge entries
          }));
          
          console.log(`[AIService] Found ${scoredLoungeEntries.length} lounge entries, top score: ${scoredLoungeEntries[0]?.relevanceScore}`);
          return scoredLoungeEntries;
        }
      } catch (err) {
        console.error('[AIService] Lounge pricing query handler failed:', err);
      }
    }
    
    // First attempt semantic vector search via pgvector
    try {
      const vectorMatches = await getRelevantKnowledgeEntries(normalizedQuery, 8);
      if (vectorMatches && vectorMatches.length > 0) {
        const ql = normalizedQuery.toLowerCase();
        const isSpaIntent = ql.includes('spa') || ql.includes('massage') || ql.includes('be relax') || ql.includes('berelax');

        // Soft re-rank official sources
        let boosted = (vectorMatches as ScoredKnowledgeEntry[]).map(v => ({
          ...v,
          relevanceScore: v.relevanceScore + (isOfficialSource(v.sourceUrl) ? 0.15 : 0)
        }));

        // If spa intent, prefer spa-related vector results; if none, fall back to keyword search path
        if (isSpaIntent) {
          const spaPreferred = boosted
            .map(e => ({
              ...e,
              relevanceScore: e.relevanceScore + ((e.sourceUrl && e.sourceUrl.includes('/spa')) ||
                e.question.toLowerCase().includes('spa') || e.answer.toLowerCase().includes('spa') || e.category.toLowerCase().includes('spa') ? 0.3 : 0)
            }))
            .sort((a,b) => b.relevanceScore - a.relevanceScore);

          const hasSpa = spaPreferred.some(e => (e.sourceUrl && e.sourceUrl.includes('/spa')) || e.category.toLowerCase().includes('spa') || e.question.toLowerCase().includes('spa') || e.answer.toLowerCase().includes('spa'));
          if (hasSpa) {
            return spaPreferred.slice(0, 8);
          }
          // No spa hits in vector search → proceed to keyword search path below (do not early return)
        } else {
          return boosted.sort((a,b) => b.relevanceScore - a.relevanceScore).slice(0, 8);
        }
      }
    } catch (err) {
      console.error('[AIService] Vector search failed, falling back to keyword search:', err);
    }

    try {
      // Detect query type for better scoring
      
      // PRIORITY OVERRIDE: For parking queries, specifically search parking category first
      // Note: Lounge pricing queries are already handled above (before vector search)
      
      const isParkingQuery = queryLower.includes('parking') || queryLower.includes('park') || 
                            queryLower.includes('car park') || queryLower.includes('parking rates') || 
                            queryLower.includes('parking cost') || queryLower.includes('hourly') ||
                            queryLower.includes('daily') || queryLower.includes('weekly') ||
                            (queryLower.includes('cost') && queryLower.includes('park')) ||
                            (queryLower.includes('much') && queryLower.includes('park')) ||
                            (queryLower.includes('rates') && queryLower.includes('airport'));
      
      if (isParkingQuery) {
        console.log('[AIService] Parking query detected, prioritizing parking category entries');
        const parkingEntries = await prisma.knowledgeBase.findMany({
          where: {
            category: 'parking',
            isActive: true
          },
          orderBy: { priority: 'desc' },
          take: 10
        });
        
        if (parkingEntries.length > 0) {
          // Add high relevance scores to parking entries
          const scoredParkingEntries: ScoredKnowledgeEntry[] = parkingEntries.map((entry: any, index) => ({
            ...entry,
            sourceUrl: entry.sourceUrl ?? undefined,
            relevanceScore: 1000 - index // High scores for parking entries
          }));
          
          console.log(`[AIService] Found ${scoredParkingEntries.length} parking entries, top score: ${scoredParkingEntries[0]?.relevanceScore}`);
          return scoredParkingEntries;
        }
      }
      
      // PRIORITY OVERRIDE: SPA queries should focus on spa page and spa-tagged entries
      const isSpaQueryOverride = queryLower.includes('spa') || queryLower.includes('be relax') || queryLower.includes('berelax') || queryLower.includes('massage');
      if (isSpaQueryOverride) {
        console.log('[AIService] Spa query detected, prioritizing spa entries');
        const spaEntries = await prisma.knowledgeBase.findMany({
          where: {
            isActive: true,
            OR: [
              { sourceUrl: { contains: '/spa', mode: 'insensitive' } },
              { category: { contains: 'spa', mode: 'insensitive' } },
              { question: { contains: 'spa', mode: 'insensitive' } },
              { answer: { contains: 'spa', mode: 'insensitive' } }
            ]
          },
          orderBy: { priority: 'desc' },
          take: 10
        });

        if (spaEntries.length > 0) {
          const scoredSpaEntries: ScoredKnowledgeEntry[] = spaEntries.map((entry: any, index) => ({
            ...entry,
            sourceUrl: entry.sourceUrl ?? undefined,
            relevanceScore: 900 - index
          }));
          return scoredSpaEntries;
        }
      }
      const isBaggageQuery = queryLower.includes('baggage') || queryLower.includes('luggage') || 
                            queryLower.includes('suitcase') || queryLower.includes('bag') || 
                            queryLower.includes('weight') || queryLower.includes('size') || 
                            queryLower.includes('restrictions') || queryLower.includes('check-in') ||
                            queryLower.includes('carry-on') || queryLower.includes('lost') ||
                            queryLower.includes('damaged') || queryLower.includes('claim') ||
                            queryLower.includes('porter') || queryLower.includes('trolley') ||
                            queryLower.includes('sealing') || queryLower.includes('seal') ||
                            queryLower.includes('protection') || queryLower.includes('wrapping') ||
                            queryLower.includes('wrap');
      
      const isDiningQuery = queryLower.includes('restaurant') || queryLower.includes('food') || 
                           queryLower.includes('dining') || queryLower.includes('coffee') || 
                           queryLower.includes('eat') || queryLower.includes('kfc') ||
                           queryLower.includes('cafe');
      const isSpaQuery = queryLower.includes('spa') || queryLower.includes('massage') || queryLower.includes('berelax') || queryLower.includes('be relax');

      // Extract meaningful keywords (excluding common words and location terms)
      const stopWords = ['what', 'is', 'are', 'the', 'at', 'in', 'on', 'and', 'or', 'for', 'with', 'by', 'to', 'from', 'of', 'a', 'an', 'airport', 'airports', 'muscat', 'oman'];
      const keywords = normalizedQuery.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
        .slice(0, 10); // Limit to 10 keywords for performance

      if (keywords.length === 0) return [];

      // Search in knowledge base
      const entries = await prisma.knowledgeBase.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
          sourceUrl: true,
          dataSource: true,
          priority: true
        }
      });

      // Calculate relevance scores with improved algorithm
      const scoredEntries: ScoredKnowledgeEntry[] = entries.map(entry => {
        const questionText = entry.question.toLowerCase();
        const answerText = entry.answer.toLowerCase();
        const categoryText = entry.category.toLowerCase();
        
        let score = 0;
        
        // Apply category priority based on query type
        if (isBaggageQuery && categoryText.includes('baggage')) {
          score += 100; // Massive boost for baggage queries matching baggage category
        } else if (isDiningQuery && categoryText.includes('dining')) {
          score += 50; // Boost for dining queries matching dining category
        } else if (isSpaQuery && (categoryText.includes('spa') || questionText.includes('spa') || answerText.includes('spa'))) {
          score += 60; // Boost for spa queries
        } else if (isBaggageQuery && !categoryText.includes('baggage')) {
          score -= 30; // Penalty for non-baggage content when baggage is queried
        }
        
        // Parking query type detection and scoring - HIGHEST PRIORITY
        if (isParkingQuery && categoryText.includes('parking')) {
          score += 200; // MASSIVE boost for parking queries matching parking category
        } else if (isParkingQuery && !categoryText.includes('parking')) {
          score -= 40; // Penalty for non-parking content when parking is queried
        }
        
        // Medical query type detection and scoring (exclude ticket/booking queries)
        const hasTicketInQuery = queryLower.includes('ticket') || queryLower.includes('book') || 
                                 queryLower.includes('booking') || queryLower.includes('reserve');
        const isMedicalQueryType = !hasTicketInQuery && (
                                  queryLower.includes('medical') || queryLower.includes('health') || 
                                  queryLower.includes('clinic') || queryLower.includes('pharmacy') ||
                                  queryLower.includes('first aid') || 
                                  (queryLower.includes('emergency') && !queryLower.includes('ticket') && !queryLower.includes('book')) ||
                                  queryLower.includes('doctor') || queryLower.includes('treatment'));
        
        if (isMedicalQueryType && categoryText.includes('medical')) {
          score += 100; // Massive boost for medical queries matching medical category
        } else if (isMedicalQueryType && !categoryText.includes('medical')) {
          score -= 30; // Penalty for non-medical content when medical is queried
        }
        
        keywords.forEach(keyword => {
          // Score for question matches (highest priority)
          const questionMatches = (questionText.match(new RegExp(keyword, 'g')) || []).length;
          score += questionMatches * 5;
          
          // Score for answer matches (medium priority)
          const answerMatches = (answerText.match(new RegExp(keyword, 'g')) || []).length;
          score += answerMatches * 3;
          
          // Score for category matches (boost for relevant categories)
          const categoryMatches = (categoryText.match(new RegExp(keyword, 'g')) || []).length;
          score += categoryMatches * 4;
          
          // BAGGAGE-SPECIFIC KEYWORD MATCHING - HIGH PRIORITY
          const baggageKeywords = ['baggage', 'luggage', 'suitcase', 'bag', 'bags', 'weight', 'size', 'restrictions', 'check-in', 'checked', 'carry-on', 'lost', 'delayed', 'damaged', 'claim', 'porter', 'trolley', 'cargo', 'megaton', 'seal'];
          if (baggageKeywords.includes(keyword)) {
            if (categoryText.includes('baggage') || 
                questionText.includes('baggage') || questionText.includes('luggage') || questionText.includes('cargo') ||
                answerText.includes('baggage') || answerText.includes('luggage') || answerText.includes('cargo') ||
                answerText.includes('megaton') || answerText.includes('seal')) {
              score += 50; // MAJOR boost for baggage-related content
            }
          }
          
          // CARGO-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const cargoKeywords = ['cargo', 'megaton', 'excess', 'shipping', 'freight'];
          if (cargoKeywords.includes(keyword)) {
            if (questionText.includes('cargo') || questionText.includes('megaton') || 
                answerText.includes('cargo') || answerText.includes('megaton') ||
                answerText.includes('excess baggage') || answerText.includes('shipping')) {
              score += 200; // MASSIVE boost for cargo-related content - highest priority
            }
          }
          
          // INFORMATION DESK-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const infoKeywords = ['information', 'desk', 'tourist', 'tourism', 'help', 'assistance', 'support'];
          if (infoKeywords.includes(keyword)) {
            if (questionText.includes('information desk') || questionText.includes('tourist') || questionText.includes('tourism') ||
                answerText.includes('information desk') || answerText.includes('tourist') || answerText.includes('tourism') ||
                answerText.includes('baggage concourse') || answerText.includes('arrivals area') ||
                (categoryText.includes('information') && keyword === 'information') ||
                (categoryText.includes('information') && keyword === 'desk')) {
              score += 200; // MASSIVE boost for information desk content - highest priority
            }
          }
          
          // BUSINESS AVIATION-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const businessAviationKeywords = ['jetex', 'business', 'aviation', 'private', 'jet', 'fbo', 'ground', 'handling'];
          if (businessAviationKeywords.includes(keyword)) {
            if (questionText.includes('jetex') || questionText.includes('business aviation') || questionText.includes('private jet') ||
                answerText.includes('jetex') || answerText.includes('business aviation') || answerText.includes('private jet') ||
                answerText.includes('ground handling') || answerText.includes('fbo') || answerText.includes('catering') ||
                categoryText.includes('business_aviation') || categoryText.includes('business aviation')) {
              score += 200; // MASSIVE boost for business aviation content - highest priority
            }
          }
          
          // BANKING/ATM-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const bankingKeywords = ['atm', 'bank', 'banking', 'cash', 'money', 'currency', 'exchange', 'withdraw', 'deposit'];
          if (bankingKeywords.includes(keyword)) {
            if (questionText.includes('atm') || questionText.includes('bank') || questionText.includes('banking') ||
                questionText.includes('cash') || questionText.includes('money') || questionText.includes('currency') ||
                answerText.includes('atm') || answerText.includes('bank') || answerText.includes('banking') ||
                answerText.includes('cash withdrawal') || answerText.includes('currency exchange') ||
                (queryLower.includes('atm') && queryLower.includes('machine')) ||
                (queryLower.includes('bank') && queryLower.includes('service')) ||
                queryLower.includes('currency exchange') || queryLower.includes('withdraw money')) {
              score += 300; // MAXIMUM boost for banking content - highest priority
            }
          }

          // SMOKING AREA-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const smokingKeywords = ['smoking', 'smoke', 'cigarette', 'area', 'zone', 'location', 'where'];
          if (smokingKeywords.includes(keyword)) {
            if (questionText.includes('smoking') || questionText.includes('smoke') || questionText.includes('smoking area') ||
                questionText.includes('smoking zone') || answerText.includes('smoking') || answerText.includes('smoke') ||
                answerText.includes('smoking area') || answerText.includes('designated smoking') ||
                (queryLower.includes('smoking') && queryLower.includes('area')) ||
                (queryLower.includes('where') && queryLower.includes('smoke')) ||
                queryLower.includes('smoking zone') || queryLower.includes('location of smoking')) {
              score += 300; // MAXIMUM boost for smoking area content - highest priority
            }
          }

          // HOTEL SERVICES-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const hotelKeywords = ['hotel', 'aerotel', 'accommodation', 'stay', 'room', 'sleep', 'layover', 'transit'];
          if (hotelKeywords.includes(keyword)) {
            if (questionText.includes('hotel') || questionText.includes('aerotel') || questionText.includes('accommodation') ||
                questionText.includes('stay') || questionText.includes('room') || questionText.includes('sleep') ||
                answerText.includes('hotel') || answerText.includes('aerotel') || answerText.includes('accommodation') ||
                (queryLower.includes('hotel') && queryLower.includes('airport')) ||
                (queryLower.includes('stay') && queryLower.includes('airport')) ||
                (queryLower.includes('room') && queryLower.includes('airport')) ||
                queryLower.includes('layover accommodation') || queryLower.includes('transit hotel')) {
              score += 350; // MAXIMUM boost for hotel content - absolute highest priority
            }
          }

          // VIP & ASSISTANCE SERVICES-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const vipAssistanceKeywords = ['vip', 'assistance', 'assist', 'help', 'first', 'time', 'traveler', 'traveling', 'alone', 'process'];
          if (vipAssistanceKeywords.includes(keyword)) {
            if (questionText.includes('vip') || questionText.includes('assistance') || questionText.includes('first time') ||
                questionText.includes('traveling alone') || questionText.includes('airport process') ||
                answerText.includes('vip') || answerText.includes('assistance') || answerText.includes('personal assistant') ||
                (queryLower.includes('vip') && queryLower.includes('services')) ||
                (queryLower.includes('assistance') && queryLower.includes('airport')) ||
                (queryLower.includes('first time') && queryLower.includes('traveler')) ||
                (queryLower.includes('services offered') && queryLower.includes('assistance'))) {
              score += 300; // MAXIMUM boost for VIP/assistance content - absolute highest priority
            }
          }

          // PARKING SERVICES-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const parkingKeywords = ['parking', 'park', 'car', 'vehicle', 'rates', 'cost', 'fees', 'hourly', 'daily', 'weekly', 'short', 'long', 'term', 'omr', '0.200', '2.000', '12.000'];
          if (parkingKeywords.includes(keyword)) {
            if (questionText.includes('parking') || questionText.includes('park') || questionText.includes('car park') ||
                questionText.includes('parking rates') || questionText.includes('parking cost') || questionText.includes('vehicle parking') ||
                answerText.includes('parking') || answerText.includes('park') || answerText.includes('car park') ||
                answerText.includes('hourly rates') || answerText.includes('daily rates') || answerText.includes('weekly rates') ||
                answerText.includes('omr') || answerText.includes('0.200') || answerText.includes('2.000') ||
                (queryLower.includes('parking') && queryLower.includes('airport')) ||
                (queryLower.includes('park') && queryLower.includes('airport')) ||
                (queryLower.includes('rates') && queryLower.includes('airport')) ||
                (queryLower.includes('cost') && queryLower.includes('park')) ||
                (queryLower.includes('much') && queryLower.includes('park')) ||
                queryLower.includes('parking rates') || queryLower.includes('parking cost')) {
              score += 500; // MAXIMUM boost for parking content - absolute highest priority
            }
          }
          
          // SPECIFIC OMR PARKING RATES BOOST - ULTRA HIGH PRIORITY
          const omrRateKeywords = ['omr', '0.200', '2.000', '12.000', 'rial', 'rials'];
          if (omrRateKeywords.includes(keyword)) {
            if (answerText.includes('omr') || answerText.includes('0.200') || answerText.includes('2.000') || 
                answerText.includes('rial') || answerText.includes('parking')) {
              score += 600; // MASSIVE boost for entries with actual OMR rates
            }
          }

          // PRIMECLASS SERVICES-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const primeclassKeywords = ['primeclass', 'departure', 'arrival', 'services', 'fast-track', 'transit', 'assistant', 'lounge', 'assisted'];
          if (primeclassKeywords.includes(keyword)) {
            if (questionText.includes('primeclass') || questionText.includes('departure service') || questionText.includes('arrival service') ||
                questionText.includes('fast-track') || questionText.includes('assisted arrival') ||
                answerText.includes('primeclass') || answerText.includes('departure service') || answerText.includes('arrival service') ||
                answerText.includes('fast-track') || answerText.includes('personal assistant') || answerText.includes('transit service') ||
                (queryLower.includes('departure') && queryLower.includes('service')) ||
                (queryLower.includes('arrival') && queryLower.includes('service')) ||
                (queryLower.includes('assisted') && queryLower.includes('arrival')) ||
                (queryLower.includes('services') && queryLower.includes('available'))) {
              score += 200; // MASSIVE boost for Primeclass services content - highest priority
            }
          }
          
          // SEALING-SPECIFIC KEYWORD MATCHING - ULTRA HIGH PRIORITY
          const sealingKeywords = ['sealing', 'seal', 'protection', 'wrapping', 'wrap', 'shrink', 'foil', 'cost', 'price', 'pricing', 'how', 'much'];
          if (sealingKeywords.includes(keyword)) {
            if (questionText.includes('seal') || questionText.includes('sealing') || questionText.includes('protection') ||
                answerText.includes('seal') || answerText.includes('sealing') || answerText.includes('shrink') ||
                answerText.includes('foil') || answerText.includes('protection') || answerText.includes('wrapping')) {
              score += 200; // MASSIVE boost for sealing-related content - highest priority
            }
          }
          
          // PRICING QUERY BOOST FOR SEALING
          if (['cost', 'price', 'pricing', 'much', 'fee', 'charge'].includes(keyword)) {
            if ((questionText.includes('seal') || answerText.includes('seal')) || 
                (queryLower.includes('seal') || queryLower.includes('sealing'))) {
              score += 150; // Major boost for pricing queries about sealing
            }
          }
          
          // MEDICAL-SPECIFIC KEYWORD MATCHING - HIGH PRIORITY (exclude ticket/booking queries)
          const medicalKeywords = ['medical', 'health', 'clinic', 'pharmacy', 'first', 'aid', 'doctor', 'treatment', 'medication', 'medicine', 'patient'];
          const hasTicketContext = queryLower.includes('ticket') || queryLower.includes('book') || 
                                  queryLower.includes('booking') || queryLower.includes('reserve');
          const isEmergencyMedical = keyword === 'emergency' && !hasTicketContext;
          if (medicalKeywords.includes(keyword) || isEmergencyMedical) {
            if (categoryText.includes('medical') || 
                questionText.includes('medical') || questionText.includes('clinic') || questionText.includes('pharmacy') ||
                answerText.includes('medical') || answerText.includes('clinic') || answerText.includes('pharmacy') ||
                (answerText.includes('emergency') && !answerText.includes('ticket') && !answerText.includes('book')) || 
                answerText.includes('treatment')) {
              score += 50; // MAJOR boost for medical-related content
            }
          }
          
          // Special boost for specific baggage query types
          if (['weight', 'size', 'restrictions', 'limits'].includes(keyword)) {
            if ((questionText.includes('weight') && questionText.includes('size')) || 
                answerText.includes('weight') || answerText.includes('size') || 
                answerText.includes('restrictions') || answerText.includes('limits')) {
              score += 60; // MASSIVE boost for weight/size restriction queries
            }
          }
          
          // Boost for check-in related baggage queries
          if (['check-in', 'checkin', 'check', 'counter', 'counters'].includes(keyword)) {
            if (categoryText.includes('baggage') && 
                (questionText.includes('check') || answerText.includes('check'))) {
              score += 45; // Major boost for baggage check-in content
            }
          }

          // Special boost for dining-related keywords
          const diningKeywords = ['food', 'restaurant', 'dining', 'coffee', 'cafe', 'kitchen', 'eat', 'drink', 'meal', 'indian', 'spice', 'options', 'healthy'];
          if (diningKeywords.includes(keyword) && categoryText.includes('dining')) {
            score += 15; // Reduced boost for dining queries
          }
          
          // Boost for health-related queries
          if (['healthy', 'health', 'nutritious'].includes(keyword)) {
            if (questionText.includes('plenty') || answerText.includes('plenty') || 
                answerText.includes('healthy') || answerText.includes('nutritious') || answerText.includes('wholesome')) {
              score += 30; // Reduced boost for healthy dining content
            }
          }
          
          // Additional boost for general dining queries
          if (['options', 'available'].includes(keyword) && categoryText.includes('dining')) {
            score += 12; // Boost for "options available" in dining context
          }
        
        // Boost for specific restaurant/food content
        const restaurantIndicators = ['restaurant', 'quick bites', 'spice kitchen', 'mcdonald', 'kfc', 'coffee', 'cafe', 'tim hortons', 'cakes', 'caribou', 'bakes'];
        if (restaurantIndicators.some(indicator => questionText.includes(indicator) || answerText.includes(indicator))) {
          if (['dining', 'options', 'available', 'find', 'where', 'shops', 'bakeries', 'dessert', 'bakery'].includes(keyword)) {
            score += 20; // Major boost for actual restaurant content
          }
          }
          
        // Boost for bakery/dessert queries
        if (['bakery', 'bakeries', 'dessert', 'cake', 'cakes', 'baked'].includes(keyword)) {
          if (questionText.includes('cake') || answerText.includes('cake') || 
              answerText.includes('baked') || answerText.includes('dessert')) {
            score += 25; // Major boost for bakery/dessert content
          }
          }
          
        // Special boost for coffee/cafe related queries
        if (['coffee', 'cafe'].includes(keyword)) {
          if (questionText.includes('coffee') || answerText.includes('coffee') || 
              questionText.includes('cafe') || answerText.includes('cafe')) {
            score += 25; // Major boost for coffee-specific content
          }
          }
          
        // Boost for Arabic/Middle Eastern queries
        if (['arabic', 'middle', 'eastern', 'levant', 'turkish'].includes(keyword)) {
          if (questionText.includes('noor') || answerText.includes('noor') || 
              answerText.includes('arabic') || answerText.includes('turkish') || 
              answerText.includes('levant') || answerText.includes('middle eastern')) {
            score += 30; // Major boost for Arabic/Middle Eastern content
          }
        }
        
        // Boost for sports bar queries
        if (['sports', 'bar', 'games', 'watch'].includes(keyword)) {
          if (questionText.includes('tickerdaze') || answerText.includes('tickerdaze') || 
              answerText.includes('sports') || answerText.includes('games') || 
              answerText.includes('gastro') || answerText.includes('bar')) {
            score += 30; // Major boost for sports bar content
          }
        }
        
        // Boost for Latin cuisine queries
        if (['latin', 'american'].includes(keyword)) {
          if (questionText.includes('luna') || answerText.includes('luna') || 
              answerText.includes('latin')) {
            score += 30; // Major boost for Latin cuisine content
          }
        }
        
        // Boost for pre-order queries
        if (['pre-order', 'preorder', 'order', 'advance'].includes(keyword)) {
          if (questionText.includes('pre-order') || answerText.includes('pre-order') || 
              answerText.includes('advance') || answerText.includes('order')) {
            score += 35; // Major boost for pre-order content
          }
        }
        
        // Boost for location queries
        if (['where', 'located', 'location', 'most'].includes(keyword)) {
          if (questionText.includes('restaurants') || questionText.includes('dining') || 
              answerText.includes('level 4') || answerText.includes('departures') || 
              answerText.includes('most restaurants')) {
            score += 35; // Major boost for location content
          }
        }
        
        // Boost for Italian cuisine queries
        if (['italian', 'pizza', 'pasta'].includes(keyword)) {
          if (questionText.includes('italian') || answerText.includes('italian') || 
              answerText.includes('pizza') || answerText.includes('nero') || 
              answerText.includes('caffè')) {
            score += 30; // Major boost for Italian cuisine content
          }
        }
        
        // Boost for food court queries
        if (['food', 'court', 'area'].includes(keyword)) {
          if (questionText.includes('food court') || answerText.includes('food court') || 
              answerText.includes('dining area') || answerText.includes('centralized')) {
            score += 35; // Major boost for food court content
          }
        }

        // Boost for children's meals queries
        if (['children', 'kids', 'meals', 'cater'].includes(keyword)) {
          if (questionText.includes('children') || answerText.includes('children') || 
              answerText.includes('family-friendly') || answerText.includes('kid-friendly')) {
            score += 35; // Major boost for children's meals content
            }
          }
        
        // Boost for business meeting queries
        if (['business', 'meeting', 'best', 'professional'].includes(keyword)) {
          if (questionText.includes('business') || questionText.includes('meeting') || 
              answerText.includes('business') || answerText.includes('upscale') || 
              answerText.includes('professional') || answerText.includes('confidential')) {
            score += 35; // Major boost for business meeting content
          }
        }

        // Boost for 24/7 and hours queries
        if (['24/7', 'hours', 'operating', 'open'].includes(keyword)) {
          if (questionText.includes('24') || questionText.includes('hours') || 
              answerText.includes('24') || answerText.includes('hours') || 
              answerText.includes('operating') || answerText.includes('schedule')) {
            score += 35; // Major boost for hours/operating content
          }
        }
        
        // Boost for halal food queries
        if (['halal', 'food', 'find'].includes(keyword)) {
          if (questionText.includes('halal') || answerText.includes('halal') || 
              answerText.includes('certified') || answerText.includes('oman')) {
            score += 35; // Major boost for halal food content
          }
        }
        
        // LOUNGE-SPECIFIC KEYWORD MATCHING
        // Boost for lounge location queries
        if (['lounge', 'primeclass', 'located', 'where', 'location'].includes(keyword)) {
          if (questionText.includes('lounge') || answerText.includes('lounge') || 
              answerText.includes('primeclass') || answerText.includes('departures level')) {
            score += 40; // Major boost for lounge location content
          }
        }
        
        // Boost for lounge pricing/cost queries - HIGH PRIORITY
        if (['price', 'cost', 'charges', 'pricing', 'rate', 'rates', 'fee', 'fees', 'charge', 'how much', 'pricing', 'know about'].includes(keyword)) {
          // Check if query is about lounge pricing
          const isLoungePricingQuery = (queryLower.includes('lounge') || queryLower.includes('primeclass')) &&
                                      (queryLower.includes('price') || queryLower.includes('cost') || 
                                       queryLower.includes('charges') || queryLower.includes('pricing') ||
                                       queryLower.includes('rate') || queryLower.includes('fee') ||
                                       queryLower.includes('charge') || queryLower.includes('how much') ||
                                       queryLower.includes('know about'));
          
          // Check if answer contains lounge pricing information
          const hasLoungePricingInfo = (questionText.includes('lounge') || answerText.includes('lounge') || 
                                       questionText.includes('primeclass') || answerText.includes('primeclass')) &&
                                      (answerText.includes('omr') || answerText.includes('25') || 
                                       answerText.includes('vat') || answerText.includes('cost') || 
                                       answerText.includes('price') || answerText.includes('fee') ||
                                       answerText.includes('charge') || answerText.includes('pricing') ||
                                       answerText.includes('walk-in') || answerText.includes('3-hour') ||
                                       answerText.includes('per person'));
          
          if (isLoungePricingQuery && hasLoungePricingInfo) {
            score += 150; // MASSIVE boost for lounge pricing content when query matches
          } else if (hasLoungePricingInfo) {
            score += 100; // High boost for lounge pricing content even if query doesn't explicitly mention pricing
          }
        }
        
        // Boost for lounge facilities queries
        if (['facilities', 'amenities', 'services', 'available', 'what'].includes(keyword)) {
          if ((questionText.includes('lounge') || answerText.includes('lounge')) && 
              (answerText.includes('shower') || answerText.includes('wifi') || 
               answerText.includes('seating') || answerText.includes('buffet'))) {
            score += 35; // Major boost for lounge facilities content
          }
        }
        
        // Boost for porter service queries
        if (['porter', 'porters', 'baggage', 'luggage', 'find'].includes(keyword)) {
          if (questionText.includes('porter') || answerText.includes('porter') || 
              answerText.includes('baggage') || answerText.includes('luggage')) {
            score += 40; // Major boost for porter service content
          }
        }
        
        // Boost for parking queries
        if (['parking', 'park', 'car', 'vehicle', 'options'].includes(keyword)) {
          if (questionText.includes('parking') || answerText.includes('parking') || 
              answerText.includes('car park') || answerText.includes('vehicle')) {
            score += 40; // Major boost for parking content
          }
        }
        
        // Boost for entertainment queries
        if (['entertainment', 'tv', 'television', 'wifi', 'activities'].includes(keyword)) {
          if ((questionText.includes('lounge') || answerText.includes('lounge')) && 
              (answerText.includes('television') || answerText.includes('wifi') || 
               answerText.includes('entertainment') || answerText.includes('reading'))) {
            score += 35; // Major boost for lounge entertainment content
          }
        }
        
        // Special boost for primeclass-related queries
        if (['primeclass', 'premium', 'vip'].includes(keyword)) {
          if (questionText.includes('primeclass') || answerText.includes('primeclass') || 
              categoryText.includes('lounge')) {
            score += 45; // Major boost for primeclass content
          }
        }
        });

        // Soft boost official sources and entries marked as official
        if (isOfficialSource(entry.sourceUrl)) {
          score += 150;
        }
        if ((entry as any).dataSource === 'official') {
          score += 120;
        }

        return {
          ...entry,
          relevanceScore: score
        } as ScoredKnowledgeEntry;
      });

      // Dedupe by source host + path (ignore fragments)
      const seenBySource = new Set<string>();
      const deduped = scoredEntries
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .filter(e => {
          if (!e.sourceUrl) return true;
          try {
            const u = new URL(e.sourceUrl);
            const key = `${u.host}${u.pathname}`;
            if (seenBySource.has(key)) return false;
            seenBySource.add(key);
            return true;
          } catch {
            // Keep if URL parse fails
            return true;
          }
        })
        .slice(0, 8);

      const filtered = deduped.filter(e => e.relevanceScore >= 20);
      return filtered;

    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  async generateResponse(
    message: string,
    context: string = '',
    sessionId: string = '',
    preferredLanguage: 'ar' | 'en' = 'en'
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Lightweight response cache
    const cacheKey = this.buildCacheKey(message);
    const lowerForCache = message.toLowerCase();
    const cacheBypassForSpa = lowerForCache.includes('spa') || lowerForCache.includes('be relax') || lowerForCache.includes('berelax') || lowerForCache.includes('massage');
    const cacheBypassForTransport = lowerForCache.includes('rent a car') || lowerForCache.includes('car rental') || lowerForCache.includes('rental car') || lowerForCache.includes('taxi') || lowerForCache.includes('bus') || lowerForCache.includes('shuttle') || lowerForCache.includes('security');
    // Enhanced flight cache bypass - include airline names and city names
    const commonAirlinesForCache = ['air india', 'emirates', 'oman air', 'salamair', 'qatar', 'etihad', 'flydubai', 'indigo', 'spicejet', 'air arabia'];
    const commonCitiesForCache = ['delhi', 'mumbai', 'dubai', 'abu dhabi', 'doha', 'kuwait', 'riyadh', 'jeddah'];
    const hasAirlineForCache = commonAirlinesForCache.some(airline => lowerForCache.includes(airline));
    const hasCityForCache = commonCitiesForCache.some(city => lowerForCache.includes(city));
    const hasTimeQueryForCache = lowerForCache.includes('what time') || lowerForCache.includes('when') || lowerForCache.includes('expecting');
    const cacheBypassForFlight = lowerForCache.includes('flight') || lowerForCache.includes('departure') || lowerForCache.includes('arrival') || lowerForCache.includes('flight status') || lowerForCache.includes('flight number') || lowerForCache.includes('departed') || lowerForCache.includes('departure time') || lowerForCache.includes('arrival time') || /wy\s*\d+|om\s*\d+|ai\s*\d+|ek\s*\d+|qr\s*\d+|flight\s*\d+/i.test(message) || (hasTimeQueryForCache && (hasAirlineForCache || hasCityForCache)) || (hasAirlineForCache && hasCityForCache);
    const cached = this.responseCache.get(cacheKey);
    if (!cacheBypassForSpa && !cacheBypassForTransport && !cacheBypassForFlight && cached && Date.now() - cached.ts < this.cacheTtlMs) {
      return { ...cached.data, provider: `${cached.data.provider}-cache` };
    }
    // If spa/transport/flight intent, clear any stale cache for this key to avoid returning unrelated cached answers
    if ((cacheBypassForSpa || cacheBypassForTransport || cacheBypassForFlight) && cached) {
      this.responseCache.delete(cacheKey);
    }

    // Enhanced flight detection - MUST run BEFORE greeting handler to catch flight queries that start with "Hi"
    // Check for airline names, cities, and various flight-related patterns
    const lowerMessage = message.toLowerCase();
    const commonAirlines = ['air india', 'emirates', 'oman air', 'salamair', 'qatar', 'etihad', 'flydubai', 'indigo', 'spicejet', 'air arabia', 'kuwait airways', 'saudi arabian', 'gulf air', 'turkish airlines', 'british airways', 'lufthansa', 'klm', 'air france'];
    const commonCities = ['delhi', 'mumbai', 'dubai', 'abu dhabi', 'doha', 'kuwait', 'riyadh', 'jeddah', 'istanbul', 'london', 'frankfurt', 'amsterdam', 'paris', 'muscat', 'salalah'];
    const hasAirline = commonAirlines.some(airline => lowerMessage.includes(airline));
    const hasCity = commonCities.some(city => lowerMessage.includes(city));
    const hasTimeQuery = lowerMessage.includes('what time') || lowerMessage.includes('when') || lowerMessage.includes('expecting') || lowerMessage.includes('arriving') || lowerMessage.includes('departing');
    const hasFlightKeywords = lowerMessage.includes('flight') || lowerMessage.includes('departure') || lowerMessage.includes('arrival') || lowerMessage.includes('flight status') || lowerMessage.includes('flight number') || lowerMessage.includes('departed') || lowerMessage.includes('departure time') || lowerMessage.includes('arrival time');
    const hasFlightNumber = /wy\s*\d+|om\s*\d+|ai\s*\d+|ek\s*\d+|qr\s*\d+|ey\s*\d+|fz\s*\d+|6e\s*\d+|sg\s*\d+|flight\s*\d+/i.test(message);
    
    // Exclude parking and other non-flight queries from flight detection
    const isParkingContext = lowerMessage.includes('park') || lowerMessage.includes('car') || lowerMessage.includes('vehicle');
    const isFlightQueryForced = !isParkingContext && (
                                hasFlightKeywords || 
                                hasFlightNumber ||
                                (hasTimeQuery && (hasAirline || hasCity || lowerMessage.includes('flight') || lowerMessage.includes('depart'))) ||
                                (hasAirline && hasCity) ||
                                (hasAirline && hasTimeQuery) ||
                                (lowerMessage.includes('when does') && (lowerMessage.includes('leave') || lowerMessage.includes('depart'))) ||
                                (lowerMessage.includes('expecting') && (hasAirline || hasCity)));

    // Flight information handler - MUST run early to intercept flight queries before greeting handler
    // Provide helpful response even without real-time flight system connection
    if (isFlightQueryForced) {
      const processingTime = Date.now() - startTime;
      
      // Extract airline and city information from the query for a more personalized response
      const detectedAirline = commonAirlines.find(airline => lowerMessage.includes(airline));
      const detectedCity = commonCities.find(city => lowerMessage.includes(city));
      
      let flightResponse = `✈️ **Flight Information Request**\n\n`;
      
      if (detectedAirline || detectedCity) {
        flightResponse += `I understand you're asking about `;
        if (detectedAirline) {
          flightResponse += `${detectedAirline.charAt(0).toUpperCase() + detectedAirline.slice(1)} `;
        }
        if (detectedCity) {
          flightResponse += `flights ${detectedAirline ? 'from ' : ''}${detectedCity.charAt(0).toUpperCase() + detectedCity.slice(1)}`;
        }
        flightResponse += `.\n\n`;
      }
      
      flightResponse += `I don't have access to real-time flight schedules or live flight status information. However, here's how you can get the most accurate and up-to-date flight information:\n\n`;
      flightResponse += `**📱 Best Ways to Check Flight Information:**\n\n`;
      flightResponse += `• **Official Airport Website:** Visit [www.muscatairport.co.om](https://www.muscatairport.co.om) for flight schedules and information\n`;
      flightResponse += `• **Flight Information Displays:** Check the digital flight information displays (FIDS) at the airport terminal\n`;
      
      if (detectedAirline) {
        const airlineName = detectedAirline.charAt(0).toUpperCase() + detectedAirline.slice(1);
        flightResponse += `• **${airlineName} Direct:** Contact ${airlineName} directly or use their mobile app/website for real-time flight tracking\n`;
      } else {
        flightResponse += `• **Contact Your Airline:** Reach out to your airline directly for the most current flight status and departure/arrival times\n`;
      }
      
      flightResponse += `• **Airport Information Desk:** Visit the flight information desk at the airport for assistance\n`;
      flightResponse += `• **Airline Mobile Apps:** Most airlines provide real-time flight status through their official mobile applications\n\n`;
      flightResponse += `**📍 Flight Information Desk Location:**\n`;
      flightResponse += `The flight information desk is located opposite the duty-free area in the departures hall.\n\n`;
      flightResponse += `For other airport services like parking, dining, facilities, or transportation, I'm happy to help!`;
      
      return {
        message: flightResponse,
        success: true,
        provider: 'flight-info-handler',
        processingTime,
        knowledgeBaseUsed: false,
        sources: ['https://www.muscatairport.co.om'],
        kbEntryId: undefined
      };
    }

    // Ticket/Booking query handler - MUST run BEFORE greeting and medical handlers
    // Detects ticket booking queries to prevent confusion with medical emergencies
    // EXCLUDE parking, lounge, hotel, and other service reservations
    const parkingKeywords = ['park', 'parking', 'car park', 'vehicle', 'car'];
    const serviceKeywords = ['lounge', 'hotel', 'spa', 'restaurant', 'dining', 'table'];
    const isParkingQuery = parkingKeywords.some(keyword => lowerMessage.includes(keyword));
    const isServiceReservation = serviceKeywords.some(keyword => lowerMessage.includes(keyword) && lowerMessage.includes('reservation'));
    
    const ticketKeywords = ['ticket', 'book', 'booking', 'buy ticket', 'purchase ticket', 'reserve', 'reservation'];
    const travelKeywords = ['pakistan', 'india', 'dubai', 'travel', 'traveling', 'travelling', 'trip', 'journey'];
    const emergencyTicketPattern = /emergency\s+ticket|urgent\s+ticket|need\s+ticket|want\s+ticket/i;
    const hasTicketKeyword = ticketKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasTravelKeyword = travelKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasEmergencyTicket = emergencyTicketPattern.test(message);
    const hasFromToPattern = /from\s+\w+\s+to\s+\w+|to\s+\w+\s+from\s+\w+/i.test(message);
    
    // Exclude parking and service reservations from ticket booking detection
    const isTicketBookingQuery = !isParkingQuery && !isServiceReservation && (
                                 hasEmergencyTicket || 
                                 (hasTicketKeyword && (hasTravelKeyword || hasFromToPattern)) ||
                                 (hasTicketKeyword && (lowerMessage.includes('guide') || lowerMessage.includes('help') || lowerMessage.includes('how'))) ||
                                 (lowerMessage.includes('need') && hasTicketKeyword && !isParkingQuery) ||
                                 (lowerMessage.includes('want') && hasTicketKeyword && !isParkingQuery));

    if (isTicketBookingQuery) {
      const processingTime = Date.now() - startTime;
      
      // Extract destination information if mentioned
      const detectedDestination = commonCities.find(city => lowerMessage.includes(city)) || 
                                 (lowerMessage.includes('pakistan') ? 'Pakistan' : null) ||
                                 (lowerMessage.includes('india') ? 'India' : null);
      
      let ticketResponse = `🎫 **Ticket Booking Assistance**\n\n`;
      
      if (hasEmergencyTicket || lowerMessage.includes('emergency')) {
        ticketResponse += `I understand you need an emergency ticket. Here's how to get urgent travel assistance:\n\n`;
      } else {
        ticketResponse += `I can help guide you on how to book tickets. Here are your options:\n\n`;
      }
      
      ticketResponse += `**✈️ Best Ways to Book Tickets:**\n\n`;
      ticketResponse += `• **Travel Agents at Airport:** Visit the Travel Agents desk in the airport terminal for immediate assistance with ticket bookings\n`;
      ticketResponse += `• **Airline Counters:** Check with airline counters at the airport for last-minute ticket availability\n`;
      ticketResponse += `• **Online Booking:** Use airline websites or travel booking platforms (Oman Air, Emirates, etc.) for booking tickets\n`;
      ticketResponse += `• **Airline Call Centers:** Contact airlines directly via phone for urgent bookings and assistance\n\n`;
      
      if (detectedDestination) {
        ticketResponse += `**📍 For ${detectedDestination}:**\n`;
        ticketResponse += `• Check with airlines that operate flights to ${detectedDestination}\n`;
        ticketResponse += `• Visit the Travel Agents desk at the airport for assistance\n\n`;
      }
      
      ticketResponse += `**🏢 Travel Agents Desk Location:**\n`;
      ticketResponse += `The Travel Agents desk is located in the airport terminal. Staff can assist you with ticket bookings, travel arrangements, and provide guidance on available flights.\n\n`;
      
      if (hasEmergencyTicket) {
        ticketResponse += `**⚡ For Emergency/Urgent Travel:**\n`;
        ticketResponse += `• Visit the Travel Agents desk immediately for urgent booking assistance\n`;
        ticketResponse += `• Check with airline counters for last-minute availability\n`;
        ticketResponse += `• Contact airlines directly - they may have emergency booking procedures\n\n`;
      }
      
      ticketResponse += `**💡 Tip:** For the most current flight availability and pricing, I recommend contacting airlines directly or visiting the Travel Agents desk at the airport.\n\n`;
      ticketResponse += `For other airport services like flight information, parking, dining, or facilities, I'm happy to help!`;
      
      return {
        message: ticketResponse,
        success: true,
        provider: 'ticket-booking-handler',
        processingTime,
        knowledgeBaseUsed: false,
        sources: ['https://www.muscatairport.co.om'],
        kbEntryId: undefined
      };
    }

    // Check if this is a greeting and handle it appropriately (only if not a flight query)
    if (this.isGreeting(message)) {
      // Auto-detect if user used Arabic greeting and respond in Arabic
      const trimmedMessage = message.trim();
      const lowerMessage = trimmedMessage.toLowerCase();
      
      // Check for Arabic script greetings
      const arabicScriptGreetings = ['مرحبا', 'السلام عليكم', 'أهلا', 'أهلين', 'أهلا وسهلا', 'صباح الخير', 'مساء الخير'];
      const hasArabicScript = arabicScriptGreetings.some(pattern => 
        trimmedMessage.includes(pattern) || trimmedMessage.startsWith(pattern)
      );
      
      // Check for transliterated Arabic greetings
      const arabicGreetingPatterns = [
        'aslamaleykum', 'assalamu alaykum', 'assalamu alaikum', 'as-salamu alaykum',
        'salam', 'salaam', 'salamu alaykum', 'salam alaikum',
        'ahlan', 'ahlayn', 'marhaba', 'marhaban'
      ];
      const hasTransliteratedArabic = arabicGreetingPatterns.some(pattern => 
        lowerMessage.includes(pattern) || lowerMessage.startsWith(pattern)
      );
      
      // Use Arabic if user greeted in Arabic (either script or transliteration)
      const isArabicGreeting = hasArabicScript || hasTransliteratedArabic;
      const responseLanguage = isArabicGreeting ? 'ar' : preferredLanguage;
      const greetingResponse = this.getGreetingResponse(responseLanguage);
      const processingTime = Date.now() - startTime;
      const result: AIResponse = {
        message: greetingResponse,
        success: true,
        provider: 'greeting-handler',
        processingTime,
        knowledgeBaseUsed: false,
        sources: [],
        kbEntryId: undefined
      };
      this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
      return result;
    }

    // Search knowledge base for relevant information
    const knowledgeEntries = await this.searchKnowledgeBase(message);
    let knowledgeContext = '';
    let sources: string[] = [];

    // Check if this is an airport-related question
    const isAirportRelated = this.isAirportRelatedQuestion(message);
    
    // Determine if we have strong knowledge base matches
    const isHotelQueryForced = message.toLowerCase().includes('hotel') || message.toLowerCase().includes('aerotel');
    const isSmokingQueryForced = message.toLowerCase().includes('smoking') || message.toLowerCase().includes('smoke');
    const isWiFiQueryForced = message.toLowerCase().includes('wi-fi') || message.toLowerCase().includes('wifi') ||
                             message.toLowerCase().includes('wireless') || message.toLowerCase().includes('internet') ||
                             message.toLowerCase().includes('wifi password') || message.toLowerCase().includes('wifi access') ||
                             message.toLowerCase().includes('connect to wifi');
    const isChildrenTravelQueryForced = message.toLowerCase().includes('travelling with children') || message.toLowerCase().includes('traveling with children') ||
                                       message.toLowerCase().includes('baby stroller') || message.toLowerCase().includes('children facilities') ||
                                       message.toLowerCase().includes('family facilities') || message.toLowerCase().includes('unaccompanied minor') ||
                                       (message.toLowerCase().includes('stroller') && message.toLowerCase().includes('airport'));
    const isEGatesQueryForced = message.toLowerCase().includes('e-gate') || message.toLowerCase().includes('e-gates') || 
                               message.toLowerCase().includes('egates') || message.toLowerCase().includes('egate') ||
                               message.toLowerCase().includes('electronic gate') || message.toLowerCase().includes('electronic immigration') ||
                               message.toLowerCase().includes('automated immigration') ||
                               (message.toLowerCase().includes('egates') && message.toLowerCase().includes('available'));
    const isCurrencyExchangeQueryForced = message.toLowerCase().includes('currency exchange') || message.toLowerCase().includes('money exchange') || 
                                         message.toLowerCase().includes('foreign exchange') || message.toLowerCase().includes('exchange money') ||
                                         message.toLowerCase().includes('exchange currency') || message.toLowerCase().includes('change money') ||
                                         (message.toLowerCase().includes('exchange') && message.toLowerCase().includes('available'));
    const isBankingQueryForced = (message.toLowerCase().includes('atm') || message.toLowerCase().includes('bank') || message.toLowerCase().includes('banking') || 
                                message.toLowerCase().includes('cash') || (message.toLowerCase().includes('money') && message.toLowerCase().includes('withdraw'))) &&
                                !isCurrencyExchangeQueryForced; // Don't trigger banking for currency exchange
    const isSpaQueryForced = message.toLowerCase().includes('spa') || message.toLowerCase().includes('be relax') || message.toLowerCase().includes('berelax') || message.toLowerCase().includes('massage');
    const isCarRentalQueryForced = message.toLowerCase().includes('car rental') || message.toLowerCase().includes('rent a car') || message.toLowerCase().includes('rental car');
    const isTaxiQueryForced = message.toLowerCase().includes('taxi') || message.toLowerCase().includes('cab');
    const isBusShuttleQueryForced = message.toLowerCase().includes('bus') || message.toLowerCase().includes('shuttle');
    const isSecurityQueryForced = message.toLowerCase().includes('security') || message.toLowerCase().includes('security check') || message.toLowerCase().includes('security screening');
    const isParkingQueryForced = message.toLowerCase().includes('parking') || message.toLowerCase().includes('park') || 
                                 message.toLowerCase().includes('car park') || message.toLowerCase().includes('parking rates') || 
                                 message.toLowerCase().includes('parking cost') || message.toLowerCase().includes('hourly') ||
                                 message.toLowerCase().includes('daily') || message.toLowerCase().includes('weekly') ||
                                 (message.toLowerCase().includes('cost') && message.toLowerCase().includes('park')) ||
                                 (message.toLowerCase().includes('much') && message.toLowerCase().includes('park')) ||
                                 (message.toLowerCase().includes('rates') && message.toLowerCase().includes('airport')) ||
                                 (message.toLowerCase().includes('reservation') && (message.toLowerCase().includes('park') || message.toLowerCase().includes('car'))) ||
                                 (message.toLowerCase().includes('reserve') && (message.toLowerCase().includes('park') || message.toLowerCase().includes('car'))) ||
                                 (message.toLowerCase().includes('need') && message.toLowerCase().includes('reservation') && (message.toLowerCase().includes('park') || message.toLowerCase().includes('car')));
    
    // Detect lounge queries (including pricing queries)
    const messageLower = message.toLowerCase();
    const isLoungeQueryForced = messageLower.includes('lounge') || 
                               messageLower.includes('primeclass') || 
                               messageLower.includes('prime class') ||
                               (messageLower.includes('lounge') && (messageLower.includes('price') || messageLower.includes('cost') || messageLower.includes('charges')));
    
    // Note: isFlightQueryForced is already defined above (before greeting handler)
    const hasStrongKnowledgeMatch = (knowledgeEntries.length > 0 && knowledgeEntries[0].relevanceScore > 15) || isHotelQueryForced || isSmokingQueryForced || isBankingQueryForced || isCurrencyExchangeQueryForced || isEGatesQueryForced || isChildrenTravelQueryForced || isWiFiQueryForced || isSpaQueryForced || isCarRentalQueryForced || isTaxiQueryForced || isBusShuttleQueryForced || isSecurityQueryForced || isParkingQueryForced || isFlightQueryForced || isLoungeQueryForced;

    // KB-STRICT (env-controlled): if top official KB hit is strong for a strict intent, short-circuit
    if (knowledgeEntries.length > 0) {
      const top = knowledgeEntries[0];
      const m = message.toLowerCase();
      let intentKey: string | null = null;
      if (m.includes('wi-fi') || m.includes('wifi')) intentKey = 'wifi-services';
      else if (m.includes('travelling with children') || m.includes('traveling with children') || m.includes('stroller')) intentKey = 'children-travel';
      else if (m.includes('e-gate') || m.includes('egates') || m.includes('egate')) intentKey = 'e-gates';
      else if (m.includes('currency exchange') || (m.includes('money') && m.includes('exchange'))) intentKey = 'currency-exchange';
      else if (m.includes('atm') || m.includes('bank')) intentKey = 'banking-services';
      else if (m.includes('smoking')) intentKey = 'smoking-facilities';
      else if (m.includes('hotel') || m.includes('aerotel')) intentKey = 'hotel-services';
      else if (m.includes('spa') || m.includes('be relax') || m.includes('berelax') || m.includes('massage')) intentKey = 'spa-services';

      const isTopOfficial = isOfficialSource((top as any).sourceUrl) || ((top as any).dataSource === 'official');
      if (intentKey && this.strictIntents.has(intentKey) && top.relevanceScore >= this.strictScore && isTopOfficial) {
        // choose handler
        const processingTime = Date.now() - startTime;
        let messageOut = '';
        switch (intentKey) {
          case 'wifi-services':
            messageOut = this.createWiFiServicesResponse(knowledgeEntries, message);
            break;
          case 'children-travel':
            messageOut = this.createChildrenTravelResponse(knowledgeEntries, message);
            break;
          case 'e-gates':
            messageOut = this.createEGatesResponse(knowledgeEntries, message);
            break;
          case 'currency-exchange':
            messageOut = this.createCurrencyExchangeResponse(knowledgeEntries, message);
            break;
          case 'spa-services':
            // Strictly use spa-only entries to avoid dining bleed-through
            messageOut = this.createSpaServicesResponse(this.filterSpaEntries(knowledgeEntries) as any, message);
            break;
          default:
            messageOut = this.createComprehensiveKnowledgeResponse(message, knowledgeEntries);
        }
        const result: AIResponse = {
          message: messageOut,
          success: true,
          provider: 'kb-strict',
          processingTime,
          knowledgeBaseUsed: true,
          sources: top.sourceUrl ? [top.sourceUrl] : [],
          kbEntryId: top.id
        };
        this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
        return result;
      }
    }

    // Note: Flight handler is already processed above (before greeting handler) - removed duplicate

    // FORCE knowledge base handlers for specific queries before AI providers
    if (isCarRentalQueryForced || isTaxiQueryForced || isBusShuttleQueryForced || isSecurityQueryForced) {
      // Narrow results to the To & From page or matching categories to avoid unrelated sources
      const transportEntries = await prisma.knowledgeBase.findMany({
        where: {
          isActive: true,
          OR: [
            { sourceUrl: { contains: 'to-from', mode: 'insensitive' } },
            isCarRentalQueryForced ? { category: { equals: 'car_rental', mode: 'insensitive' } } : undefined,
            isTaxiQueryForced ? { category: { equals: 'taxi', mode: 'insensitive' } } : undefined,
            isBusShuttleQueryForced ? { category: { equals: 'bus_shuttle', mode: 'insensitive' } } : undefined,
            isSecurityQueryForced ? { category: { equals: 'security', mode: 'insensitive' } } : undefined
          ].filter(Boolean) as any
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 12
      });

      sources.push('https://www.muscatairport.co.om/en/content/to-from');
      const processingTime = Date.now() - startTime;
      // Prefer exact KB match (case-insensitive, punctuation-insensitive)
      const exact = this.findExactQuestionMatch(transportEntries as any, message);
      let responseMsg = '';
      if (exact) {
        if (isCarRentalQueryForced) {
          responseMsg = this.formatCarRentalAnswer(exact.answer);
        } else {
          responseMsg = this.formatKbAnswer(exact.answer);
        }
      } else {
        if (isCarRentalQueryForced) responseMsg = this.createCarRentalResponse(transportEntries as any, message);
        else if (isTaxiQueryForced) responseMsg = this.createTaxiResponse(transportEntries as any, message);
        else if (isBusShuttleQueryForced) responseMsg = this.createBusShuttleResponse(transportEntries as any, message);
        else if (isSecurityQueryForced) responseMsg = this.createSecurityInfoResponse(transportEntries as any, message);
      }

      return {
        message: responseMsg,
        success: true,
        provider: 'to-from-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: transportEntries.length > 0 ? transportEntries[0].id : undefined
      };
    }
    // FORCE knowledge base handler for lounge queries (especially pricing)
    if (isLoungeQueryForced) {
      console.log('[AIService] Lounge query detected, using lounge-specific handler');
      // Fetch lounge entries directly from KB
      const loungeOnlyEntries = await prisma.knowledgeBase.findMany({
        where: {
          isActive: true,
          OR: [
            { category: 'lounge', isActive: true },
            { category: 'primeclass', isActive: true },
            { category: 'lounge_facilities', isActive: true },
            { question: { contains: 'lounge', mode: 'insensitive' }, isActive: true },
            { answer: { contains: 'lounge', mode: 'insensitive' }, isActive: true }
          ]
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 15
      });
      
      if (loungeOnlyEntries.length > 0) {
        // If it's a pricing query, filter for pricing entries
        const isPricingQuery = messageLower.includes('price') || messageLower.includes('cost') || 
                              messageLower.includes('charges') || messageLower.includes('pricing') ||
                              messageLower.includes('rate') || messageLower.includes('fee') ||
                              messageLower.includes('charge') || messageLower.includes('how much');
        
        let entriesToUse = loungeOnlyEntries;
        if (isPricingQuery) {
          entriesToUse = loungeOnlyEntries.filter((entry: any) => {
            const questionLower = (entry.question || '').toLowerCase();
            const answerLower = (entry.answer || '').toLowerCase();
            return questionLower.includes('cost') || questionLower.includes('price') || 
                   questionLower.includes('fee') || questionLower.includes('charge') ||
                   answerLower.includes('omr') || answerLower.includes('25') || 
                   answerLower.includes('vat') || answerLower.includes('cost') ||
                   answerLower.includes('price') || answerLower.includes('fee') ||
                   answerLower.includes('charge') || answerLower.includes('pricing');
          });
          
          // If no pricing entries found, use all lounge entries
          if (entriesToUse.length === 0) {
            entriesToUse = loungeOnlyEntries;
          }
        }
        
        sources.push('https://www.muscatairport.co.om/en/content/primeclass-lounge');
        const processingTime = Date.now() - startTime;
        
        // Try to find exact match first
        const exact = this.findExactQuestionMatch(entriesToUse as any, message);
        let responseMsg = '';
        
        if (exact) {
          responseMsg = this.formatKbAnswer(exact.answer);
        } else if (isPricingQuery || messageLower.includes('access') || messageLower.includes('entry') || messageLower.includes('admission')) {
          // For pricing/access queries, use dedicated lounge access response
          responseMsg = this.createLoungeAccessResponse(entriesToUse as any, message);
        } else {
          // Use comprehensive response with lounge entries
          responseMsg = this.createComprehensiveKnowledgeResponse(message, entriesToUse as any);
        }
        
        return {
          message: responseMsg,
          success: true,
          provider: 'lounge-knowledge-base',
          processingTime,
          knowledgeBaseUsed: true,
          sources: [...new Set(sources)],
          kbEntryId: entriesToUse.length > 0 ? entriesToUse[0].id : undefined
        };
      }
    }
    
    if (isSpaQueryForced) {
      // Fetch ONLY spa-related entries directly from KB
      const spaOnlyEntries = await prisma.knowledgeBase.findMany({
        where: {
          isActive: true,
          OR: [
            { sourceUrl: { contains: '/spa', mode: 'insensitive' } },
            { category: { contains: 'spa', mode: 'insensitive' } },
            { question: { contains: 'spa', mode: 'insensitive' } },
            { answer: { contains: 'spa', mode: 'insensitive' } },
          ]
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 10
      });

      // Build sources list strictly from spa page
      sources.push('https://www.muscatairport.co.om/en/content/spa');

      const processingTime = Date.now() - startTime;
      const entriesToUse = spaOnlyEntries.length > 0 ? (spaOnlyEntries as any as ScoredKnowledgeEntry[]) : knowledgeEntries;
      const comprehensiveResponse = this.createSpaServicesResponse(entriesToUse as any, message);
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'spa-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: entriesToUse.length > 0 ? entriesToUse[0].id : undefined
      };
    }
    if (isWiFiQueryForced) {
      // Collect Wi-Fi-specific sources  
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl) {
          // Include Wi-Fi entries and the official source
          if (entry.sourceUrl.includes('free-wifi') || entry.category === 'wifi_services' || 
              entry.question.toLowerCase().includes('wifi') || entry.question.toLowerCase().includes('wi-fi') ||
              entry.answer.toLowerCase().includes('wifi') || entry.answer.toLowerCase().includes('wi-fi')) {
            sources.push(entry.sourceUrl);
          }
        }
      });
      
      // Always add the official Wi-Fi source
      sources.push('https://www.muscatairport.co.om/en/content/free-wifi');
      
      const processingTime = Date.now() - startTime;
      
      // Force use of Wi-Fi-specific knowledge base handler
      return {
        message: this.createWiFiServicesResponse(knowledgeEntries, message),
        success: true,
        provider: 'wifi-services-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)], // Remove duplicates
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    if (isChildrenTravelQueryForced) {
      // Collect children travel-specific sources  
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl) {
          // Include children travel entries and the official source
          if (entry.sourceUrl.includes('travelling-with-children') || entry.category === 'children_travel' || 
              entry.question.toLowerCase().includes('children') || entry.question.toLowerCase().includes('stroller') ||
              entry.answer.toLowerCase().includes('children') || entry.answer.toLowerCase().includes('stroller')) {
            sources.push(entry.sourceUrl);
          }
        }
      });
      
      // Always add the official children travel source
      sources.push('https://www.muscatairport.co.om/en/content/travelling-with-children');
      
      const processingTime = Date.now() - startTime;
      
      // Force use of children travel-specific knowledge base handler
      return {
        message: this.createChildrenTravelResponse(knowledgeEntries, message),
        success: true,
        provider: 'children-travel-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)], // Remove duplicates
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    // Parking-specific handler - use knowledge base directly for accurate rates
    if (isParkingQueryForced) {
      // Fetch parking entries directly from KB
      const parkingEntries = await prisma.knowledgeBase.findMany({
        where: {
          category: 'parking',
          isActive: true
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 15
      });

      sources.push('https://www.muscatairport.co.om/en/content/to-from#parking');
      
      const processingTime = Date.now() - startTime;
      
      // Try to find exact match first (for duration-specific queries like "30 minutes", "1 hour", etc.)
      const exact = this.findExactQuestionMatch(parkingEntries as any, message);
      if (exact) {
        return {
          message: this.formatKbAnswer(exact.answer),
          success: true,
          provider: 'parking-knowledge-base',
          processingTime,
          knowledgeBaseUsed: true,
          sources: [...new Set(sources)],
          kbEntryId: exact.id
        };
      }
      
      // Check for duration-specific queries and calculate costs
      const messageLower = message.toLowerCase();
      
      // Detect parking reservation queries
      const isReservationQuery = messageLower.includes('reservation') || messageLower.includes('reserve') || 
                                messageLower.includes('need') && messageLower.includes('reservation') ||
                                messageLower.includes('make') && messageLower.includes('reservation');
      
      // Handle reservation queries first
      if (isReservationQuery) {
        const reservationResponse = `🅿️ **Parking Reservation Information**\n\n`;
        const response = reservationResponse + 
          `**No reservation required!** Parking at Muscat International Airport is available on a first-come, first-served basis. You do not need to make a reservation in advance.\n\n` +
          `**📅 For your 2-day parking (27-29 April):**\n` +
          `• Simply drive to the airport and park in any available parking area\n` +
          `• Payment is made at automated ticket machines in each parking area\n` +
          `• Car parking attendants are available on-site 24/7 for assistance\n\n` +
          `**💰 Recommended Parking Options for 2 Days:**\n` +
          `• **P5 or P6 Long Term Parking:** OMR 3.000 for first 3 days (best value)\n` +
          `• **P3 Long Term Parking:** OMR 9.500 for 3 days\n` +
          `• **P1 Short Term:** OMR 25.200 for first 24 hours + OMR 21.000 per additional day\n\n` +
          `**💡 Tip:** P5 and P6 offer the best rates for multi-day parking. Look for signs directing you to these areas.\n\n` +
          `**📍 Payment:** Omani Riyals only at automated ticket machines in each car park. All rates include VAT.`;
        
        return {
          message: response,
          success: true,
          provider: 'parking-knowledge-base',
          processingTime,
          knowledgeBaseUsed: true,
          sources: [...new Set(sources)],
          kbEntryId: parkingEntries.length > 0 ? parkingEntries[0].id : undefined
        };
      }
      
      // Detect long-term parking queries (without specific days)
      const isLongTermQuery = messageLower.includes('long term') || messageLower.includes('long-term') || 
                             messageLower.includes('longterm') || messageLower.includes('offer') && messageLower.includes('parking');
      
      // Extract number of days from query
      const daysMatch = messageLower.match(/(\d+)\s*day/i);
      const days = daysMatch ? parseInt(daysMatch[1]) : null;
      
      // If query asks for specific number of days, calculate and recommend
      if (days && days > 0) {
        const response = this.calculateParkingForDays(days, parkingEntries);
        if (response) {
          return {
            message: response,
            success: true,
            provider: 'parking-knowledge-base',
            processingTime,
            knowledgeBaseUsed: true,
            sources: [...new Set(sources)],
            kbEntryId: parkingEntries.length > 0 ? parkingEntries[0].id : undefined
          };
        }
      }
      
      // If query is about long-term parking (without specific days), provide focused long-term rates
      if (isLongTermQuery) {
        const longTermResponse = this.createLongTermParkingResponse();
        if (longTermResponse) {
          return {
            message: longTermResponse,
            success: true,
            provider: 'parking-knowledge-base',
            processingTime,
            knowledgeBaseUsed: true,
            sources: [...new Set(sources)],
            kbEntryId: parkingEntries.length > 0 ? parkingEntries[0].id : undefined
          };
        }
      }
      
      // Try to find best match based on keywords (e.g., "30 minutes", "1 hour", "5 days")
      let bestMatch = null;
      let bestScore = 0;
      
      for (const entry of parkingEntries) {
        const entryText = (entry.question + ' ' + entry.answer).toLowerCase();
        let score = 0;
        
        // Check for duration keywords
        if (messageLower.includes('30 minute') || messageLower.includes('30 min')) {
          if (entryText.includes('30 minute') || entry.question.includes('30 minutes')) score += 100;
        }
        if (messageLower.includes('1 hour') || messageLower.includes('one hour')) {
          if (entryText.includes('1 hour') || entry.question.includes('1 hour')) score += 100;
        }
        if (messageLower.includes('2 hour') || messageLower.includes('two hour')) {
          if (entryText.includes('2 hour') || entry.question.includes('2 hours')) score += 100;
        }
        if (messageLower.includes('3 hour') || messageLower.includes('three hour')) {
          if (entryText.includes('3 hour') || entry.question.includes('3 hours')) score += 100;
        }
        if (messageLower.includes('5 day') || messageLower.includes('five day')) {
          if (entryText.includes('5 day') || entry.question.includes('5 days')) score += 100;
        }
        if (messageLower.includes('1 day') || messageLower.includes('one day') || messageLower.includes('daily')) {
          if (entryText.includes('1 day') || entry.question.includes('1 day') || entry.question.includes('daily')) score += 100;
        }
        
        // Check for zone keywords
        if (messageLower.includes('p1') || messageLower.includes('short term')) {
          if (entryText.includes('p1') || entryText.includes('short term')) score += 50;
        }
        if (messageLower.includes('p2') || messageLower.includes('premium')) {
          if (entryText.includes('p2') || entryText.includes('premium')) score += 50;
        }
        if (messageLower.includes('p3') || messageLower.includes('long term')) {
          if (entryText.includes('p3') || entryText.includes('long term')) score += 50;
        }
        if (messageLower.includes('p5') || messageLower.includes('p6')) {
          if (entryText.includes('p5') || entryText.includes('p6')) score += 60; // Higher score for P5/P6 queries
        }
        
        // General parking keywords
        if (messageLower.includes('rate') || messageLower.includes('cost') || messageLower.includes('price')) {
          if (entryText.includes('rate') || entryText.includes('cost') || entryText.includes('price')) score += 25;
        }
        
        // Priority boost
        score += (entry.priority || 0);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }
      
      // If we found a good match, use it
      if (bestMatch && bestScore > 50) {
        return {
          message: this.formatKbAnswer(bestMatch.answer),
          success: true,
          provider: 'parking-knowledge-base',
          processingTime,
          knowledgeBaseUsed: true,
          sources: [...new Set(sources)],
          kbEntryId: bestMatch.id
        };
      }
      
      // Fallback to top priority entry
      if (parkingEntries.length > 0) {
        return {
          message: this.formatKbAnswer(parkingEntries[0].answer),
          success: true,
          provider: 'parking-knowledge-base',
          processingTime,
          knowledgeBaseUsed: true,
          sources: [...new Set(sources)],
          kbEntryId: parkingEntries[0].id
        };
      }
    }

    if (isEGatesQueryForced) {
      // Collect E-Gates-specific sources  
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl) {
          // Include E-Gates entries and the official source
          if (entry.sourceUrl.includes('e-gate') || entry.category === 'e_gates' || 
              entry.question.toLowerCase().includes('e-gate') || entry.question.toLowerCase().includes('electronic') ||
              entry.answer.toLowerCase().includes('e-gate') || entry.answer.toLowerCase().includes('electronic')) {
            sources.push(entry.sourceUrl);
          }
        }
      });
      
      // Always add the official E-Gates source
      sources.push('https://www.muscatairport.co.om/en/content/e-gate');
      
      const processingTime = Date.now() - startTime;
      
      // Force use of E-Gates-specific knowledge base handler
      return {
        message: this.createEGatesResponse(knowledgeEntries, message),
        success: true,
        provider: 'e-gates-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)], // Remove duplicates
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    if (isCurrencyExchangeQueryForced) {
      // Collect currency exchange-specific sources  
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl) {
          // Include currency exchange entries and the official source
          if (entry.sourceUrl.includes('currency-exchange') || entry.category === 'currency_exchange' || 
              entry.question.toLowerCase().includes('currency') || entry.question.toLowerCase().includes('exchange') ||
              entry.answer.toLowerCase().includes('currency') || entry.answer.toLowerCase().includes('exchange')) {
            sources.push(entry.sourceUrl);
          }
        }
      });
      
      // Always add the official currency exchange source
      sources.push('https://www.muscatairport.co.om/en/content/currency-exchange');
      
      const processingTime = Date.now() - startTime;
      
      // Force use of currency exchange-specific knowledge base handler
      return {
        message: this.createCurrencyExchangeResponse(knowledgeEntries, message),
        success: true,
        provider: 'currency-exchange-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)], // Remove duplicates
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    if (isBankingQueryForced) {
      // Collect banking-specific sources  
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl) {
          // Include any banking-related entries
          if (entry.sourceUrl.includes('banking') || entry.category === 'banking_services' || 
              entry.question.toLowerCase().includes('atm') || entry.question.toLowerCase().includes('bank') ||
              entry.answer.toLowerCase().includes('atm') || entry.answer.toLowerCase().includes('bank') ||
              entry.answer.toLowerCase().includes('cash withdrawal') || entry.answer.toLowerCase().includes('currency exchange')) {
            sources.push(entry.sourceUrl);
          }
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      // Force use of banking-specific knowledge base handler
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'banking-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    if (isSmokingQueryForced && knowledgeEntries.length > 0) {
      // Collect smoking-specific sources
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl && (entry.sourceUrl.includes('refreshment-facilities') || entry.category === 'airport_facilities')) {
          sources.push(entry.sourceUrl);
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      // Force use of smoking-specific knowledge base handler
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'smoking-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    // Collect sources for hotel queries before early return
    if (isHotelQueryForced && knowledgeEntries.length > 0) {
      // Collect hotel-specific sources
      knowledgeEntries.forEach((entry, index) => {
        if (entry.sourceUrl && (entry.sourceUrl.includes('aerotel') || entry.category === 'hotel_services')) {
          sources.push(entry.sourceUrl);
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      // Force use of hotel-specific knowledge base handler
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'hotel-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    if (knowledgeEntries.length > 0) {
      knowledgeContext = '\n\nRelevant Information from Knowledge Base:\n';
      
            // Smart source collection: only from highly relevant entries
      const topEntry = knowledgeEntries[0];
      
      // Detect query type for better source filtering
      const isDiningQuery = messageLower.includes('kfc') || messageLower.includes('restaurant') || 
                           messageLower.includes('food') || messageLower.includes('dining') ||
                           messageLower.includes('coffee') || messageLower.includes('eat');
      const isSpaQuery = messageLower.includes('spa') || messageLower.includes('massage') || messageLower.includes('be relax') || messageLower.includes('berelax') || messageLower.includes('be relax spa') || messageLower.includes('relax spa');
      
      // Detect lounge-specific queries (including pricing queries)
      const isLoungeQuery = messageLower.includes('lounge') || messageLower.includes('primeclass') ||
                           messageLower.includes('porter') || messageLower.includes('entertainment') ||
                           (messageLower.includes('where') && (messageLower.includes('located') || messageLower.includes('find'))) ||
                           messageLower.includes('facilities') || messageLower.includes('amenities') ||
                           ((messageLower.includes('price') || messageLower.includes('cost') || messageLower.includes('charges') || 
                             messageLower.includes('pricing') || messageLower.includes('rate') || messageLower.includes('fee')) &&
                            (messageLower.includes('lounge') || messageLower.includes('primeclass')));
      
      // Detect relaxation intent (broader phrasing without the word "spa")
      const isRelaxQuery = messageLower.includes('relax') || messageLower.includes('de-stress') || messageLower.includes('destress') || messageLower.includes('rejuvenate');
      
      // Detect parking/transportation queries
      const isParkingQuery = messageLower.includes('parking') || messageLower.includes('park') ||
                            messageLower.includes('car') || messageLower.includes('vehicle');
      
      // Detect cargo/baggage-specific queries
      const isCargoQuery = messageLower.includes('cargo') || messageLower.includes('baggage') || 
                          messageLower.includes('luggage') || messageLower.includes('megaton') ||
                          messageLower.includes('seal') || messageLower.includes('porter') ||
                          messageLower.includes('trolley') || messageLower.includes('suitcase');
      
      // Detect hotel/accommodation-specific queries
      const isHotelQuery = messageLower.includes('hotel') || messageLower.includes('aerotel') ||
                          messageLower.includes('accommodation') || messageLower.includes('stay') ||
                          (messageLower.includes('room') && messageLower.includes('airport'));

      // Detect smoking area-specific queries
      const isSmokingQuery = messageLower.includes('smoking') || messageLower.includes('smoke') ||
                            messageLower.includes('smoking area') || messageLower.includes('smoking zone') ||
                            (messageLower.includes('where') && messageLower.includes('smoke'));

      // Detect banking/ATM-specific queries
      const isBankingQuery = messageLower.includes('atm') || messageLower.includes('bank') ||
                            messageLower.includes('banking') || messageLower.includes('cash') ||
                            messageLower.includes('money') || messageLower.includes('currency exchange') ||
                            (messageLower.includes('withdraw') && messageLower.includes('money'));

      // Detect medical-specific queries (but exclude ticket/booking queries)
      const hasTicketKeyword = messageLower.includes('ticket') || messageLower.includes('book') || 
                               messageLower.includes('booking') || messageLower.includes('reserve');
      const isMedicalQuery = !hasTicketKeyword && (
                            messageLower.includes('medical') || messageLower.includes('health') || 
                            messageLower.includes('clinic') || messageLower.includes('pharmacy') ||
                            messageLower.includes('first aid') || 
                            (messageLower.includes('emergency') && !messageLower.includes('ticket') && !messageLower.includes('book')) ||
                            messageLower.includes('doctor') || messageLower.includes('treatment') ||
                            messageLower.includes('medication') || messageLower.includes('medicine'));
      
      knowledgeEntries.forEach((entry, index) => {
        knowledgeContext += `${index + 1}. Q: ${entry.question}\n   A: ${entry.answer}\n`;
        
        // Smart source filtering logic - enhanced approach
        let shouldIncludeSource = false;
        
        if (entry.sourceUrl) {
          if (index === 0 && entry.relevanceScore > 15) {
            // Include top entry if it has decent relevance
            shouldIncludeSource = true;
          } else if (entry.relevanceScore > 25) {
            // Include high relevance entries
            shouldIncludeSource = true;
          } else if (isDiningQuery && entry.category.toLowerCase().includes('dining') && entry.relevanceScore > 15) {
            // For dining queries, only include dining-related sources
            shouldIncludeSource = true;
          } else if (!isDiningQuery && entry.category === topEntry.category && entry.relevanceScore > 20) {
            // For non-dining queries, same category with good relevance
            shouldIncludeSource = true;
          }
          
          // Enhanced exclusion logic for source relevance
          if (shouldIncludeSource) {
            const isDiningSource = entry.sourceUrl.includes('restaurants-quick-bites');
            const isLoungeSource = entry.sourceUrl.includes('primeclass-lounge');
            const isTransportSource = entry.sourceUrl.includes('to-from');
            const isBaggageSource = entry.sourceUrl.includes('baggage');
            const isSpaSource = entry.sourceUrl.includes('/spa');
            const isMedicalSource = entry.sourceUrl.includes('medical-services');
            const isHotelSource = entry.sourceUrl.includes('aerotel') || entry.category.toLowerCase().includes('hotel');
            
            // STRICT SOURCE FILTERING FOR MEDICAL QUERIES
            if (isMedicalQuery) {
              // For medical queries, ONLY include medical-related sources
              if (!isMedicalSource && (isDiningSource || isLoungeSource || isBaggageSource)) {
                shouldIncludeSource = false;
              }
            }
            
            // STRICT SOURCE FILTERING FOR CARGO/BAGGAGE QUERIES
            if (isCargoQuery) {
              // For cargo/baggage queries, ONLY include baggage-related sources
              if (!isBaggageSource && (isDiningSource || isLoungeSource)) {
                shouldIncludeSource = false;
              }
            }
            
            // STRICT SOURCE FILTERING FOR LOUNGE QUERIES
            if (isLoungeQuery) {
              // For lounge queries, ONLY include lounge-specific sources
              if (isDiningSource && !isLoungeSource) {
                shouldIncludeSource = false;
              }
            }
            
            // STRICT SOURCE FILTERING FOR PARKING QUERIES  
            if (isParkingQuery) {
              // For parking queries, exclude dining sources unless high relevance
              if (isDiningSource && entry.relevanceScore < 35) {
                shouldIncludeSource = false;
              }
            }

            // STRICT SOURCE FILTERING FOR SPA QUERIES
            if (isSpaQuery) {
              if (isDiningSource && !isSpaSource) {
                shouldIncludeSource = false;
              }
            }
            
            // STRICT SOURCE FILTERING FOR RELAXATION QUERIES (limit to spa, lounge, hotel)
            if (isRelaxQuery) {
              const allowed = isSpaSource || isLoungeSource || isHotelSource;
              if (!allowed) {
                shouldIncludeSource = false;
              }
            }
            
            // General filtering for dining vs non-dining queries
            if (isDiningQuery && (isLoungeSource || isTransportSource)) {
              // For dining queries, exclude lounge/transport sources
              shouldIncludeSource = false;
            } else if (!isDiningQuery && !isLoungeQuery && !isParkingQuery && !isCargoQuery && !isMedicalQuery && !isHotelQuery && isDiningSource && entry.relevanceScore < 25) {
              // For general queries, exclude low-relevance dining sources
              shouldIncludeSource = false;
            }
            
            // STRICT SOURCE FILTERING FOR HOTEL QUERIES
            if (isHotelQuery) {
              // For hotel queries, ONLY include hotel/accommodation sources
              if (isDiningSource || isLoungeSource || isTransportSource) {
                shouldIncludeSource = false;
              }
            }
          }
        }
        
        if (shouldIncludeSource && entry.sourceUrl) {
          sources.push(entry.sourceUrl);
        }
      });
      
      knowledgeContext += '\nPlease use this specific information to provide accurate, detailed responses.\n';
    }

    // Check if this is a follow-up question
    const isMarahebQuery = messageLower.includes('maraheb');
    
    // Special override for Maraheb queries - ensure official Maraheb URL is included
    if (isMarahebQuery && sources.length > 0 && !sources.includes('https://www.muscatairport.co.om/en/maraheb')) {
      sources.unshift('https://www.muscatairport.co.om/en/maraheb');
    }
    const isFollowUpQuestion = messageLower.includes('more details') || 
                              messageLower.includes('tell me more') ||
                              messageLower.includes('can you provide more') ||
                              messageLower.includes('what about') ||
                              messageLower.includes('more info') ||
                              messageLower.includes('elaborate') ||
                              messageLower.startsWith('more ') ||
                              messageLower === 'more' ||
                              messageLower.includes('details');

    // For listing questions (coffee, dining, etc) and baggage questions, use enhanced knowledge base for better formatting
    const isListingQuestion = messageLower.includes('coffee') || messageLower.includes('dining') || 
                              messageLower.includes('restaurant') || messageLower.includes('food') ||
                              messageLower.includes('where can i get') || messageLower.includes('what are');
                              
    // Detect baggage questions that should use direct knowledge base responses
    const isBaggageQuestion = messageLower.includes('baggage') || messageLower.includes('luggage') || 
                             messageLower.includes('suitcase') || messageLower.includes('bag') ||
                             messageLower.includes('weight') || messageLower.includes('size') ||
                             messageLower.includes('restrictions') || messageLower.includes('check-in') ||
                             messageLower.includes('carry-on') || messageLower.includes('lost') ||
                             messageLower.includes('damaged') || messageLower.includes('claim') ||
                             messageLower.includes('porter') || messageLower.includes('trolley') ||
                             messageLower.includes('cargo') || messageLower.includes('megaton') ||
                             messageLower.includes('seal') || messageLower.includes('sealing') ||
                             messageLower.includes('protection') || messageLower.includes('wrapping') ||
                             messageLower.includes('wrap');
    
    // Detect medical questions that should use direct knowledge base responses
    const isMedicalQuestion = messageLower.includes('medical') || messageLower.includes('health') || 
                             messageLower.includes('clinic') || messageLower.includes('pharmacy') ||
                             messageLower.includes('first aid') || messageLower.includes('emergency') ||
                             messageLower.includes('doctor') || messageLower.includes('treatment') ||
                             messageLower.includes('medication') || messageLower.includes('medicine');
    
    // Use enhanced knowledge base for listing questions, baggage questions, and medical questions (but not follow-ups which need AI context)
    if (knowledgeEntries.length > 0 && (isListingQuestion || isBaggageQuestion || isMedicalQuestion) && !isFollowUpQuestion) {
      const processingTime = Date.now() - startTime;
      
      // Use enhanced knowledge base for clean, structured responses
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'enhanced-knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    // Combine contexts
    const fullContext = context + knowledgeContext;

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        // Check quota before making API call
        if (provider.name === 'gemini') {
          const hasQuota = await this.checkAndUpdateQuota(provider.name);
          if (!hasQuota) {
            console.log('Gemini quota exceeded, trying next provider...');
            continue;
          }
        }

        let response: string;

        switch (provider.name) {
          case 'gemini':
            response = await this.callGemini(message, fullContext, provider, preferredLanguage);
            break;
          case 'huggingface':
            response = await this.callHuggingFace(message, fullContext, provider, preferredLanguage);
            break;
          case 'ollama':
            response = await this.callOllama(message, fullContext, provider, preferredLanguage);
            break;
          default:
            continue;
        }

        const processingTime = Date.now() - startTime;
        
        // Determine if this should be marked as needing knowledge base review
        // Mark as not using KB if:
        // 1. No knowledge entries found, OR
        // 2. Airport-related question but no strong knowledge match (weak relevance)
        const shouldMarkAsNeedsReview = !hasStrongKnowledgeMatch && isAirportRelated;
        
        const result: AIResponse = {
          message: this.formatResponse(response),
          success: true,
          provider: provider.name,
          processingTime,
          knowledgeBaseUsed: hasStrongKnowledgeMatch,
          sources: [...new Set(sources)], // Remove duplicates
          kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
        };

        this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
        // Best-effort cache trim
        if (this.responseCache.size > 500) {
          const firstKey = this.responseCache.keys().next().value as string | undefined;
          if (firstKey) this.responseCache.delete(firstKey);
        }
        
        return result;

      } catch (error) {
        console.log(`${provider.name} failed:`, error);
        continue;
      }
    }



    // Enhanced knowledge base fallback with intelligent processing
    if (knowledgeEntries.length > 0) {
      const processingTime = Date.now() - startTime;
      
      // Check if the top entry has sufficient relevance (avoid returning generic responses for irrelevant queries)
      const topEntry = knowledgeEntries[0];
      const topRelevanceScore = topEntry.relevanceScore || 0;
      
      // If relevance is too low, the knowledge base doesn't have relevant information
      // Return "no information available" response instead of a generic response
      if (topRelevanceScore < 20 && !hasStrongKnowledgeMatch) {
        const noInfoResponse = this.getNoInformationResponse(message, preferredLanguage);
        const result: AIResponse = {
          message: noInfoResponse,
          success: false,
          provider: 'no-information-available',
          processingTime,
          knowledgeBaseUsed: false,
          sources: [],
          kbEntryId: undefined
        };
        this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
        return result;
      }
      
      // Create comprehensive response using all relevant knowledge entries
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      // If response is empty (meaning no relevant info found), return no-info response
      if (!comprehensiveResponse || comprehensiveResponse.trim().length === 0) {
        const noInfoResponse = this.getNoInformationResponse(message, preferredLanguage);
        const result: AIResponse = {
          message: noInfoResponse,
          success: false,
          provider: 'no-information-available',
          processingTime,
          knowledgeBaseUsed: false,
          sources: [],
          kbEntryId: undefined
        };
        this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
        return result;
      }
      
      const result: AIResponse = {
        message: comprehensiveResponse,
        success: true,
        provider: 'enhanced-knowledge-base',
        processingTime,
        knowledgeBaseUsed: hasStrongKnowledgeMatch,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
      this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
      return result;
    }

    // Final fallback response if all providers fail
    const processingTime = Date.now() - startTime;
    const result: AIResponse = {
      message: this.getFallbackResponse(message, preferredLanguage),
      success: false,
      provider: 'fallback',
      processingTime,
      knowledgeBaseUsed: false, // Always false for fallback responses
      sources: [],
      kbEntryId: undefined
    };
    this.responseCache.set(cacheKey, { ts: Date.now(), data: result });
    return result;
  }

  private async callGemini(message: string, context: string, provider: AIProvider, preferredLanguage: 'ar' | 'en' = 'en'): Promise<string> {
    // Track RPM usage for real-time monitoring
    this.trackRpmUsage('gemini');
    
    const prompt = this.buildPrompt(message, context, preferredLanguage);
    
    const response = await fetch(`${provider.endpoint}/${provider.model}:generateContent?key=${provider.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1.0, // Optimal temperature for Gemini 2.5 Flash-Lite
          topK: 64, // Fixed value for 2.5 Flash-Lite
          topP: 0.95,
          maxOutputTokens: 8192, // Gemini 2.5 Flash-Lite supports up to 64k tokens
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
      return data.candidates[0].content.parts[0].text || 'I apologize, but I cannot provide a response at the moment.';
    }
    
    throw new Error('Invalid response format from Gemini API');
  }

  private async callHuggingFace(message: string, context: string, provider: AIProvider, preferredLanguage: 'ar' | 'en' = 'en'): Promise<string> {
    const prompt = this.buildPrompt(message, context, preferredLanguage);
    
    const response = await fetch(`${provider.endpoint}/${provider.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0]?.generated_text || data.generated_text || 'I apologize, but I cannot provide a response at the moment.';
  }

  private async callOllama(message: string, context: string, provider: AIProvider, preferredLanguage: 'ar' | 'en' = 'en'): Promise<string> {
    // Check if Ollama is available
    try {
      await fetch(`${provider.endpoint}/api/tags`);
    } catch {
      throw new Error('Ollama not available');
    }

    const prompt = this.buildPrompt(message, context, preferredLanguage);
    
    const response = await fetch(`${provider.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || 'I apologize, but I cannot provide a response at the moment.';
  }

  // Format AI responses for better readability and conciseness
  private formatResponse(response: string): string {
    let text = response.trim();
    
    // 1. Remove repeated phrases (common AI artifact)
    // Remove patterns like "للركن قصير الأمد) للركن قصير الأمد)"
    text = text.replace(/([^)]+\))\s*\1/g, '$1');
    
    // 2. Clean up markdown formatting issues
    // Fix triple asterisks: ***text** → **text**
    text = text.replace(/\*\*\*([^*]+)\*\*/g, '**$1**');
    
    // Fix patterns like **text**:** → **text:**
    text = text.replace(/\*\*([^*]+)\*\*:\*\*/g, '**$1:**');
    
    // Fix unmatched or broken bold markers
    text = text.replace(/\*\*([^*\n]+)\*\*/g, (match, content) => {
      // Only keep if it's a reasonable length (not a formatting artifact)
      if (content.trim().length > 0 && content.trim().length < 100) {
        return `**${content.trim()}**`;
      }
      return content.trim();
    });
    
    // Remove standalone asterisks that are formatting artifacts
    text = text.replace(/\s+\*\s+/g, ' ');
    text = text.replace(/\s+\*\*\s+/g, ' ');
    
    // 3. Fix spacing around punctuation (works for both Arabic and English)
    text = text.replace(/\s+([.,:;!?])/g, '$1');
    text = text.replace(/([.,:;!?])\s*([.,:;!?])/g, '$1$2');
    
    // 4. Ensure bullet points have proper spacing
    text = text.replace(/•\s*/g, '• ');
    text = text.replace(/\*\s+/g, '• '); // Convert * to • for consistency
    
    // 5. Fix Arabic-specific formatting issues
    // Remove extra spaces around Arabic parentheses
    text = text.replace(/\s+\)/g, ')');
    text = text.replace(/\(\s+/g, '(');
    
    // Fix spacing around Arabic text and numbers
    text = text.replace(/([\u0600-\u06FF])\s+(\d)/g, '$1 $2');
    text = text.replace(/(\d)\s+([\u0600-\u06FF])/g, '$1 $2');
    
    // 6. Remove duplicate phrases (but be careful not to remove legitimate repetition)
    // Look for exact duplicate phrases within parentheses or repeated patterns
    text = text.replace(/([^)]+\))\s*\1/g, '$1'); // Remove duplicate parenthetical phrases
    
    // Remove very similar consecutive sentences (more than 80% similarity)
    const sentences = text.split(/[.!?]\s+/);
    if (sentences.length > 1) {
      const uniqueSentences: string[] = [];
      for (let i = 0; i < sentences.length; i++) {
        const current = sentences[i].trim();
        if (current.length < 15) {
          // Keep short sentences (likely not duplicates)
          uniqueSentences.push(current);
          continue;
        }
        
        // Check if this sentence is very similar to the previous one
        const prev = i > 0 ? sentences[i - 1].trim() : '';
        if (prev && current.length > 0 && prev.length > 0) {
          // Simple similarity check: if more than 80% of words match, skip
          const currentWords = current.toLowerCase().split(/\s+/);
          const prevWords = prev.toLowerCase().split(/\s+/);
          const commonWords = currentWords.filter(w => prevWords.includes(w));
          const similarity = commonWords.length / Math.max(currentWords.length, prevWords.length);
          
          if (similarity > 0.8 && currentWords.length > 5) {
            // Very similar, likely a duplicate - skip
            continue;
          }
        }
        
        uniqueSentences.push(current);
      }
      
      // Only use deduplicated version if we actually removed something
      if (uniqueSentences.length < sentences.length && uniqueSentences.length > 0) {
        text = uniqueSentences.join('. ') + (text.match(/[.!?]$/) ? '' : '.');
      }
    }
    
    // 7. Clean up excessive whitespace (but preserve paragraph structure)
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space (but keep newlines)
    text = text.replace(/\n[ \t]+/g, '\n'); // Remove spaces after newlines
    text = text.replace(/[ \t]+\n/g, '\n'); // Remove spaces before newlines
    text = text.replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double (preserve paragraphs)
    
    // 8. Fix formatting around colons and special characters
    text = text.replace(/:\s*\*\*/g, ':**');
    text = text.replace(/\*\*:\s*/g, '**: ');
    
    // 9. Remove trailing formatting artifacts
    text = text.replace(/\s+\*\*?\s*$/g, '');
    text = text.replace(/^\s*\*\*?\s+/g, '');
    
    // 10. Final cleanup - trim and normalize
    text = text.trim();
    text = text.replace(/\n{3,}/g, '\n\n'); // Collapse excessive blank lines
    
    return text;
  }

  // Utility: keep only spa-relevant entries
  private filterSpaEntries(entries: ScoredKnowledgeEntry[]): ScoredKnowledgeEntry[] {
    return entries.filter(e => {
      const q = e.question.toLowerCase();
      const a = e.answer.toLowerCase();
      const c = e.category.toLowerCase();
      const u = (e.sourceUrl || '').toLowerCase();
      return u.includes('/spa') || c.includes('spa') || q.includes('spa') || a.includes('spa') || q.includes('be relax') || a.includes('be relax');
    });
  }

  // Generate concise spa answer (location/hours/services) from entries
  private createSpaServicesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string): string {
    const lower = userQuestion.toLowerCase();
    const officialUrl = 'https://www.muscatairport.co.om/en/content/spa';

    const text = (entries || []).map(e => `${e.question} ${e.answer}`).join(' \n ').toLowerCase();

    // Heuristics
    const has24h = /24\s*hours|24\/7|open\s*24/.test(text);
    const location = /gate\s*a3|near\s*gate\s*a3|departures/.test(text) ? 'Departures area near Gate A3' : undefined;

    // Handle follow-ups like "tell me more"
    if (lower.includes('tell me more') || lower.includes('more details') || lower.includes('more about') || lower === 'more' || lower.includes('details')) {
      const parts: string[] = [];
      parts.push('Yes — Be Relax Spa is available at Muscat International Airport.');
      if (location) parts.push(`Location: ${location}.`);
      parts.push(`Hours: ${has24h ? '24 hours a day' : 'Open daily (check on arrival for exact hours)'}.`);
      parts.push('Services: massages, aromatherapy and nail care.');
      return parts.join(' ');
    }

    if (lower.includes('hours') || lower.includes('operating') || lower.includes('open')) {
      if (has24h) return `Be Relax Spa operates 24 hours a day.`;
      return `Be Relax Spa is open daily. Please check on arrival for exact hours.`;
    }

    if (lower.includes('where') || lower.includes('located') || lower.includes('location')) {
      if (location) return `Be Relax Spa is located in the ${location}.`;
      return `Be Relax Spa is in the passenger terminal (Departures side).`;
    }

    if (lower.includes('services') || lower.includes('offer')) {
      return `Be Relax Spa offers relaxation services such as massages, aromatherapy and nail care.`;
    }

    return `Yes — Be Relax Spa is available at Muscat International Airport.`;
  }

  private createCarRentalResponse(entries: ScoredKnowledgeEntry[], userQuestion: string): string {
    const lowerQ = (userQuestion || '').toLowerCase();
    const raw = (entries||[]).map(e=>`${e.question} ${e.answer}`).join(' ');
    const text = raw.toLowerCase();

    // If the user is asking about companies, extract them and format
    if (lowerQ.includes('company') || lowerQ.includes('companies') || lowerQ.includes('which')) {
      const companies = this.extractCarRentalCompanies(raw);
      if (companies.length > 0) {
        return ['**Car Rental Companies:**', ...companies.map(n=>`• ${n}`), '• Counters: Arrivals hall (public hall).'].join('\n');
      }
    }

    const hasPickup = /level\s*0|ground\s*level|south\s*parking|rental car park/.test(text);
    const pickup = hasPickup ? '• Pick-up: Level 0 (south parking) after completing formalities.' : '• Pick-up: Follow signs to the rental car park after completing formalities.';
    const counters = '• Counters: Arrivals hall (public hall).';
    return [
      '**Car Rental:**',
      '• Available at Muscat International Airport.',
      counters,
      pickup,
      '• Documents: Valid driving licence and ID may be required.'
    ].join('\n');
  }

  private createTaxiResponse(entries: ScoredKnowledgeEntry[], userQuestion: string): string {
    return 'Yes, airport taxis are available outside the terminal. Follow the taxi signs from arrivals.';
  }

  private createBusShuttleResponse(entries: ScoredKnowledgeEntry[], userQuestion: string): string {
    return 'Yes, public bus/shuttle services operate from the airport. Follow bus signs to the designated stops outside arrivals.';
  }

  private createSecurityInfoResponse(entries: ScoredKnowledgeEntry[], userQuestion: string): string {
    return 'Please allow extra time for security screening and follow liquids and electronics rules as posted at checkpoints.';
  }

  // Utilities for exact KB alignment
  private normalizeQuestion(q: string): string {
    return q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  private findExactQuestionMatch(entries: any[], userQuestion: string): any | null {
    const nq = this.normalizeQuestion(userQuestion);
    let best: any | null = null;
    for (const e of entries) {
      const ne = this.normalizeQuestion(e.question || '');
      if (ne === nq) {
        if (!best || (e.priority ?? 0) > (best.priority ?? 0)) best = e;
      }
    }
    return best;
  }

  private formatKbAnswer(answer: string): string {
    // Simple formatting: ensure bullets render nicely and collapse whitespace
    return (answer || '').replace(/\s+/g, ' ').replace(/•\s*/g, '• ');
  }

  private calculateParkingForDays(days: number, parkingEntries: any[]): string | null {
    if (days <= 0) return null;
    
    // Calculate costs for each zone
    let p1Cost = 0;
    let p2Cost = 0;
    let p3Cost = 0;
    let p5Cost = 0;
    let p6Cost = 0;
    
    // P1: First 24 hours = 25.200, then 21.000 per day
    if (days === 1) {
      p1Cost = 25.200;
    } else {
      p1Cost = 25.200 + (21.000 * (days - 1));
    }
    
    // P2: First 24 hours = 5.300, then 5.300 per day
    p2Cost = 5.300 * days;
    
    // P3: 1 day = 3.200, 2 days = 6.300, 3 days = 9.500, then 3.200 per day
    if (days === 1) {
      p3Cost = 3.200;
    } else if (days === 2) {
      p3Cost = 6.300;
    } else if (days === 3) {
      p3Cost = 9.500;
    } else {
      p3Cost = 9.500 + (3.200 * (days - 3));
    }
    
    // P5 and P6: 1 day = 1.000, 2 days = 2.000, 3 days = 3.000, then 1.000 per day (offer valid until end of December 2025)
    if (days === 1) {
      p5Cost = 1.000;
      p6Cost = 1.000;
    } else if (days === 2) {
      p5Cost = 2.000;
      p6Cost = 2.000;
    } else if (days === 3) {
      p5Cost = 3.000;
      p6Cost = 3.000;
    } else {
      p5Cost = 3.000 + (1.000 * (days - 3));
      p6Cost = 3.000 + (1.000 * (days - 3));
    }
    
    // Determine best option (including P5 and P6)
    const costs = [
      { zone: 'P1 Short Term', cost: p1Cost },
      { zone: 'P2 Premium Long Stay', cost: p2Cost },
      { zone: 'P3 Long Term', cost: p3Cost },
      { zone: 'P5 Long Term', cost: p5Cost },
      { zone: 'P6 Long Term', cost: p6Cost }
    ];
    costs.sort((a, b) => a.cost - b.cost);
    const best = costs[0];
    
    // Build response
    let response = `**Parking Rates for ${days} ${days === 1 ? 'Day' : 'Days'} at Muscat International Airport:**\n\n`;
    
    response += `**P1 Short Term Parking:**\n`;
    response += `- First 24 hours: OMR 25.200\n`;
    if (days > 1) {
      response += `- Additional ${days - 1} ${days - 1 === 1 ? 'day' : 'days'}: OMR ${(21.000 * (days - 1)).toFixed(3)}\n`;
    }
    response += `- **Total: OMR ${p1Cost.toFixed(3)}**\n\n`;
    
    response += `**P2 Premium Long Stay:**\n`;
    response += `- OMR 5.300 per day × ${days} ${days === 1 ? 'day' : 'days'}\n`;
    response += `- **Total: OMR ${p2Cost.toFixed(3)}**\n\n`;
    
    response += `**P3 Long Term Parking:**\n`;
    if (days <= 3) {
      response += `- ${days} ${days === 1 ? 'day' : 'days'}: OMR ${p3Cost.toFixed(3)}\n`;
    } else {
      response += `- First 3 days: OMR 9.500\n`;
      response += `- Additional ${days - 3} ${days - 3 === 1 ? 'day' : 'days'}: OMR ${(3.200 * (days - 3)).toFixed(3)}\n`;
    }
    response += `- **Total: OMR ${p3Cost.toFixed(3)}**\n\n`;
    
    response += `**P5 Long Term Parking (Special Offer):**\n`;
    if (days <= 3) {
      response += `- ${days} ${days === 1 ? 'day' : 'days'}: OMR ${p5Cost.toFixed(3)}\n`;
    } else {
      response += `- First 3 days: OMR 3.000\n`;
      response += `- Additional ${days - 3} ${days - 3 === 1 ? 'day' : 'days'}: OMR ${(1.000 * (days - 3)).toFixed(3)}\n`;
    }
    response += `- **Total: OMR ${p5Cost.toFixed(3)}**\n`;
    response += `- Offer valid until end of December 2025\n\n`;
    
    response += `**P6 Long Term Parking (Special Offer):**\n`;
    if (days <= 3) {
      response += `- ${days} ${days === 1 ? 'day' : 'days'}: OMR ${p6Cost.toFixed(3)}\n`;
    } else {
      response += `- First 3 days: OMR 3.000\n`;
      response += `- Additional ${days - 3} ${days - 3 === 1 ? 'day' : 'days'}: OMR ${(1.000 * (days - 3)).toFixed(3)}\n`;
    }
    response += `- **Total: OMR ${p6Cost.toFixed(3)}**\n`;
    response += `- Offer valid until end of December 2025\n\n`;
    
    response += `**⭐ Recommendation:** For ${days} ${days === 1 ? 'day' : 'days'}, **${best.zone}** offers the best value at **OMR ${best.cost.toFixed(3)}** total.\n\n`;
    
    response += `**Payment:** Omani Riyals only at automated ticket machines in each car park. Car parking attendants are available on-site 24 hours a day, 7 days a week.`;
    
    return response;
  }

  // Create well-formatted response for long-term parking queries (without specific days)
  private createLongTermParkingResponse(): string {
    let response = `**Long-Term Parking Options at Muscat International Airport**\n\n`;
    
    response += `For extended stays, we offer several economical long-term parking options:\n\n`;
    
    // Highlight P5 and P6 first (best offers)
    response += `**⭐ P5 & P6 Long Term Parking (Special Offer - Best Value!)**\n`;
    response += `• **1 day:** OMR 1.000\n`;
    response += `• **2 days:** OMR 2.000\n`;
    response += `• **3 days:** OMR 3.000\n`;
    response += `• **Each additional day:** OMR 1.000 per day\n`;
    response += `• **Offer valid until:** End of December 2025\n\n`;
    response += `*This is our most economical option for long-term parking!*\n\n`;
    
    // P3 Long Term
    response += `**P3 Long Term Parking:**\n`;
    response += `• **1 day:** OMR 3.200\n`;
    response += `• **2 days:** OMR 6.300\n`;
    response += `• **3 days:** OMR 9.500\n`;
    response += `• **Each additional day:** OMR 3.200 per day\n\n`;
    
    // P2 Premium Long Stay (for comparison)
    response += `**P2 Premium Long Stay (Alternative):**\n`;
    response += `• **Per day:** OMR 5.300\n`;
    response += `• *More expensive than P3, P5, and P6 for long stays*\n\n`;
    
    // Recommendation
    response += `**💡 Recommendation:**\n`;
    response += `For stays of **3 days or more**, **P5 or P6** offer the best value at just OMR 1.000 per day after the first 3 days. This is significantly cheaper than other options.\n\n`;
    
    // Payment info
    response += `**Payment:** Omani Riyals only at automated ticket machines in each car park. All rates include VAT. Car parking attendants are available on-site 24 hours a day, 7 days a week.`;
    
    return response;
  }

  // Format car rental KB answer into a compact, well-structured card-like text
  private formatCarRentalAnswer(answer: string): string {
    const text = (answer || '').replace(/\s+/g, ' ').toLowerCase();
    const counters = /arrivals/.test(text) ? '• Counters: Arrivals hall (public hall).' : '• Counters: In terminal rental desks.';
    const pickup = /level\s*0|south\s*parking|rental car park/.test(text)
      ? '• Pick-up: Level 0 (south parking) after completing formalities.'
      : '• Pick-up: Follow signs to the rental car park after completing formalities.';
    const open24 = /24\s*hours|24\/7|open\s*24/.test(text) ? '• Hours: 24 hours a day.' : '';
    const hasEuropcar = /europcar/.test(text);
    const hasThrifty = /thrifty/.test(text);
    const companies = hasEuropcar || hasThrifty ? `• Companies: ${[hasEuropcar?'Europcar':null,hasThrifty?'Thrifty':null].filter(Boolean).join(', ')} and others.` : '';
    const lines = [
      '**Car Rental:**',
      '• Available at Muscat International Airport.',
      counters,
      pickup,
      open24,
      companies
    ].filter(Boolean);
    return lines.join('\n');
  }

  private extractCarRentalCompanies(raw: string): string[] {
    const text = (raw || '').toLowerCase();
    const known = ['europcar','thrifty','avis','budget','hertz','sixt','dollar','payless','enterprise','national','alamo'];
    const found = new Set<string>();
    for (const name of known) {
      if (text.includes(name)) {
        found.add(name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
    // Also capture capitalized words adjacent to emails/urls if present (simple heuristic)
    const urlNameMatches = raw.match(/www\.[a-z0-9\-]+\.(?:com|om|net)/gi) || [];
    urlNameMatches.forEach(u => {
      const base = u.replace(/^www\./i,'').split('.')[0];
      if (base && base.length >= 3 && !/[0-9]/.test(base)) {
        const pretty = base.charAt(0).toUpperCase() + base.slice(1);
        if (pretty.length <= 20) found.add(pretty);
      }
    });
    return Array.from(found);
  }

  // Runtime normalization: map aliases to canonical tokens for better matching
  private normalizeQuery(query: string): string {
    let q = query;
    const lower = query.toLowerCase();
    for (const [canonical, list] of Object.entries(ALIASES)) {
      for (const alias of list) {
        if (lower.includes(alias)) {
          q = q.replace(new RegExp(alias, 'ig'), canonical);
        }
      }
    }
    return q;
  }

  private buildCacheKey(message: string): string {
    return this.normalizeQuery(message).trim().toLowerCase();
  }

  // Create comprehensive response using multiple knowledge entries
  private createComprehensiveKnowledgeResponse(
    userQuestion: string, 
    knowledgeEntries: ScoredKnowledgeEntry[]
  ): string {
    const questionLower = userQuestion.toLowerCase();
    
    // Enhanced question analysis for better response routing
    const questionType = this.analyzeQuestionType(questionLower);
    
    switch (questionType) {
      // MEDICAL-SPECIFIC RESPONSE TYPES
      case 'medical-clinic':
        return this.createMedicalClinicResponse(knowledgeEntries);
      
      case 'medical-pharmacy':
        return this.createMedicalPharmacyResponse(knowledgeEntries);
      
      case 'medical-emergency':
        return this.createMedicalEmergencyResponse(knowledgeEntries);
      
      case 'medical-general':
        return this.createMedicalGeneralResponse(knowledgeEntries);
      
      // BAGGAGE-SPECIFIC RESPONSE TYPES
      case 'baggage-weight-size':
        return this.createBaggageWeightSizeResponse(knowledgeEntries);
      
      case 'baggage-checkin':
        return this.createBaggageCheckinResponse(knowledgeEntries);
      
      case 'baggage-issues':
        return this.createBaggageIssuesResponse(knowledgeEntries);
      
      case 'baggage-services':
        return this.createBaggageServicesResponse(knowledgeEntries);
      
      case 'baggage-cargo':
        return this.createBaggageCargoResponse(knowledgeEntries);
      
      case 'baggage-sealing':
        return this.createBaggageSealingResponse(knowledgeEntries);
      
      case 'baggage-general':
        return this.createBaggageGeneralResponse(knowledgeEntries);
      
      // WI-FI SERVICES RESPONSE TYPE
      case 'wifi-services':
        return this.createWiFiServicesResponse(knowledgeEntries, userQuestion);

      // CHILDREN TRAVEL RESPONSE TYPE
      case 'children-travel':
        return this.createChildrenTravelResponse(knowledgeEntries, userQuestion);

      // E-GATES RESPONSE TYPE
      case 'e-gates':
        return this.createEGatesResponse(knowledgeEntries, userQuestion);

      // CURRENCY EXCHANGE RESPONSE TYPE
      case 'currency-exchange':
        return this.createCurrencyExchangeResponse(knowledgeEntries, userQuestion);

      // PARKING SERVICES RESPONSE TYPE
      case 'parking-services':
        return this.createParkingServicesResponse(knowledgeEntries, userQuestion);

      // BANKING SERVICES RESPONSE TYPE
      case 'banking-services':
        return this.createBankingServicesResponse(knowledgeEntries, userQuestion);

      // SMOKING FACILITIES RESPONSE TYPE
      case 'smoking-facilities':
        return this.createSmokingFacilitiesResponse(knowledgeEntries);

      // HOTEL SERVICES RESPONSE TYPE
      case 'hotel-services':
        return this.createHotelServicesResponse(knowledgeEntries);
      
      // PRIMECLASS SERVICES RESPONSE TYPE
      case 'primeclass-services':
        return this.createPrimeclassServicesResponse(knowledgeEntries, userQuestion);
      
      // DINING-SPECIFIC RESPONSE TYPES
      case 'comprehensive-overview':
        return this.createDetailedOverviewResponse(knowledgeEntries);
      
      case 'specific-cuisine':
        return this.createSpecificCuisineResponse(questionLower, knowledgeEntries);
      
      case 'specific-restaurant':
        return this.createSpecificRestaurantResponse(questionLower, knowledgeEntries);
      
      case 'location-based':
        return this.createLocationBasedResponse(questionLower, knowledgeEntries);
      
      case 'service-based':
        return this.createServiceBasedResponse(questionLower, knowledgeEntries);
      
      case 'lounge-access':
        // Check if we have relevant lounge entries
        const loungeEntries = knowledgeEntries.filter(e => 
          e.category === 'lounge' || 
          e.category === 'lounge_facilities' ||
          (e.sourceUrl && e.sourceUrl.includes('lounge')) ||
          e.answer.toLowerCase().includes('lounge')
        );
        // If no relevant lounge entries, return empty to trigger no-info response
        if (loungeEntries.length === 0 || (loungeEntries[0].relevanceScore || 0) < 20) {
          return '';
        }
        return this.createLoungeAccessResponse(loungeEntries, userQuestion);
      
      case 'general':
      default:
        // For general queries, check if entries are actually relevant
        // If not dining-related and low relevance, return empty to trigger no-info response
        return this.createDetailedOverviewResponse(knowledgeEntries);
    }
  }
  
  private analyzeQuestionType(questionLower: string): string {
    // MEDICAL-SPECIFIC QUESTION TYPES - HIGH PRIORITY
    if (questionLower.includes('medical') || questionLower.includes('health') || 
        questionLower.includes('clinic') || questionLower.includes('pharmacy') ||
        questionLower.includes('first aid') || questionLower.includes('emergency') ||
        questionLower.includes('doctor') || questionLower.includes('treatment') ||
        questionLower.includes('medication') || questionLower.includes('medicine')) {
      
      if (questionLower.includes('clinic') || questionLower.includes('medical clinic')) {
        return 'medical-clinic';
      } else if (questionLower.includes('pharmacy') || questionLower.includes('medication') || questionLower.includes('medicine')) {
        return 'medical-pharmacy';
      } else if (questionLower.includes('emergency') || questionLower.includes('urgent') || questionLower.includes('first aid')) {
        return 'medical-emergency';
      } else {
        return 'medical-general';
      }
    }
    
    // BAGGAGE-SPECIFIC QUESTION TYPES - HIGH PRIORITY
    if (questionLower.includes('baggage') || questionLower.includes('luggage') || 
        questionLower.includes('suitcase') || questionLower.includes('bag') ||
        questionLower.includes('weight') || questionLower.includes('size') ||
        questionLower.includes('restrictions') || questionLower.includes('check-in') ||
        questionLower.includes('carry-on') || questionLower.includes('lost') ||
        questionLower.includes('damaged') || questionLower.includes('claim') ||
        questionLower.includes('porter') || questionLower.includes('trolley') ||
        questionLower.includes('seal') || questionLower.includes('sealing') ||
        questionLower.includes('protection') || questionLower.includes('wrapping') ||
        questionLower.includes('cargo') || questionLower.includes('megaton')) {
      
      if (questionLower.includes('cargo') || questionLower.includes('megaton')) {
        return 'baggage-cargo';
      } else if (questionLower.includes('seal') || questionLower.includes('sealing') || 
          questionLower.includes('protection') || questionLower.includes('wrapping') ||
          (questionLower.includes('cost') && (questionLower.includes('baggage') || questionLower.includes('luggage'))) ||
          (questionLower.includes('much') && questionLower.includes('does') && questionLower.includes('it'))) {
        return 'baggage-sealing';
      } else if (questionLower.includes('weight') && questionLower.includes('size')) {
        return 'baggage-weight-size';
      } else if (questionLower.includes('check-in') || questionLower.includes('check in')) {
        return 'baggage-checkin';
      } else if (questionLower.includes('lost') || questionLower.includes('damaged')) {
        return 'baggage-issues';
      } else if (questionLower.includes('porter') || questionLower.includes('trolley')) {
        return 'baggage-services';
      } else {
        return 'baggage-general';
      }
    }
    
    // FREE WI-FI QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('wi-fi') ||
        questionLower.includes('wifi') ||
        questionLower.includes('wireless') ||
        questionLower.includes('internet') ||
        questionLower.includes('free wifi') ||
        questionLower.includes('free wi-fi') ||
        questionLower.includes('wifi password') ||
        questionLower.includes('wi-fi password') ||
        questionLower.includes('wifi access') ||
        questionLower.includes('wifi connection') ||
        questionLower.includes('wifi network') ||
        questionLower.includes('wifi login') ||
        questionLower.includes('connect to wifi') ||
        questionLower.includes('connect to wi-fi') ||
        (questionLower.includes('internet') && questionLower.includes('airport')) ||
        (questionLower.includes('wifi') && (questionLower.includes('available') || questionLower.includes('free') || questionLower.includes('how'))) ||
        (questionLower.includes('wireless') && questionLower.includes('internet'))) {
      return 'wifi-services';
    }

    // TRAVELLING WITH CHILDREN QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('travelling with children') ||
        questionLower.includes('traveling with children') ||
        questionLower.includes('baby stroller') ||
        questionLower.includes('baby strollers') ||
        questionLower.includes('children facilities') ||
        questionLower.includes('family facilities') ||
        questionLower.includes('unaccompanied minor') ||
        questionLower.includes('unaccompanied minors') ||
        questionLower.includes('child travel') ||
        questionLower.includes('kids facilities') ||
        (questionLower.includes('stroller') && questionLower.includes('airport')) ||
        (questionLower.includes('children') && (questionLower.includes('service') || questionLower.includes('facilities') || questionLower.includes('area'))) ||
        (questionLower.includes('baby') && (questionLower.includes('facilities') || questionLower.includes('equipment') || questionLower.includes('service'))) ||
        (questionLower.includes('family') && questionLower.includes('travel'))) {
      return 'children-travel';
    }

    // E-GATES QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('e-gate') ||
        questionLower.includes('e-gates') ||
        questionLower.includes('egates') ||
        questionLower.includes('egate') ||
        questionLower.includes('electronic gate') ||
        questionLower.includes('electronic gates') ||
        questionLower.includes('electronic immigration') ||
        questionLower.includes('automated immigration') ||
        questionLower.includes('smart card immigration') ||
        questionLower.includes('fingerprint immigration') ||
        (questionLower.includes('electronic') && questionLower.includes('immigration')) ||
        (questionLower.includes('automated') && questionLower.includes('passport')) ||
        (questionLower.includes('fast') && questionLower.includes('immigration')) ||
        (questionLower.includes('egates') && questionLower.includes('available')) ||
        (questionLower.includes('e-gates') && questionLower.includes('available'))) {
      return 'e-gates';
    }

    // CURRENCY EXCHANGE QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('currency exchange') ||
        questionLower.includes('money exchange') ||
        questionLower.includes('foreign exchange') ||
        questionLower.includes('exchange money') ||
        questionLower.includes('exchange currency') ||
        questionLower.includes('exchange service') ||
        questionLower.includes('exchange counter') ||
        questionLower.includes('change money') ||
        (questionLower.includes('exchange') && (questionLower.includes('available') || questionLower.includes('where'))) ||
        (questionLower.includes('currency') && (questionLower.includes('available') || questionLower.includes('service'))) ||
        questionLower.includes('foreign currency') ||
        questionLower.includes('omani rial')) {
      return 'currency-exchange';
    }

    // CAR PARKING QUESTION TYPES - HIGH PRIORITY
    if (questionLower.includes('parking') ||
        questionLower.includes('car park') ||
        questionLower.includes('vehicle parking') ||
        questionLower.includes('parking rates') ||
        questionLower.includes('parking cost') ||
        questionLower.includes('parking fees') ||
        questionLower.includes('short term parking') ||
        questionLower.includes('long term parking') ||
        questionLower.includes('hourly parking') ||
        questionLower.includes('daily parking') ||
        questionLower.includes('weekly parking') ||
        (questionLower.includes('where') && questionLower.includes('park')) ||
        (questionLower.includes('how much') && questionLower.includes('park')) ||
        (questionLower.includes('cost') && questionLower.includes('park')) ||
        (questionLower.includes('rates') && questionLower.includes('airport')) ||
        questionLower.includes('parking available') ||
        questionLower.includes('parking facility')) {
      return 'parking-services';
    }

    // BANKING/ATM QUESTION TYPES - HIGH PRIORITY
    if (questionLower.includes('atm') ||
        questionLower.includes('bank') ||
        questionLower.includes('banking') ||
        questionLower.includes('cash withdrawal') ||
        (questionLower.includes('where') && (questionLower.includes('atm') || questionLower.includes('bank'))) ||
        (questionLower.includes('withdraw') && questionLower.includes('money')) ||
        questionLower.includes('banking services') ||
        questionLower.includes('atm machine')) {
      return 'banking-services';
    }

    // SMOKING AREA QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('smoking area') ||
        questionLower.includes('smoking zone') ||
        (questionLower.includes('location') && questionLower.includes('smoking')) ||
        (questionLower.includes('where') && questionLower.includes('smoking')) ||
        (questionLower.includes('where') && questionLower.includes('smoke')) ||
        questionLower.includes('can i smoke') ||
        questionLower.includes('smoking allowed') ||
        questionLower.includes('designated smoking')) {
      return 'smoking-facilities';
    }

    // HOTEL SERVICES QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('hotel') ||
        questionLower.includes('aerotel') ||
        questionLower.includes('accommodation') ||
        (questionLower.includes('stay') && questionLower.includes('airport')) ||
        (questionLower.includes('room') && questionLower.includes('airport')) ||
        (questionLower.includes('sleep') && questionLower.includes('airport')) ||
        questionLower.includes('layover accommodation') ||
        questionLower.includes('transit hotel') ||
        (questionLower.includes('hotel available') && questionLower.includes('airport')) ||
        (questionLower.includes('there hotel') && questionLower.includes('airport'))) {
      return 'hotel-services';
    }

    // VIP & ASSISTANCE SERVICES QUESTION TYPES - HIGHEST PRIORITY
    if (questionLower.includes('vip services') ||
        questionLower.includes('vip service') ||
        (questionLower.includes('vip') && questionLower.includes('assistance')) ||
        (questionLower.includes('assistance') && (questionLower.includes('airport process') || questionLower.includes('first time'))) ||
        (questionLower.includes('first time traveler') && questionLower.includes('assistance')) ||
        (questionLower.includes('traveling alone') && questionLower.includes('assistance')) ||
        (questionLower.includes('help') && questionLower.includes('airport process')) ||
        (questionLower.includes('services offered') && questionLower.includes('assistance'))) {
      return 'primeclass-services';
    }

    // PRIMECLASS SERVICES QUESTION TYPES - HIGH PRIORITY
    if (questionLower.includes('departure services') || 
        questionLower.includes('primeclass services') ||
        questionLower.includes('arrival services') ||
        questionLower.includes('assisted arrival') ||
        questionLower.includes('arrival service') ||
        questionLower.includes('fast-track service') ||
        questionLower.includes('transit service') ||
        questionLower.includes('meet and assist') ||
        questionLower.includes('meet & assist') ||
        (questionLower.includes('services available') && (questionLower.includes('departure') || questionLower.includes('arrival'))) ||
        (questionLower.includes('what services') && questionLower.includes('airport'))) {
      return 'primeclass-services';
    }
    
    // Comprehensive overview questions
    if (questionLower.includes('dining options available') || 
        questionLower.includes('what dining options') ||
        questionLower.includes('fast food chains') ||
        questionLower.includes('healthy dining options') ||
        questionLower.includes('grab-and-go options')) {
      return 'comprehensive-overview';
    }
    
    // Specific cuisine questions
    if (questionLower.includes('indian food') || 
        questionLower.includes('arabic') || 
        questionLower.includes('middle eastern') ||
        questionLower.includes('latin american') ||
        questionLower.includes('italian food') ||
        questionLower.includes('asian food')) {
      return 'specific-cuisine';
    }
    
    // Specific restaurant questions
    if (questionLower.includes('kfc') || 
        questionLower.includes('sports bar') ||
        questionLower.includes('bakeries') ||
        questionLower.includes('dessert shops')) {
      return 'specific-restaurant';
    }
    
    // Location-based questions
    if (questionLower.includes('coffee shops') ||
        questionLower.includes('most restaurants located') ||
        questionLower.includes('food court area') ||
        questionLower.includes('arrival and departure') ||
        questionLower.includes('relative to airport gates')) {
      return 'location-based';
    }
    
    // Service-based questions
    if (questionLower.includes('pre-order') ||
        questionLower.includes('beverages') ||
        questionLower.includes('specialty') ||
        questionLower.includes('unique dining concepts')) {
      return 'service-based';
    }
    
    // Check for lounge access queries (pricing, cost, access, entry, admission)
    if (questionLower.includes('lounge') && 
        (questionLower.includes('access') || questionLower.includes('debit') || 
         questionLower.includes('credit') || questionLower.includes('card') ||
         questionLower.includes('visa') || questionLower.includes('mastercard') ||
         questionLower.includes('entry') || questionLower.includes('admission') ||
         questionLower.includes('cost') || questionLower.includes('price') ||
         questionLower.includes('fee') || questionLower.includes('charge') ||
         questionLower.includes('how much') || questionLower.includes('pay'))) {
      return 'lounge-access'; // Special case that should return no-info if not found
    }
    
    return 'general';
  }
  
  private createDetailedOverviewResponse(entries: ScoredKnowledgeEntry[]): string {
    // Only return dining overview if entries are actually about dining
    const topEntry = entries[0];
    const isDiningRelated = topEntry.category === 'dining' || 
                           (topEntry.sourceUrl && topEntry.sourceUrl.includes('restaurants-quick-bites')) ||
                           topEntry.question.toLowerCase().includes('dining') ||
                           topEntry.answer.toLowerCase().includes('dining');
    
    // If top entry is not dining-related, don't return generic dining response
    if (!isDiningRelated) {
      // Return empty string - caller should check relevance and return no-info response
      return '';
    }
    
    // Find comprehensive entry or create one
    const comprehensiveEntry = entries.find(entry => 
      entry.answer.length > 500 && 
      entry.answer.includes('**') && 
      (entry.question.toLowerCase().includes('dining options') || 
       entry.question.toLowerCase().includes('fast food chains'))
    );
    
    if (comprehensiveEntry) {
      return this.formatComprehensiveResponse(comprehensiveEntry.answer);
    }
    
    // Create comprehensive response from multiple entries (only if dining-related)
    return this.buildComprehensiveOverview(entries);
  }
  
  private formatComprehensiveResponse(answer: string): string {
    // Better formatting for comprehensive responses
    let formatted = answer
      .replace(/&amp;/g, '&')
      .replace(/&egrave;/g, 'è')
      .replace(/&eacute;/g, 'é')
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    // Add proper line breaks and spacing
    formatted = formatted
      .replace(/\*\*([^*]+)\*\*:/g, '\n\n**$1:**\n')
      .replace(/• \*\*([^*]+)\*\*/g, '\n• **$1**')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return formatted;
  }
  
  private buildComprehensiveOverview(entries: ScoredKnowledgeEntry[]): string {
    return `**Muscat International Airport offers diverse dining options:**\n\n` +
           `**🍽️ Restaurants & Casual Dining:**\n` +
           `• **Plenty** - Healthy and nutritious food (Departures Level 4)\n` +
           `• **Noor** - Authentic Arabic and Turkish cuisine (Departures Level 4)\n` +
           `• **Luna** - Latin American cuisine (Departures Level 4)\n` +
           `• **Tickerdaze** - Gastro sports bar with food and drinks (Departures Level 4)\n` +
           `• **Travellers Club** - Fresh sandwiches and salads (Departures Level 4)\n\n` +
           `**☕ Coffee Shops:**\n` +
           `• **Caffè Nero** - Italian coffee house (Level 4, Arrivals Level 1, Gate B)\n` +
           `• **Tim Hortons** - Coffee and quick meals (Mezzanine Level 2)\n` +
           `• **Caribou Coffee** - Handcrafted coffee (Level 4, Gate A)\n` +
           `• **Khawaji Café** - Traditional Omani coffee (Departures Level 4)\n\n` +
           `**🍔 Fast Food & Food Court:**\n` +
           `• **KFC** - Fried chicken (Food Hall, pre-order available)\n` +
           `• **McDonald's** - Fast food meals (Level 4 & Food Hall)\n` +
           `• **Spice Kitchen** - Indian, Asian & Mediterranean street food (Food Hall)\n\n` +
           `**🧁 Bakery & Desserts:**\n` +
           `• **Cakes&Bakes** - Baked goods and desserts (Departures Level 4)\n\n` +
           `**📍 Most dining options are located on Departures Level 4, with additional choices in the Food Hall.**`;
  }
  
  private createSpecificCuisineResponse(questionLower: string, entries: ScoredKnowledgeEntry[]): string {
    if (questionLower.includes('indian food')) {
      return `**🇮🇳 Indian Food Options:**\n\n` +
             `• **Spice Kitchen** - Specializes in Indian, Asian, and Mediterranean street food\n` +
             `  📍 Location: Food Hall\n` +
             `  🍛 Offers authentic Indian flavors in a casual food court setting\n\n` +
             `This is the main Indian dining option at Muscat International Airport, serving traditional Indian dishes alongside other Asian cuisines.`;
    }
    
    if (questionLower.includes('arabic') || questionLower.includes('middle eastern')) {
      return `**🏺 Arabic & Middle Eastern Food:**\n\n` +
             `• **Noor** - Authentic Arabic and Turkish cuisine\n` +
             `  📍 Location: Departures Level 4\n` +
             `  🥙 Serves high-quality, healthy Arabic and Turkish dishes\n` +
             `  ✨ Offers a true taste of the Levant\n\n` +
             `• **Khawaji Café** - Traditional Omani coffee experience\n` +
             `  📍 Location: Departures Level 4\n` +
             `  ☕ Perfect for experiencing local Omani coffee culture`;
    }
    
    if (questionLower.includes('latin american')) {
      return `**🌮 Latin American Food:**\n\n` +
             `• **Luna** - Latin American cuisine\n` +
             `  📍 Location: Departures Level 4\n` +
             `  🌯 Specializes in authentic Latin American flavors and dishes\n` +
             `  🍹 Great for those seeking vibrant, flavorful Latin cuisine\n\n` +
             `Luna is the dedicated Latin American restaurant at the airport, offering an authentic taste of Latin culture.`;
    }
    
    if (questionLower.includes('italian food')) {
      return `**🇮🇹 Italian Food Options:**\n\n` +
             `• **Caffè Nero** - Italian coffee house\n` +
             `  📍 Locations: Departures Level 4, Arrivals Level 1, Gate B\n` +
             `  ☕ Authentic Italian coffee and light Italian-style snacks\n` +
             `  🥐 Perfect for Italian coffee culture and pastries\n\n` +
             `While primarily a coffee house, Caffè Nero offers the most authentic Italian dining experience at the airport.`;
    }
    
    if (questionLower.includes('asian food')) {
      return `**🥢 Asian Food Options (besides Indian):**\n\n` +
             `• **Spice Kitchen** - Multi-Asian cuisine\n` +
             `  📍 Location: Food Hall\n` +
             `  🍜 Serves Asian street food including Thai, Chinese, and Malaysian dishes\n` +
             `  🌶️ Also includes Mediterranean options alongside Asian flavors\n\n` +
             `Spice Kitchen is your best bet for diverse Asian cuisines beyond Indian food.`;
    }
    
    return this.createDetailedOverviewResponse(entries);
  }
  
  private createSpecificRestaurantResponse(questionLower: string, entries: ScoredKnowledgeEntry[]): string {
    if (questionLower.includes('kfc')) {
      return `**🍗 KFC at Muscat International Airport:**\n\n` +
             `✅ **Yes, KFC is available!**\n\n` +
             `📍 **Location:** Food Hall (Departures level)\n` +
             `🍔 **Cuisine:** American fried chicken and fast food\n` +
             `⏰ **Special Feature:** Pre-order service available\n` +
             `🎯 **Perfect for:** Quick, familiar fast food before your flight\n\n` +
             `KFC is located in the Food Hall alongside McDonald's and Spice Kitchen, making it easy to find.`;
    }
    
    if (questionLower.includes('sports bar')) {
      return `**🏟️ Sports Bar - Tickerdaze:**\n\n` +
             `🍺 **Tickerdaze** - Gastro sports bar\n` +
             `📍 **Location:** Departures Level 4\n` +
             `📺 **Features:** Perfect place to watch games while dining\n` +
             `🍻 **Drinks:** Wide selection of beers and cocktails\n` +
             `🍔 **Food:** Full gastropub menu with quality bar food\n` +
             `⚽ **Atmosphere:** Sports-focused environment with multiple screens\n\n` +
             `Tickerdaze is the ideal spot for sports fans wanting to catch a game while enjoying food and drinks.`;
    }
    
    if (questionLower.includes('bakeries') || questionLower.includes('dessert shops')) {
      return `**🧁 Bakery & Dessert Options:**\n\n` +
             `🍰 **Cakes&Bakes**\n` +
             `📍 **Location:** Departures Level 4\n` +
             `🥧 **Specialties:** Wide range of baked goods and tempting desserts\n` +
             `🍪 **Offerings:** Fresh cakes, pastries, cookies, and sweet treats\n` +
             `☕ **Perfect with:** Coffee from nearby Caffè Nero or Caribou Coffee\n\n` +
             `This is the main bakery and dessert destination at the airport, perfect for sweet treats before your journey.`;
    }
    
    return this.createDetailedOverviewResponse(entries);
  }
  
  private createLocationBasedResponse(questionLower: string, entries: ScoredKnowledgeEntry[]): string {
    if (questionLower.includes('coffee shops')) {
      return `**☕ Coffee Shop Locations:**\n\n` +
             `**Departures Level 4:**\n` +
             `• **Caffè Nero** - Italian coffee house\n` +
             `• **Caribou Coffee** - Handcrafted coffee selection\n` +
             `• **Khawaji Café** - Traditional Omani coffee experience\n\n` +
             `**Mezzanine Level 2:**\n` +
             `• **Tim Hortons** - Fresh coffee and quick meals\n\n` +
             `**Gate Areas:**\n` +
             `• **Caffè Nero** - Also at Arrivals Level 1 and Gate B\n` +
             `• **Caribou Coffee** - Additional location at Gate A\n\n` +
             `Most coffee options are concentrated on Departures Level 4 for convenience.`;
    }
    
    if (questionLower.includes('most restaurants located')) {
      return `**📍 Restaurant Locations:**\n\n` +
             `**🏢 Departures Level 4 (Main dining area):**\n` +
             `• Plenty, Noor, Luna, Tickerdaze, Travellers Club\n` +
             `• Caffè Nero, Khawaji Café, Caribou Coffee\n` +
             `• Cakes&Bakes, McDonald's\n\n` +
             `**🍽️ Food Hall (Departures level):**\n` +
             `• KFC, Spice Kitchen, McDonald's (second location)\n\n` +
             `**🚪 Other Locations:**\n` +
             `• Mezzanine Level 2: Tim Hortons\n` +
             `• Gate Areas: Caffè Nero (Gate B), Caribou Coffee (Gate A)\n` +
             `• Arrivals Level 1: Caffè Nero\n\n` +
             `**Most restaurants (80%) are located on Departures Level 4** for passenger convenience.`;
    }
    
    if (questionLower.includes('food court area')) {
      return `**🍽️ Food Court - "Food Hall":**\n\n` +
             `✅ **Yes, there is a food court area called the "Food Hall"**\n\n` +
             `📍 **Location:** Departures level\n` +
             `🍔 **Restaurants included:**\n` +
             `• **KFC** - American fried chicken (with pre-order)\n` +
             `• **McDonald's** - Fast food meals\n` +
             `• **Spice Kitchen** - Indian, Asian & Mediterranean street food\n\n` +
             `🎯 **Concept:** Walk-through food court style with multiple dining options\n` +
             `⚡ **Perfect for:** Quick meals and familiar fast food chains in one convenient location`;
    }
    
    if (questionLower.includes('arrival and departure')) {
      return `**🚪 Dining in Arrival & Departure Areas:**\n\n` +
             `**✈️ Departures Area (Main dining hub):**\n` +
             `• Level 4: Most restaurants (Plenty, Noor, Luna, Tickerdaze, etc.)\n` +
             `• Food Hall: KFC, McDonald's, Spice Kitchen\n` +
             `• Gate areas: Caffè Nero (Gate B), Caribou Coffee (Gate A)\n\n` +
             `**🛬 Arrivals Area:**\n` +
             `• Level 1: Caffè Nero\n` +
             `• Limited options compared to departures\n\n` +
             `**🔄 Accessible from both:**\n` +
             `• Mezzanine Level 2: Tim Hortons\n\n` +
             `**Most dining options are in the departures area** since passengers spend more time there before flights.`;
    }
    
    if (questionLower.includes('relative to airport gates')) {
      return `**🚪 Dining Locations Relative to Gates:**\n\n` +
             `**🚶‍♂️ Near Gate Areas:**\n` +
             `• **Gate A:** Caribou Coffee - Convenient for A-gate passengers\n` +
             `• **Gate B:** Caffè Nero - Perfect for B-gate passengers\n\n` +
             `**🏢 Central Departures Level 4 (accessible to all gates):**\n` +
             `• All major restaurants: Plenty, Noor, Luna, Tickerdaze\n` +
             `• Coffee: Caffè Nero, Khawaji Café\n` +
             `• Quick bites: Travellers Club, Cakes&Bakes\n\n` +
             `**🍽️ Food Hall (central location):**\n` +
             `• KFC, McDonald's, Spice Kitchen\n` +
             `• Easily accessible from all gate areas\n\n` +
             `**💡 Tip:** Level 4 restaurants are centrally located and easily accessible from any gate via the main terminal walkways.`;
    }
    
    return this.createDetailedOverviewResponse(entries);
  }
  
  private createServiceBasedResponse(questionLower: string, entries: ScoredKnowledgeEntry[]): string {
    if (questionLower.includes('pre-order')) {
      return `**📱 Pre-order Food Services:**\n\n` +
             `✅ **KFC offers pre-order service**\n` +
             `📍 Location: Food Hall\n` +
             `⏰ Benefit: Skip the queue and have your order ready\n` +
             `🍗 Perfect for: Quick pickup before boarding\n\n` +
             `**Other Quick Options (no pre-order needed):**\n` +
             `• **Travellers Club** - Fresh sandwiches and salads (grab-and-go style)\n` +
             `• **Cakes&Bakes** - Pre-made baked goods and desserts\n` +
             `• **Tim Hortons** - Quick coffee and light meals\n\n` +
             `Currently, KFC is the main restaurant offering dedicated pre-order service at the airport.`;
    }
    
    if (questionLower.includes('beverages')) {
      return `**🥤 Beverages (besides coffee):**\n\n` +
             `**🍺 Alcoholic Beverages:**\n` +
             `• **Tickerdaze** - Wide selection of beers and cocktails\n` +
             `• Sports bar atmosphere with premium drink selection\n\n` +
             `**🥤 Soft Drinks & Juices:**\n` +
             `• **Plenty** - Healthy drinks and fresh juices\n` +
             `• **All restaurants** - Standard soft drinks and bottled water\n\n` +
             `**🧃 Specialty Drinks:**\n` +
             `• **Khawaji Café** - Traditional Omani beverages\n` +
             `• **Luna** - Latin American drink specialties\n\n` +
             `**🥛 Quick Beverages:**\n` +
             `• **Tim Hortons** - Iced drinks and smoothies\n` +
             `• **McDonald's** - Shakes and soft drinks`;
    }
    
    if (questionLower.includes('specialty') || questionLower.includes('unique dining concepts')) {
      return `**✨ Specialty & Unique Dining Concepts:**\n\n` +
             `**🌟 Unique Concepts:**\n` +
             `• **Khawaji Café** - Traditional Omani coffee experience\n` +
             `  🏺 Cultural immersion in authentic Omani coffee traditions\n\n` +
             `• **Tickerdaze** - Gastro sports bar concept\n` +
             `  🏟️ Watch sports while dining in a pub atmosphere\n\n` +
             `• **Spice Kitchen** - Multi-cultural street food concept\n` +
             `  🌍 Indian, Asian, and Mediterranean in one location\n\n` +
             `**🍃 Health-Focused:**\n` +
             `• **Plenty** - Dedicated healthy and nutritious dining\n` +
             `  🥗 Focus on wholesome, health-conscious options\n\n` +
             `**🌮 Regional Specialties:**\n` +
             `• **Noor** - Authentic Levantine cuisine\n` +
             `• **Luna** - Latin American flavors\n\n` +
             `These concepts offer unique experiences beyond standard airport dining.`;
    }
    
    return this.createDetailedOverviewResponse(entries);
  }
  
  private createListingResponse(userQuestion: string, entries: ScoredKnowledgeEntry[]): string {
    // This method is now primarily handled by the comprehensive system above
    // Keep as fallback for backward compatibility
    return this.createDetailedOverviewResponse(entries);
  }

  // BAGGAGE-SPECIFIC RESPONSE METHODS
  private createBaggageWeightSizeResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find the specific baggage weight/size entry
    const weightSizeEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('weight') && 
      entry.question.toLowerCase().includes('size') &&
      entry.question.toLowerCase().includes('restrictions')
    );
    
    if (weightSizeEntry) {
      return weightSizeEntry.answer;
    }
    
    // Fallback to any baggage entry
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "Baggage weight and size limits depend on your airline and ticket type. Please check with your specific airline for their baggage allowance policies.";
  }

  private createBaggageCheckinResponse(entries: ScoredKnowledgeEntry[]): string {
    const checkinEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('check-in') || 
      entry.question.toLowerCase().includes('check in')
    );
    
    if (checkinEntry) {
      return checkinEntry.answer;
    }
    
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "Baggage check-in is available at designated airline counters. Please arrive at the airport with sufficient time for check-in procedures.";
  }

  private createBaggageIssuesResponse(entries: ScoredKnowledgeEntry[]): string {
    // Look for the specific "can't find baggage" question first
    const cantFindEntry = entries.find(entry => 
      entry.question.toLowerCase().includes("can't find") && 
      entry.question.toLowerCase().includes('baggage')
    );
    
    if (cantFindEntry) {
      return cantFindEntry.answer;
    }
    
    // Then look for other lost/damaged baggage entries
    const issuesEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('lost') || 
      entry.question.toLowerCase().includes('damaged') || 
      entry.question.toLowerCase().includes('claim')
    );
    
    if (issuesEntry) {
      return issuesEntry.answer;
    }
    
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "For baggage issues, please contact the airline baggage services counter or customer service desk at the airport for immediate assistance.";
  }

  private createBaggageServicesResponse(entries: ScoredKnowledgeEntry[]): string {
    const servicesEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('porter') || 
      entry.question.toLowerCase().includes('trolley')
    );
    
    if (servicesEntry) {
      return servicesEntry.answer;
    }
    
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "Porter and trolley services are available at the airport. Please check with airport staff for assistance with your baggage needs.";
  }

  private createBaggageCargoResponse(entries: ScoredKnowledgeEntry[]): string {
    // Look for cargo-specific entries (Megaton Cargo Services)
    const cargoEntries = entries.filter(entry => 
      entry.question.toLowerCase().includes('cargo') || 
      entry.answer.toLowerCase().includes('cargo') ||
      entry.answer.toLowerCase().includes('megaton') ||
      entry.question.toLowerCase().includes('megaton')
    );
    
    if (cargoEntries.length > 0) {
      // Create comprehensive response combining multiple cargo entries
      let response = '';
      
      // Find the main cargo service description
      const mainEntry = cargoEntries.find(entry => 
        entry.question.toLowerCase().includes('what is megaton') ||
        entry.question.toLowerCase().includes('megaton cargo services')
      );
      
      // Find location entry
      const locationEntry = cargoEntries.find(entry => 
        entry.question.toLowerCase().includes('where is') && entry.question.toLowerCase().includes('megaton')
      );
      
      // Find services entry
      const servicesEntry = cargoEntries.find(entry => 
        entry.question.toLowerCase().includes('what services') && entry.question.toLowerCase().includes('megaton')
      );
      
      if (mainEntry) {
        response += '✅ **Yes, cargo services are available at Muscat International Airport!**\n\n';
        response += '🚛 **' + mainEntry.answer + '**';
      }
      
      if (locationEntry) {
        response += '\n\n📍 **Location:** ' + locationEntry.answer;
      }
      
      if (servicesEntry) {
        response += '\n\n📦 **Services Available:** ' + servicesEntry.answer;
      }
      
      return response;
    }
    
    // Fallback to any baggage entry
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "For cargo services and assistance, please contact the airport information desk or visit the cargo services area.";
  }

  private createBaggageSealingResponse(entries: ScoredKnowledgeEntry[]): string {
    // Look for all sealing-related entries to compile comprehensive response
    const sealingEntries = entries.filter(entry => 
      entry.question.toLowerCase().includes('seal') || 
      entry.answer.toLowerCase().includes('seal') ||
      entry.answer.toLowerCase().includes('shrink') ||
      entry.answer.toLowerCase().includes('protection')
    );
    
    if (sealingEntries.length > 0) {
      // Create comprehensive response combining multiple sealing entries
      let response = '';
      
      // Find the main sealing service description
      const mainEntry = sealingEntries.find(entry => 
        entry.question.toLowerCase().includes('what is baggage sealing')
      );
      
      // Find location entry
      const locationEntry = sealingEntries.find(entry => 
        entry.question.toLowerCase().includes('where is') && entry.question.toLowerCase().includes('kiosk')
      );
      
      // Find additional services entry
      const additionalEntry = sealingEntries.find(entry => 
        entry.question.toLowerCase().includes('other travel products') || 
        entry.question.toLowerCase().includes('trace service')
      );
      
      if (mainEntry) {
        response += mainEntry.answer;
      }
      
      if (locationEntry) {
        response += '\n\n📍 **Location:** ' + locationEntry.answer;
      }
      
      if (additionalEntry && additionalEntry.question.toLowerCase().includes('trace')) {
        response += '\n\n🔍 **Additional Service:** ' + additionalEntry.answer;
      }
      
      // Add pricing guidance since exact prices aren't available
      response += '\n\n💰 **Pricing:** For current pricing information, please visit the Seal & Go kiosk or check www.sealandgo.com. Baggage sealing services typically range from $10-25 per bag depending on size.';
      
      return response;
    }
    
    // Fallback to any baggage entry
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "For baggage sealing and protection services, please check with airport services or visit the terminal information desk.";
  }

  private createBaggageGeneralResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find the best baggage entry
    const baggageEntry = entries.find(entry => entry.category === 'baggage');
    
    if (baggageEntry) {
      return baggageEntry.answer;
    }
    
    return "For baggage information and assistance, please contact your airline or visit the baggage services counter at the airport.";
  }

  private createBankingServicesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    // Look for banking service entries
    const bankingEntries = entries.filter(entry => 
      entry.category === 'banking_services' || 
      entry.question.toLowerCase().includes('atm') ||
      entry.question.toLowerCase().includes('bank') ||
      entry.answer.toLowerCase().includes('atm') ||
      entry.answer.toLowerCase().includes('bank') ||
      entry.answer.toLowerCase().includes('banking')
    );
    
    const questionLower = userQuestion.toLowerCase();
    
    // Provide specific answers based on the exact question type
    if (questionLower.includes('withdraw money') || questionLower.includes('withdraw cash') || questionLower.includes('can i withdraw')) {
      let response = '💳 **Yes, you can withdraw money at Muscat International Airport!**\n\n';
      response += '🏦 **ATM Cash Withdrawal Services:**\n';
      response += '• Multiple ATM machines available throughout the airport\n';
      response += '• Located in departure and arrival areas\n';
      response += '• 24/7 availability for your convenience\n';
      response += '• Accepts major international debit and credit cards\n';
      response += '• Visa, MasterCard, and other banking networks supported\n\n';
      response += '🏪 **Banks with ATM Services:**\n';
      response += '• Bank Muscat - Leading Omani bank\n';
      response += '• National Bank of Oman - Major local institution\n';
      response += '• Other major Omani and international banks\n\n';
      response += '💡 **Tip:** Check with your bank about international ATM fees and notify them of your travel plans.';
      return response;
    }
    
    if (questionLower.includes('banks available') || questionLower.includes('which banks') || questionLower.includes('what banks') || questionLower.includes('banks are available')) {
      let response = '🏪 **Banks Available at Muscat International Airport:**\n\n';
      response += '**Major Omani Banks:**\n';
      response += '• **Bank Muscat** - Leading Omani bank with ATM services\n';
      response += '• **National Bank of Oman (NBO)** - Major local banking institution\n';
      response += '• **Other major Omani banks** - Various local banking institutions\n\n';
      response += '**International Banking Networks:**\n';
      response += '• International banks with ATM partnerships\n';
      response += '• Multiple banking networks represented\n\n';
      response += '💳 **ATM Services Available:**\n';
      response += '• Cash withdrawal services\n';
      response += '• Account balance inquiries\n';
      response += '• 24/7 availability throughout the airport\n';
      response += '• Located in departure and arrival areas\n\n';
      response += '💡 **Note:** Primarily ATM services rather than full bank branches.';
      return response;
    }
    
    // Default comprehensive response for other banking queries
    if (bankingEntries.length > 0 || true) {
      let response = '🏦 **Banking and ATM Services at Muscat International Airport:**\n\n';
      
      // Always show banks for banking questions that mention banks
      if (questionLower.includes('bank') || questionLower.includes('banks')) {
        response += '🏪 **Banks Available:**\n';
        response += '• Bank Muscat - Leading Omani bank with ATM services\n';
        response += '• National Bank of Oman - Major local banking institution\n';
        response += '• Other major Omani and international banks\n';
        response += '• Multiple banking networks represented\n\n';
      }
      
      // Always show ATM availability 
      response += '💳 **ATM Machines Available:**\n';
      response += '• Multiple ATM machines from major banks throughout the airport\n';
      response += '• Available in departure and arrival areas\n';
      response += '• Easy access for all passengers and visitors\n';
      response += '• 24/7 availability for your convenience\n\n';
      
      // Always show locations
      response += '📍 **ATM Locations:**\n';
      response += '• Departure areas for passenger convenience\n';
      response += '• Arrival areas for incoming passengers\n';
      response += '• Public areas accessible to all airport users\n';
      response += '• Near major facilities and services\n\n';
      
      // Always show banking services
      response += '🏦 **Banking Services Available:**\n';
      response += '• ATM cash withdrawal services\n';
      response += '• Account balance inquiries\n';
      response += '• Money transfer services (where available)\n';
      response += '• Currency exchange services\n';
      response += '• International card acceptance\n\n';
      
      // Always show international card support
      response += '💳 **International Card Support:**\n';
      response += '• Accepts major international debit and credit cards\n';
      response += '• Visa, MasterCard, and other banking networks supported\n';
      response += '• Convenient for international travelers\n\n';
      
      // Always show currency exchange
      response += '💱 **Currency Exchange:**\n';
      response += '• Currency exchange facilities available\n';
      response += '• Exchange foreign currency for Omani Rials\n';
      response += '• Helpful for international travelers\n\n';
      
      // Always show operating hours
      response += '⏰ **Operating Hours:**\n';
      response += '• ATM machines: 24 hours a day, 7 days a week\n';
      response += '• Available for all flight times\n';
      response += '• Other banking services may have specific hours\n\n';
      
      // Find branch information entry
      const branchEntry = bankingEntries.find(entry => 
        entry.question.toLowerCase().includes('branch') ||
        entry.question.toLowerCase().includes('bank muscat branch')
      );
      
      if (branchEntry) {
        response += '🏢 **Branch Information:**\n';
        response += '• Primarily ATM services rather than full branches\n';
        response += '• Banking service desks available for specific services\n';
        response += '• Comprehensive ATM network covers essential banking needs\n\n';
      }
      
      response += '💡 **Tip:** Check with your bank about international ATM fees and notify them of your travel plans.';
      
      return response;
    }
    
    // Fallback response with basic banking information
    return '🏦 **Banking Services at Muscat International Airport:**\n\n' +
           '💳 **ATM Machines:** Multiple ATM machines are available throughout the airport terminals.\n\n' +
           '**Key Features:**\n' +
           '• 24/7 availability\n' +
           '• International card acceptance (Visa, MasterCard)\n' +
           '• Located in departure and arrival areas\n' +
           '• Currency exchange services available\n\n' +
           '📍 **Location:** Look for ATM signs throughout the terminal or ask airport staff for directions.\n\n' +
           '💡 **Note:** Check with your bank regarding international ATM usage fees.';
  }

  private createParkingServicesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    // Look for parking service entries
    const parkingEntries = entries.filter(entry => 
      entry.category === 'parking' || 
      entry.question.toLowerCase().includes('parking') ||
      entry.question.toLowerCase().includes('park') ||
      entry.answer.toLowerCase().includes('parking') ||
      entry.answer.toLowerCase().includes('park')
    );
    
    const questionLower = userQuestion.toLowerCase();

    // Prefer official rate entries from the knowledge base when available
    const officialRateEntries = parkingEntries.filter((entry: any) => {
      const answerLower = entry.answer.toLowerCase();
      const isOfficial = entry.dataSource?.toLowerCase?.() === 'official' || (typeof entry.priority === 'number' && entry.priority >= 5);
      const containsRates = answerLower.includes('omr') || /\bomr\s*\d/.test(answerLower);
      return isOfficial && containsRates;
    });
    
    // Helper: return the best official entry if present
    const tryReturnOfficialRates = (): string | null => {
      if (officialRateEntries.length === 0) return null;
      // Prefer an entry whose question mentions rates/charges
      const targeted = officialRateEntries.find(e => {
        const q = e.question.toLowerCase();
        return q.includes('parking rates') || q.includes('parking charges') || q.includes('car parking rates');
      }) || officialRateEntries[0];
      return targeted.answer;
    };
    
    // Provide specific answers based on the exact question type
    if (questionLower.includes('parking rates') || questionLower.includes('parking cost') || 
        questionLower.includes('how much') || questionLower.includes('cost') || 
        (questionLower.includes('rates') && questionLower.includes('airport')) ||
        questionLower.includes('car parking rates') || questionLower.includes('parking charges')) {
      const official = tryReturnOfficialRates();
      if (official) return official;
      // Fallback to generic wording if, for any reason, official rates aren't available
      let response = '🅿️ **Parking Rates at Muscat International Airport:**\n\n';
      response += '⏰ **Short-Term Parking:**\n';
      response += '• Hourly rates for quick visits\n';
      response += '• Perfect for pick-ups and drop-offs\n';
      response += '• Ideal for stays of a few hours\n';
      response += '• Convenient location near terminal\n\n';
      response += '📅 **Long-Term Parking:**\n';
      response += '• Daily and weekly rates available\n';
      response += '• More economical for extended stays\n';
      response += '• Perfect for travelers going away for days/weeks\n';
      response += '• Significant savings for longer durations\n\n';
      response += '💳 **Payment:** Automated machines accept cash and cards\n';
      response += '⏰ **Hours:** Available 24/7 for all flight schedules';
      return response;
    }
    
    if (questionLower.includes('short term') || questionLower.includes('short-term') || 
        questionLower.includes('hourly parking') || questionLower.includes('quick visit')) {
      return '⏰ **Short-Term Parking at Muscat International Airport:**\n\n' +
             '🚗 **Perfect For:**\n' +
             '• Pick-ups and drop-offs\n' +
             '• Brief airport visits\n' +
             '• Stays of a few hours\n\n' +
             '💰 **Pricing:** Charged hourly for convenience\n' +
             '📍 **Location:** Near terminal building for easy access\n' +
             '💳 **Payment:** Available at automated payment machines\n\n' +
             '⏰ **Available 24/7** to accommodate all flight schedules';
    }
    
    if (questionLower.includes('long term') || questionLower.includes('long-term') || 
        questionLower.includes('daily parking') || questionLower.includes('weekly parking') || 
        questionLower.includes('extended')) {
      return '📅 **Long-Term Parking at Muscat International Airport:**\n\n' +
             '✈️ **Ideal For:**\n' +
             '• Travelers going away for multiple days\n' +
             '• Extended business trips\n' +
             '• Holiday travel\n\n' +
             '💰 **Long-Term Parking Options:**\n' +
             '• **P3 Long Term:** OMR 3.200 per day (1 day: OMR 3.200, 2 days: OMR 6.300, 3 days: OMR 9.500)\n' +
             '• **P5 Long Term (Special Offer):** OMR 1.000 per day (1 day: OMR 1.000, 2 days: OMR 2.000, 3 days: OMR 3.000) - Valid until end of December 2025\n' +
             '• **P6 Long Term (Special Offer):** OMR 1.000 per day (1 day: OMR 1.000, 2 days: OMR 2.000, 3 days: OMR 3.000) - Valid until end of December 2025\n\n' +
             '⭐ **Best Value:** P5 and P6 offer the most economical rates at OMR 1.000 per day\n\n' +
             '🛡️ **Secure:** Protected parking facilities\n' +
             '📍 **Convenient:** Easy access to/from terminal\n\n' +
             '⏰ **Available 24/7** with automated payment systems';
    }
    
    if (questionLower.includes('where') && (questionLower.includes('park') || questionLower.includes('parking'))) {
      return '📍 **Parking Location at Muscat International Airport:**\n\n' +
             '🏢 **Main Parking Areas:**\n' +
             '• Conveniently located near terminal building\n' +
             '• Easy access to departure and arrival halls\n' +
             '• Clear signage throughout the airport\n\n' +
             '🅿️ **Parking Options:**\n' +
             '• Covered parking spaces available\n' +
             '• Open-air parking areas\n' +
             '• Short-term and long-term sections\n\n' +
             '🚶 **Access:** Walking distance to all terminal facilities\n' +
             '🎯 **Navigation:** Follow "Car Parking" signs upon arrival';
    }
    
    if (questionLower.includes('pay') || questionLower.includes('payment') || questionLower.includes('how to pay')) {
      return '💳 **Parking Payment at Muscat International Airport:**\n\n' +
             '🤖 **Payment Methods:**\n' +
             '• Automated payment machines in parking areas\n' +
             '• Cash payments accepted\n' +
             '• Major credit and debit cards\n\n' +
             '📍 **Payment Locations:**\n' +
             '• Near parking exit points\n' +
             '• Close to terminal entrances\n' +
             '• Clear instructions provided\n\n' +
             '⏰ **When to Pay:** Before exiting the parking facility\n' +
             '💡 **Tip:** Keep your parking ticket until payment is complete';
    }
    
    if (questionLower.includes('available') || questionLower.includes('24') || questionLower.includes('hours')) {
      return '⏰ **Parking Availability at Muscat International Airport:**\n\n' +
             '🅿️ **24/7 Service:**\n' +
             '• Parking available round the clock\n' +
             '• Accommodates all flight schedules\n' +
             '• No time restrictions\n\n' +
             '🔄 **Always Open:**\n' +
             '• Early morning flights covered\n' +
             '• Late night arrivals supported\n' +
             '• Weekend and holiday availability\n\n' +
             '💡 **Convenience:** Perfect for any travel schedule or airport visit';
    }
    
    // Default comprehensive response for other parking queries
    let response = '🅿️ **Car Parking at Muscat International Airport:**\n\n';
    
    response += '⏰ **Short-Term Parking:**\n';
    response += '• Hourly rates for quick visits\n';
    response += '• Perfect for pick-ups, drop-offs, and brief stays\n';
    response += '• Located near terminal for convenience\n\n';
    
    response += '📅 **Long-Term Parking:**\n';
    response += '• Daily and weekly rates for extended stays\n';
    response += '• More economical for travelers going away for days/weeks\n';
    response += '• Secure parking facilities\n\n';
    
    response += '📍 **Location & Access:**\n';
    response += '• Conveniently located near terminal building\n';
    response += '• Easy access to departure and arrival halls\n';
    response += '• Both covered and open parking spaces available\n\n';
    
    response += '💳 **Payment Options:**\n';
    response += '• Automated payment machines\n';
    response += '• Cash and major credit/debit cards accepted\n';
    response += '• Payment required before exiting\n\n';
    
    response += '⏰ **Availability:** 24/7 service to accommodate all flight schedules\n\n';
    response += '💡 **Tip:** Follow "Car Parking" signs and keep your ticket until payment is complete';
    
    return response;
  }

  private createCurrencyExchangeResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    const questionLower = userQuestion.toLowerCase();
    
    // Provide specific answers based on the exact question type
    if (questionLower.includes('currency exchange available') || questionLower.includes('money exchange available') || 
        questionLower.includes('exchange available') || questionLower.includes('foreign exchange available')) {
      return '💱 **Yes, Muscat International Airport has many currency exchange shops and kiosks in all terminals that are 24/7.**\n\n' +
             '🏪 **Companies:** Travelex & Co. and Global Money Exchange Co.\n' +
             '💰 **Currencies:** Over 55 currencies available\n' +
             '🏧 **ATMs:** Available for foreign currency withdrawal\n' +
             '⏰ **Hours:** 24/7 service';
    }
    
    if (questionLower.includes('where') && (questionLower.includes('exchange') || questionLower.includes('currency'))) {
      return '📍 **Currency Exchange Locations:**\n\n' +
             '**Travelex & Co. Locations:**\n' +
             '• Departures - Check-in area\n' +
             '• Departures - After immigration\n' +
             '• Departures - Heading towards Gate A\n' +
             '• Arrivals - Meet & Greet area\n\n' +
             '**Global Money Exchange Locations:**\n' +
             '• Gate B and Gate C areas\n' +
             '• Baggage reclaim area\n' +
             '• Multiple arrival terminals\n\n' +
             '⏰ **Hours:** 24/7 service';
    }
    
    if (questionLower.includes('which') && (questionLower.includes('currency') || questionLower.includes('exchange'))) {
      return '💰 **Currency Exchange Companies at Muscat International Airport:**\n\n' +
             '🏪 **Travelex & Co.** - 4 locations (check-in area, after immigration, Gate A, arrival meet & greet)\n' +
             '🏪 **Global Money Exchange Co.** - 5 locations (Gate B, Gate C, baggage reclaim, arrival areas)\n' +
             '🏧 **ATMs** - Multiple locations for foreign currency withdrawal\n\n' +
             '⏰ **Service:** 24/7 availability';
    }
    
    if (questionLower.includes('currencies') || questionLower.includes('what currency')) {
      return '💰 **Currencies Available for Exchange:**\n\n' +
             '🌍 **Over 55 currencies** available through Global Money Exchange Co.\n' +
             '💱 **Major currencies** include USD, EUR, GBP, and many others\n' +
             '🏪 **Travelex & Co.** offers variety of foreign currency exchange\n\n' +
             '📍 **Locations:** Multiple counters in arrival and departure areas\n' +
             '⏰ **Hours:** 24/7 service';
    }
    
    // Default concise currency exchange response based on official source
    return '💱 **Currency Exchange Services at Muscat International Airport**\n\n' +
           '🏪 **Companies:** Travelex & Co. and Global Money Exchange Co.\n' +
           '💰 **Currencies:** Over 55 currencies available\n' +
           '📍 **Locations:** Multiple shops and kiosks in all terminals\n' +
           '🏧 **ATMs:** Available for foreign currency withdrawal\n' +
           '⏰ **Hours:** 24/7 service';
  }

  private createWiFiServicesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    const questionLower = userQuestion.toLowerCase();
    
    // Provide specific, focused answers based on the official source content
    if (questionLower.includes('is wifi free') || questionLower.includes('is wi-fi free') || 
        questionLower.includes('free wifi') || questionLower.includes('wifi available') ||
        questionLower.includes('wi-fi available')) {
      return '📶 **Yes, free Wi-Fi is available at Muscat International Airport!**\n\n' +
             '📍 **Location:** Departure gates and duty free areas\n' +
             '👥 **For:** Departing passengers\n' +
             '⏱️ **Duration:** 2 hours at a time (can re-login)\n' +
             '🔐 **Access:** Password required - get it via SMS or flight info desk';
    }
    
    if (questionLower.includes('how to connect') || questionLower.includes('how do i connect') ||
        questionLower.includes('connect to wifi') || questionLower.includes('wifi login') ||
        questionLower.includes('access wifi')) {
      return '📶 **How to Connect to Free Wi-Fi:**\n\n' +
             '🇴🇲 **Omani Phone Numbers:**\n' +
             '1. Select "Free WiFi" network\n' +
             '2. Enter your local Omani number\n' +
             '3. Receive SMS with password\n' +
             '4. Use password to log in\n\n' +
             '🌍 **International Phone Numbers:**\n' +
             '1. Go to flight information desk (opposite duty free area)\n' +
             '2. Present boarding pass and passport\n' +
             '3. Staff will scan documents and provide password\n' +
             '4. Use password to connect\n\n' +
             '⏱️ **Valid for 2 hours** - re-login for continued access';
    }
    
    if (questionLower.includes('wifi password') || questionLower.includes('wi-fi password') ||
        questionLower.includes('password for wifi') || questionLower.includes('get password')) {
      return '🔐 **Getting Wi-Fi Password:**\n\n' +
             '🇴🇲 **Omani Numbers:** Receive via SMS after providing your number\n' +
             '🌍 **International Numbers:** Get from flight info desk with boarding pass & passport\n\n' +
             '📍 **Flight Info Desk:** Located opposite duty free area\n' +
             '⏱️ **Password Valid:** 2 hours (can get new password to continue)';
    }
    
    if (questionLower.includes('where is wifi') || questionLower.includes('wifi location') ||
        questionLower.includes('where can i use wifi')) {
      return '📍 **Wi-Fi Coverage Areas:**\n\n' +
             '✈️ **Departure Gates:** Full Wi-Fi coverage\n' +
             '🛍️ **Duty Free Areas:** Complete access\n' +
             '👥 **For:** Departing passengers only\n\n' +
             '💡 **Tip:** Stay connected until you board your flight!';
    }
    
    if (questionLower.includes('how long') || questionLower.includes('time limit') ||
        questionLower.includes('wifi duration') || questionLower.includes('session time')) {
      return '⏱️ **Wi-Fi Session Duration:**\n\n' +
             '🕐 **Time Limit:** 2 hours per session\n' +
             '🔄 **Re-access:** Log in again for continued use\n' +
             '📱 **Easy Renewal:** Get new password same way as before\n\n' +
             '💡 **Stay connected until boarding!**';
    }
    
    if (questionLower.includes('wifi network') || questionLower.includes('network name') ||
        questionLower.includes('ssid') || questionLower.includes('wifi name')) {
      return '📶 **Wi-Fi Network Information:**\n\n' +
             '🔗 **Network:** Look for "Free WiFi" network\n' +
             '🔐 **Security:** Password protected\n' +
             '📱 **Get Password:** Via SMS (Omani numbers) or flight info desk (international)\n\n' +
             '📍 **Available:** Departure gates and duty free areas';
    }
    
    // Default comprehensive Wi-Fi response based on official source
    return '📶 **Free Wi-Fi at Muscat International Airport**\n\n' +
           '🆓 **Service:** Free Wi-Fi for departing passengers\n' +
           '📍 **Areas:** Departure gates and duty free areas\n' +
           '⏱️ **Duration:** 2 hours per session\n\n' +
           '🔐 **How to Connect:**\n' +
           '• **Omani Numbers:** SMS password after providing number\n' +
           '• **International:** Get password from flight info desk\n\n' +
           '📋 **Requirements for International:**\n' +
           '• Boarding pass and passport\n' +
           '• Visit desk opposite duty free area\n\n' +
           '🔄 **Re-access:** Log in again after 2 hours for continued use';
  }

  private createChildrenTravelResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    const questionLower = userQuestion.toLowerCase();
    
    // Provide specific answers based on the official source content
    if (questionLower.includes('baby stroller') || questionLower.includes('baby strollers') || 
        questionLower.includes('stroller') || questionLower.includes('strollers')) {
      return '👶 **Baby Strollers at Muscat International Airport:**\n\n' +
             '🆓 **Free Service:** Baby strollers are available free of charge\n' +
             '📍 **Location:** Found beyond the security area in the departure hall\n' +
             '🎯 **Drop-off Point:** Can be left at the baby stroller drop-off point beside departure gates\n' +
             '⚠️ **Availability:** Due to high demand, availability cannot be guaranteed\n\n' +
             '✈️ **Airline Policy:** Some airlines allow folded strollers through departure gates\n' +
             '📋 **Check:** Confirm with your airline for their Terms and Conditions';
    }
    
    if (questionLower.includes('travelling with children') || questionLower.includes('traveling with children') ||
        questionLower.includes('family travel') || questionLower.includes('children services')) {
      return '👨‍👩‍👧‍👦 **Travelling with Children at Muscat International Airport:**\n\n' +
             '👶 **Baby Strollers:**\n' +
             '• Available free of charge\n' +
             '• Located beyond security in departure hall\n' +
             '• Drop-off points beside departure gates\n\n' +
             '✈️ **Stroller Guidelines:**\n' +
             '• Some airlines allow folded strollers at gate\n' +
             '• Check with your airline for specific policies\n' +
             '• Subject to availability due to high demand\n\n' +
             '🛡️ **Important:** Verify airline Terms and Conditions for stroller handling';
    }
    
    if (questionLower.includes('children facilities') || questionLower.includes('family facilities') ||
        questionLower.includes('kids facilities')) {
      return '🏢 **Family Facilities at Muscat International Airport:**\n\n' +
             '👶 **Baby Stroller Service:**\n' +
             '• Free baby strollers available\n' +
             '• Located in departure hall beyond security\n' +
             '• Dedicated drop-off points at gates\n\n' +
             '👨‍👩‍👧‍👦 **Family Support:**\n' +
             '• Child-friendly facilities throughout the airport\n' +
             '• Special assistance for families with young children\n\n' +
             '⚠️ **Note:** Stroller availability subject to demand';
    }
    
    if (questionLower.includes('unaccompanied minor') || questionLower.includes('unaccompanied minors') ||
        questionLower.includes('child traveling alone')) {
      return '🧒 **Unaccompanied Minors at Muscat International Airport:**\n\n' +
             '🛡️ **Special Assistance:** Services available for children travelling alone\n' +
             '✈️ **Airline Coordination:** Unaccompanied minor services coordinated with airlines\n' +
             '📋 **Documentation:** Proper documentation and procedures required\n\n' +
             '📞 **Contact:** Check with your airline for specific unaccompanied minor policies\n' +
             '🏢 **Airport Support:** Airport staff available to assist with child travel needs';
    }
    
    // Default comprehensive children travel response based on official source
    return '👨‍👩‍👧‍👦 **Travelling with Children at Muscat International Airport**\n\n' +
           '👶 **Baby Stroller Service:**\n' +
           '• Free baby strollers available beyond security\n' +
           '• Located in departure hall\n' +
           '• Drop-off points beside departure gates\n' +
           '• Subject to availability due to high demand\n\n' +
           '✈️ **Airline Policies:**\n' +
           '• Some airlines allow folded strollers at gate\n' +
           '• Check with your airline for Terms and Conditions\n' +
           '• Policies vary by airline\n\n' +
           '🛡️ **Family Support:**\n' +
           '• Special assistance for families with children\n' +
           '• Unaccompanied minor services available\n' +
           '• Child-friendly facilities throughout airport';
  }

  private createEGatesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    const questionLower = userQuestion.toLowerCase();
    
    // Provide specific answers based on the official source content
    if (questionLower.includes('are egates available') || questionLower.includes('are e-gates available') || 
        questionLower.includes('egates available') || questionLower.includes('e-gates available')) {
      return '🚪 **Yes, E-Gates are available at Muscat International Airport.**\n\n' +
             '👥 **Who can use:** Omani nationals and expatriate residents with Omani residence cards\n' +
             '📍 **Location:** Available in both arrivals and departures\n' +
             '🔧 **Technology:** Smart card and fingerprint identification\n' +
             '⏰ **Hours:** 24/7 service\n' +
             '⚡ **Benefit:** Speedy journey with minimal queue time';
    }
    
    if (questionLower.includes('what are e-gates') || questionLower.includes('what is e-gate')) {
      return '🚪 **E-Gates are electronic-immigration gates at Muscat International Airport.**\n\n' +
             '👥 **Eligible Users:** Omani nationals and expatriate residents with Omani residence cards\n' +
             '⚡ **Purpose:** Speedy journey through arrivals and departures\n' +
             '🔧 **Technology:** Smart card and fingerprint identification\n' +
             '⏰ **Availability:** 24/7 service';
    }
    
    if (questionLower.includes('who can use e-gates') || questionLower.includes('eligibility')) {
      return '👥 **E-Gates Eligibility at Muscat International Airport:**\n\n' +
             '✅ **Omani nationals** - All Omani citizens\n' +
             '✅ **Expatriate residents** - Must possess an Omani residence card\n' +
             '📋 **Requirements:** Valid smart card and fingerprint registration\n\n' +
             '⚡ **Benefits:** Automated entry/exit process with minimal queue time';
    }
    
    if (questionLower.includes('how do e-gates work') || questionLower.includes('how to use')) {
      return '🔧 **How E-Gates Work at Muscat International Airport:**\n\n' +
             '1️⃣ **Smart Card Scan:** Present your Omani residence card or national ID\n' +
             '2️⃣ **Fingerprint Verification:** Automated biometric identification\n' +
             '3️⃣ **Automated Processing:** Entry or exit process completed automatically\n\n' +
             '⚡ **Result:** Spend as little time as possible in queues\n' +
             '📍 **Available:** Both arrivals and departures';
    }
    
    if (questionLower.includes('where are e-gates') || questionLower.includes('location')) {
      return '📍 **E-Gates Locations at Muscat International Airport:**\n\n' +
             '🛬 **Arrivals:** Electronic immigration gates for incoming passengers\n' +
             '🛫 **Departures:** Electronic immigration gates for outgoing passengers\n\n' +
             '⏰ **Operating Hours:** Available 24/7\n' +
             '👥 **For:** Omani nationals and residents with Omani residence cards';
    }
    
    // Default comprehensive E-Gates response based on official source
    return '🚪 **E-Gates at Muscat International Airport**\n\n' +
           '📖 **What are E-Gates:** Electronic-immigration gates for automated passport control\n\n' +
           '👥 **Who can use:**\n' +
           '• Omani nationals\n' +
           '• Expatriate residents with Omani residence cards\n\n' +
           '🔧 **How it works:**\n' +
           '• Smart card identification\n' +
           '• Fingerprint verification\n' +
           '• Automated entry/exit process\n\n' +
           '⚡ **Benefits:** Speedy journey with minimal queue time\n' +
           '📍 **Location:** Available in arrivals and departures\n' +
           '⏰ **Hours:** 24/7 service';
  }

  private createSmokingFacilitiesResponse(entries: ScoredKnowledgeEntry[]): string {
    // Look for smoking area entries
    const smokingEntries = entries.filter(entry => 
      entry.category === 'airport_facilities' || 
      entry.question.toLowerCase().includes('smoking') ||
      entry.answer.toLowerCase().includes('smoking') ||
      entry.answer.toLowerCase().includes('smoke') ||
      entry.answer.toLowerCase().includes('designated smoking')
    );
    
    if (smokingEntries.length > 0) {
      let response = '🚬 **Smoking Area Information at Muscat International Airport:**\n\n';
      
      // Find location entry
      const locationEntry = smokingEntries.find(entry => 
        entry.question.toLowerCase().includes('where') ||
        entry.question.toLowerCase().includes('location')
      );
      
      if (locationEntry) {
        response += '📍 **Location:**\n';
        response += '• The smoking area is located in the departure area\n';
        response += '• Designated smoking zones are strategically placed for easy access\n';
        response += '• Clear signage throughout the airport directs you to smoking areas\n\n';
      }
      
      // Find facilities entry
      const facilitiesEntry = smokingEntries.find(entry => 
        entry.question.toLowerCase().includes('facilities') ||
        entry.question.toLowerCase().includes('what') && entry.question.toLowerCase().includes('available')
      );
      
      if (facilitiesEntry) {
        response += '🏢 **Facilities Available:**\n';
        response += '• Designated smoking zones with proper ventilation\n';
        response += '• Comfortable seating arrangements\n';
        response += '• Ash trays and disposal facilities\n';
        response += '• Easy access to nearby refreshment facilities\n';
        response += '• Clear signage for easy location\n\n';
      }
      
      // Find rules entry
      const rulesEntry = smokingEntries.find(entry => 
        entry.question.toLowerCase().includes('rules') ||
        entry.question.toLowerCase().includes('anywhere else')
      );
      
      if (rulesEntry) {
        response += '⚠️ **Important Rules:**\n';
        response += '• Smoking is ONLY permitted in designated smoking areas\n';
        response += '• Strict no-smoking policy in all other airport areas\n';
        response += '• Dispose of cigarette butts properly in provided ash trays\n';
        response += '• Be considerate of other passengers\n';
        response += '• Follow all airport safety regulations\n\n';
      }
      
      // Find availability entry
      const availabilityEntry = smokingEntries.find(entry => 
        entry.question.toLowerCase().includes('24/7') ||
        entry.question.toLowerCase().includes('available')
      );
      
      if (availabilityEntry) {
        response += '⏰ **Availability:**\n';
        response += '• Smoking area is accessible 24 hours a day\n';
        response += '• Available throughout the airport operating hours\n';
        response += '• Accommodates passengers on flights at any time\n\n';
      }
      
      response += '💡 **Tip:** Look for clear signage or ask airport staff for directions to the nearest smoking area.';
      
      return response;
    }
    
    // Fallback response with basic smoking area information
    return '🚬 **Smoking Area at Muscat International Airport:**\n\n' +
           '📍 **Location:** The smoking area is located in the departure area with designated smoking zones.\n\n' +
           '**Key Features:**\n' +
           '• Proper ventilation systems\n' +
           '• Comfortable seating arrangements\n' +
           '• Ash trays and disposal facilities\n' +
           '• 24-hour accessibility\n\n' +
           '⚠️ **Important:** Smoking is only permitted in designated areas. Follow airport signage to locate the smoking zone.\n\n' +
           '📞 **For directions:** Ask airport staff or look for smoking area signs throughout the terminal.';
  }

  private createHotelServicesResponse(entries: ScoredKnowledgeEntry[]): string {
    // Look for hotel service entries
    const hotelEntries = entries.filter(entry => 
      entry.category === 'hotel_services' || 
      entry.question.toLowerCase().includes('hotel') ||
      entry.question.toLowerCase().includes('aerotel') ||
      entry.answer.toLowerCase().includes('hotel') ||
      entry.answer.toLowerCase().includes('aerotel') ||
      entry.answer.toLowerCase().includes('accommodation')
    );
    
    // ALWAYS provide hotel information for hotel queries, even if no specific entries found
    if (hotelEntries.length > 0 || true) {
      let response = '🏨 **Hotel Services at Muscat International Airport:**\n\n';
      
      // Find main hotel availability entry
      const hotelAvailabilityEntry = hotelEntries.find(entry => 
        entry.question.toLowerCase().includes('hotel available') ||
        entry.question.toLowerCase().includes('hotel within')
      );
      
      if (hotelAvailabilityEntry) {
        response += '✅ **Aerotel Transit Hotel - Available Inside the Airport**\n\n';
        response += '🏨 **About Aerotel:**\n';
        response += '• Premium transit hotel located within Muscat International Airport\n';
        response += '• Perfect for passengers with layovers, early flights, or late arrivals\n';
        response += '• Located in the secure area - no need to clear immigration\n';
        response += '• Designed specifically for airport passengers\n\n';
      }
      
      // Find facilities entry
      const facilitiesEntry = hotelEntries.find(entry => 
        entry.question.toLowerCase().includes('facilities') ||
        entry.question.toLowerCase().includes('what does aerotel offer')
      );
      
      if (facilitiesEntry) {
        response += '🛏️ **Facilities & Amenities:**\n';
        response += '• Comfortable private rooms with beds\n';
        response += '• Clean bathroom facilities with showers\n';
        response += '• Air conditioning and climate control\n';
        response += '• Wi-Fi internet access\n';
        response += '• 24-hour reception and check-in\n';
        response += '• Quiet environment for rest and relaxation\n\n';
      }
      
      // Find booking/contact entry
      const contactEntry = hotelEntries.find(entry => 
        entry.question.toLowerCase().includes('contact') ||
        entry.question.toLowerCase().includes('booking')
      );
      
      if (contactEntry) {
        response += '📞 **Booking Information:**\n';
        response += '• **Website:** https://www.muscatairport.co.om/en/content/aerotel\n';
        response += '• **Advance booking recommended** (especially during peak seasons)\n';
        response += '• **Airport Info Desk:** +968 24351234\n';
        response += '• **Aerotel Reception:** Located within the airport\n\n';
      }
      
      // Find layover entry
      const layoverEntry = hotelEntries.find(entry => 
        entry.question.toLowerCase().includes('layover') ||
        entry.question.toLowerCase().includes('long layover')
      );
      
      if (layoverEntry) {
        response += '⏰ **Perfect for Long Layovers:**\n';
        response += '• Hourly and daily rates available\n';
        response += '• Flexible booking options\n';
        response += '• Easy access to departure gates\n';
        response += '• Comfortable rest between flights\n\n';
      }
      
      response += '💡 **Tip:** Aerotel is ideal for transit passengers who want comfortable accommodation without leaving the airport secure area.';
      
      return response;
    }
    
    // Fallback response with basic hotel information
    return '🏨 **Hotel Services at Muscat International Airport:**\n\n' +
           '✅ **Aerotel Transit Hotel** is available within the airport for passengers needing accommodation.\n\n' +
           '**Key Features:**\n' +
           '• Located inside the airport (secure area)\n' +
           '• Perfect for layovers and transit passengers\n' +
           '• Private rooms with modern amenities\n' +
           '• 24-hour reception\n\n' +
           '📞 **For bookings and information:**\n' +
           '• Visit: https://www.muscatairport.co.om/en/content/aerotel\n' +
           '• Contact airport info desk: +968 24351234';
  }

  private createPrimeclassServicesResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    // Look for Primeclass service entries
    const primeclassEntries = entries.filter(entry => 
      entry.question.toLowerCase().includes('primeclass') || 
      entry.answer.toLowerCase().includes('primeclass') ||
      entry.question.toLowerCase().includes('departure service') ||
      entry.question.toLowerCase().includes('arrival service') ||
      entry.question.toLowerCase().includes('fast-track') ||
      entry.question.toLowerCase().includes('transit service') ||
      entry.answer.toLowerCase().includes('fast-track') ||
      entry.answer.toLowerCase().includes('personal assistant')
    );
    
    if (primeclassEntries.length > 0) {
      // Determine if this is specifically an arrival query
      const isArrivalQuery = (userQuestion: string) => {
        const lower = userQuestion.toLowerCase();
        return lower.includes('arrival') || lower.includes('assisted arrival') || 
               lower.includes('arrival service') || lower.includes('arriving');
      };

      // Determine if this is a VIP/assistance query for first-time travelers
      const isVIPAssistanceQuery = (userQuestion: string) => {
        const lower = userQuestion.toLowerCase();
        return lower.includes('vip services') || lower.includes('vip service') ||
               (lower.includes('assistance') && (lower.includes('first time') || lower.includes('airport process'))) ||
               (lower.includes('traveling alone') && lower.includes('assistance')) ||
               (lower.includes('services offered') && lower.includes('assistance'));
      };
      
      // Create comprehensive response
      let response = '';
      
      // Check if it's specifically about VIP/assistance services
      if (isVIPAssistanceQuery(userQuestion || '')) {
        response = '👑 **VIP & Assistance Services for Passengers at Muscat International Airport:**\n\n';
        response += '✨ **Perfect for first-time travelers and passengers traveling alone who need guidance through airport processes.**\n\n';
      } else if (isArrivalQuery(userQuestion || '')) {
        response = '🛬 **Arrival Services Available at Muscat International Airport:**\n\n';
      } else {
        response = '✈️ **Premium Services Available at Muscat International Airport:**\n\n';
      }
      
      // Find arrival service entry
      const arrivalEntry = primeclassEntries.find(entry => 
        entry.question.toLowerCase().includes('arrival service') ||
        entry.question.toLowerCase().includes('primeclass arrival')
      );
      
      // Find departure service entry
      const departureEntry = primeclassEntries.find(entry => 
        entry.question.toLowerCase().includes('departure service cost') ||
        entry.question.toLowerCase().includes('departure service')
      );
      
      // Find fast-track entry
      const fastTrackEntry = primeclassEntries.find(entry => 
        entry.question.toLowerCase().includes('fast-track')
      );
      
      // Find transit service entry
      const transitEntry = primeclassEntries.find(entry => 
        entry.question.toLowerCase().includes('transit service')
      );
      
      // Find contact/booking entry
      const contactEntry = primeclassEntries.find(entry => 
        entry.question.toLowerCase().includes('book primeclass') ||
        entry.question.toLowerCase().includes('contact primeclass')
      );
      
      // For VIP/assistance queries, show comprehensive services
      if (isVIPAssistanceQuery(userQuestion || '')) {
        // Show both arrival and departure services as comprehensive assistance
        if (arrivalEntry) {
          response += '🛬 **Primeclass Arrival Assistance (42 OMR per person):**\n';
          response += '• Personal assistant greeting at flight gate with name sign\n';
          response += '• Escort to Primeclass arrival lounge via buggy car\n';
          response += '• Refreshments and comfortable waiting area\n';
          response += '• Personal assistant handles visa procedures and paperwork\n';
          response += '• Fast-track immigration guidance (skip long queues)\n';
          response += '• Personal assistant and porter collect luggage\n';
          response += '• Full escort to terminal exit or connecting flight\n\n';
        }
        
        if (departureEntry) {
          response += '🏆 **Primeclass Departure Assistance (47.62 OMR + VAT per person):**\n';
          response += '• Personal assistant and porter greeting upon arrival\n';
          response += '• Check-in handled at dedicated counters (no waiting)\n';
          response += '• Fast-track immigration passage (skip long queues)\n';
          response += '• Access to Primeclass departure lounge with refreshments\n';
          response += '• Escort to flight gate via buggy car with personal assistant\n\n';
        }
      } else {
        // For arrival-specific queries, prioritize arrival service
        if (isArrivalQuery(userQuestion || '') && arrivalEntry) {
          response += '🛬 **Primeclass Arrival Service (42 OMR per person):**\n';
          response += '• Personal assistant greeting at flight gate with name sign\n';
          response += '• Escort to Primeclass arrival lounge via buggy car\n';
          response += '• Refreshments available in arrival lounge\n';
          response += '• Personal assistant handles visa procedures\n';
          response += '• Fast-track immigration guidance\n';
          response += '• Personal assistant and porter collect luggage\n';
          response += '• Escort to terminal exit\n\n';
        } else if (arrivalEntry && !isArrivalQuery(userQuestion || '')) {
          response += '🛬 **Primeclass Arrival Service (42 OMR per person):**\n';
          response += '• Personal assistant greeting at flight gate with name sign\n';
          response += '• Escort to Primeclass arrival lounge via buggy car with refreshments\n';
          response += '• Personal assistant handles visa procedures\n';
          response += '• Fast-track immigration guidance\n';
          response += '• Personal assistant and porter collect luggage\n';
          response += '• Escort to terminal exit\n\n';
        }

        if (departureEntry && !isArrivalQuery(userQuestion || '')) {
          response += '🏆 **Primeclass Departure Service (47.62 OMR + VAT per person):**\n';
          response += '• Personal assistant and porter greeting\n';
          response += '• Check-in handled at dedicated counters\n';
          response += '• Fast-track immigration passage\n';
          response += '• Access to Primeclass departure lounge\n';
          response += '• Escort to flight gate via buggy car\n\n';
        }
      }
      
      // Show transit service for comprehensive VIP queries
      if (isVIPAssistanceQuery(userQuestion || '') && transitEntry) {
        response += '🔄 **Transit/Connection Assistance (86 OMR + VAT per person):**\n';
        response += '• Personal assistant greeting at gate with name sign\n';
        response += '• Buggy car escort to Transfer Desk and connecting flight\n';
        response += '• 3 hours Primeclass lounge access (extendable)\n';
        response += '• Assistance with connection procedures\n';
        response += '• Escort back to flight gate via buggy car\n\n';
      } else if (fastTrackEntry && !isVIPAssistanceQuery(userQuestion || '')) {
        response += '⚡ **Fast-Track Service:**\n';
        response += '• Swift passage through airport procedures\n';
        response += '• Dedicated fast-track immigration lane\n';
        response += '• Personal assistant escort\n';
        response += '• Lounge access included\n\n';
      } else if (transitEntry && !isVIPAssistanceQuery(userQuestion || '')) {
        response += '🔄 **Transit Service (86 OMR + VAT per person):**\n';
        response += '• Personal assistant at gate with name sign\n';
        response += '• Buggy car escort to Transfer Desk\n';
        response += '• 3 hours Primeclass lounge access\n';
        response += '• Escort back to flight gate\n\n';
      }
      
      // Always show contact info, but customize message for VIP assistance
      if (isVIPAssistanceQuery(userQuestion || '')) {
        response += '📞 **Book Your VIP Assistance Service:**\n';
        response += '• **Phone:** +968 98264399, +968 91160486, +968 24356001\n';
        response += '• **Advance Booking Recommended** for first-time travelers\n';
        response += '• **24/7 Support** available during your travel\n';
        response += '• **Website:** http://www.primeclass.com.tr/en/Services/Pages/Oman-Muscat-Airport.aspx\n\n';
        response += '✨ **Why Choose VIP Assistance?** Perfect for passengers unfamiliar with airport procedures, traveling alone, or needing extra support navigating immigration, customs, and connections.';
      } else if (contactEntry) {
        response += '📞 **Booking Information:**\n';
        response += '• Phone: +968 98264399, +968 91160486, +968 24356001\n';
        response += '• Email: Available through Primeclass\n';
        response += '• Website: http://www.primeclass.com.tr/en/Services/Pages/Oman-Muscat-Airport.aspx';
      }
      
      return response;
    }
    
    // Fallback to any relevant entry
    const serviceEntry = entries.find(entry => 
      entry.category === 'services' || entry.category === 'primeclass'
    );
    if (serviceEntry) {
      return serviceEntry.answer;
    }
    
    return "For departure services and airport assistance, please contact the airport information desk or Primeclass services at +968 98264399.";
  }

  // LOUNGE ACCESS RESPONSE METHOD
  private createLoungeAccessResponse(entries: ScoredKnowledgeEntry[], userQuestion: string = ''): string {
    const questionLower = (userQuestion || '').toLowerCase();
    
    // Find pricing-specific entry
    const pricingEntry = entries.find(entry => {
      const q = (entry.question || '').toLowerCase();
      const a = (entry.answer || '').toLowerCase();
      return (q.includes('cost') || q.includes('price') || q.includes('fee') || q.includes('charge') ||
              a.includes('omr') || a.includes('25') || a.includes('vat') || 
              a.includes('cost') || a.includes('price') || a.includes('fee') || a.includes('charge'));
    });
    
    // Find general lounge access entry
    const accessEntry = entries.find(entry => {
      const q = (entry.question || '').toLowerCase();
      const a = (entry.answer || '').toLowerCase();
      return (q.includes('access') || q.includes('entry') || q.includes('admission') ||
              a.includes('access') || a.includes('entry') || a.includes('admission') ||
              a.includes('walk-in') || a.includes('pay-per-use'));
    });
    
    // Find card eligibility entry
    const cardEntry = entries.find(entry => {
      const q = (entry.question || '').toLowerCase();
      const a = (entry.answer || '').toLowerCase();
      return (q.includes('card') || q.includes('debit') || q.includes('credit') ||
              a.includes('card') || a.includes('debit') || a.includes('credit') ||
              a.includes('visa') || a.includes('mastercard'));
    });
    
    // Build comprehensive response
    let response = '🏢 **Primeclass Lounge Access Information:**\n\n';
    
    // Pricing information
    if (pricingEntry) {
      // Extract pricing from answer
      const answer = pricingEntry.answer;
      const omrMatch = answer.match(/OMR\s*([\d.]+)/i) || answer.match(/([\d.]+)\s*OMR/i);
      const vatMatch = answer.match(/vat/i);
      
      if (omrMatch) {
        const price = omrMatch[1];
        response += `💰 **Access Fee:** OMR ${price}${vatMatch ? ' + VAT' : ''} per person\n\n`;
      } else if (answer.includes('25')) {
        response += `💰 **Access Fee:** OMR 25${vatMatch ? ' + VAT' : ''} per person\n\n`;
      } else {
        // Use the entry's answer directly if it contains pricing info
        const pricingSection = answer.split('\n').find((line: string) => 
          line.toLowerCase().includes('omr') || 
          line.toLowerCase().includes('cost') || 
          line.toLowerCase().includes('price') ||
          line.toLowerCase().includes('fee')
        );
        if (pricingSection) {
          response += `💰 **Access Fee:** ${pricingSection.trim()}\n\n`;
        } else {
          response += `💰 **Access Fee:** ${pricingEntry.answer.substring(0, 200)}...\n\n`;
        }
      }
    } else {
      // Default pricing if not found in KB
      response += `💰 **Access Fee:** OMR 25 + VAT per person (walk-in rate)\n\n`;
    }
    
    // Access methods
    if (accessEntry || cardEntry) {
      response += `**Access Methods:**\n`;
      
      if (cardEntry) {
        const cardInfo = cardEntry.answer;
        if (cardInfo.includes('debit') || cardInfo.includes('credit')) {
          response += `• **Debit/Credit Cards:** Accepted for lounge access\n`;
        }
        if (cardInfo.includes('visa') || cardInfo.includes('mastercard')) {
          response += `• **Visa/Mastercard:** Accepted\n`;
        }
      }
      
      if (accessEntry) {
        const accessInfo = accessEntry.answer.toLowerCase();
        if (accessInfo.includes('walk-in')) {
          response += `• **Walk-in:** Available at the lounge entrance\n`;
        }
        if (accessInfo.includes('pay-per-use')) {
          response += `• **Pay-per-use:** Direct payment at lounge\n`;
        }
      } else {
        response += `• **Walk-in:** Available at the lounge entrance\n`;
        response += `• **Debit/Credit Cards:** Accepted for payment\n`;
      }
      response += '\n';
    }
    
    // Location information
    const locationEntry = entries.find(entry => {
      const q = (entry.question || '').toLowerCase();
      const a = (entry.answer || '').toLowerCase();
      return (q.includes('where') || q.includes('location') || q.includes('located') ||
              a.includes('departure') || a.includes('level') || a.includes('terminal'));
    });
    
    if (locationEntry) {
      const locationInfo = locationEntry.answer;
      const locationMatch = locationInfo.match(/(?:located|location|level|departure)[^.]{0,100}/i);
      if (locationMatch) {
        response += `📍 **Location:** ${locationMatch[0].trim()}\n\n`;
      }
    } else {
      response += `📍 **Location:** Departures Level (Level 4), International Terminal\n\n`;
    }
    
    // Duration/Stay information
    const durationEntry = entries.find(entry => {
      const q = (entry.question || '').toLowerCase();
      const a = (entry.answer || '').toLowerCase();
      return (q.includes('how long') || q.includes('duration') || q.includes('stay') ||
              a.includes('hour') || a.includes('3 hour') || a.includes('duration'));
    });
    
    if (durationEntry) {
      const durationInfo = durationEntry.answer;
      const hourMatch = durationInfo.match(/(\d+)\s*hour/i);
      if (hourMatch) {
        response += `⏰ **Stay Duration:** ${hourMatch[0]} per access\n\n`;
      }
    }
    
    // Contact information
    response += `📞 **For More Information:**\n`;
    response += `• Phone: +968 98264399, +968 91160486, +968 24356001\n`;
    response += `• Website: https://www.muscatairport.co.om/en/content/primeclass-lounge\n`;
    
    return response;
  }

  // MEDICAL-SPECIFIC RESPONSE METHODS
  private createMedicalClinicResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find clinic-specific entry
    const clinicEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('clinic') || 
      entry.question.toLowerCase().includes('medical clinic')
    );
    
    if (clinicEntry) {
      return clinicEntry.answer;
    }
    
    // Fallback to any medical entry
    const medicalEntry = entries.find(entry => entry.category === 'medical');
    if (medicalEntry) {
      return medicalEntry.answer;
    }
    
    return "For medical clinic information, please contact the airport information desk or visit the medical services area.";
  }

  private createMedicalPharmacyResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find pharmacy-specific entry
    const pharmacyEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('pharmacy') || 
      entry.question.toLowerCase().includes('medication')
    );
    
    if (pharmacyEntry) {
      return pharmacyEntry.answer;
    }
    
    // Fallback to any medical entry
    const medicalEntry = entries.find(entry => entry.category === 'medical');
    if (medicalEntry) {
      return medicalEntry.answer;
    }
    
    return "For pharmacy services, please check with the airport medical services or visit the pharmacy locations in the terminal.";
  }

  private createMedicalEmergencyResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find emergency-specific entry
    const emergencyEntry = entries.find(entry => 
      entry.question.toLowerCase().includes('emergency') || 
      entry.question.toLowerCase().includes('urgent') ||
      entry.question.toLowerCase().includes('first aid')
    );
    
    if (emergencyEntry) {
      return emergencyEntry.answer;
    }
    
    // Fallback to any medical entry
    const medicalEntry = entries.find(entry => entry.category === 'medical');
    if (medicalEntry) {
      return medicalEntry.answer;
    }
    
    return "For medical emergencies, please contact the flight information desk or airport security immediately.";
  }

  private createMedicalGeneralResponse(entries: ScoredKnowledgeEntry[]): string {
    // Find the best medical entry
    const medicalEntry = entries.find(entry => entry.category === 'medical');
    
    if (medicalEntry) {
      return medicalEntry.answer;
    }
    
    return "For medical services and assistance, please contact the airport information desk or visit the medical services area.";
  }

  private buildPrompt(message: string, context: string, preferredLanguage: 'ar' | 'en' = 'en'): string {
    const languageInstruction = preferredLanguage === 'ar' 
      ? `You MUST respond ENTIRELY in Arabic. Do not mix languages. Write your complete response in Arabic only.`
      : `You MUST respond ENTIRELY in English. Do not mix languages. Write your complete response in English only.`;

    const systemPrompt = `You are a helpful AI assistant for Muscat International Airport.

🌍 LANGUAGE REQUIREMENTS:
- ${languageInstruction}
- Maintain language consistency throughout the entire response
- If the user's question is in ${preferredLanguage === 'ar' ? 'Arabic' : 'English'}, respond completely in ${preferredLanguage === 'ar' ? 'Arabic' : 'English'}
- Never mix languages in a single response
- If the conversation started in ${preferredLanguage === 'ar' ? 'Arabic' : 'English'}, continue responding in ${preferredLanguage === 'ar' ? 'Arabic' : 'English'} until the user switches languages
- Always understand and process both Arabic and English text

🎯 PROVIDE: Clear, contextual answers that consider conversation history.

CONTEXT AWARENESS:
- If user asks "more details" or "tell me more", refer to previous conversation
- For follow-up questions, expand on previously mentioned topics
- Maintain conversation continuity and remember what was discussed

FORMAT RULES:
- Keep answers concise but complete
- Use • for bullet points when listing items
- Bold important names with **Name** (use proper markdown: **text**, not ***text** or **text**:)
- Never repeat the same information twice
- Use proper spacing and punctuation
- Format numbers clearly (e.g., "1.10 ريال عماني" not "1.10ريال عماني")
- If user asks for more details, provide specific information about the topic
- Avoid formatting artifacts like standalone asterisks or broken markdown`;

    if (context) {
      return `${systemPrompt}\n\n📚 CONTEXT & KNOWLEDGE:\n${context}\n\n❓ USER QUESTION: ${message}\n\n💬 YOUR CONTEXTUAL RESPONSE:`;
    }
    
    return `${systemPrompt}\n\n❓ USER QUESTION: ${message}\n\n💬 YOUR RESPONSE:`;
  }

  // Response when no relevant information is available in knowledge base
  // Check if message is a greeting
  private isGreeting(message: string): boolean {
    const trimmedMessage = message.trim();
    const lowerMessage = trimmedMessage.toLowerCase();
    
    // Arabic greeting patterns (in Arabic script)
    const arabicGreetings = [
      'مرحبا', 'السلام عليكم', 'أهلا', 'أهلا وسهلا', 'أهلين', 'أهلين وسهلين',
      'صباح الخير', 'مساء الخير', 'مساء النور', 'صباح النور',
      'هاي', 'هلا', 'هلا والله'
    ];
    
    // English greeting patterns
    const englishGreetings = [
      'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 
      'good evening', 'good night', 'morning', 'afternoon', 'evening',
      'hey there', 'hi there', 'hello there', 'howdy'
    ];
    
    // Arabic greeting transliterations and variations
    const arabicGreetingVariations = [
      'aslamaleykum', 'assalamu alaykum', 'assalamu alaikum', 'as-salamu alaykum',
      'salam', 'salaam', 'salamu alaykum', 'salam alaikum',
      'salamu', 'salamu alaikum', 'assalam', 'asalam',
      'ahlan', 'ahlayn', 'ahlan wa sahlan', 'ahlayn wa sahlayn',
      'marhaba', 'marhaban', 'marhabaan', 'marhaba bik', 'marhaba bikum'
    ];
    
    // Check for Arabic greetings (exact match or starts with)
    if (arabicGreetings.some(pattern => 
      trimmedMessage === pattern || 
      trimmedMessage.startsWith(pattern + ' ') || 
      trimmedMessage.startsWith(pattern + '!') ||
      trimmedMessage.startsWith(pattern + '،') ||
      trimmedMessage.startsWith(pattern + '.')
    )) {
      return true;
    }
    
    // Check for English greetings
    if (englishGreetings.some(pattern => 
      lowerMessage === pattern || 
      lowerMessage.startsWith(pattern + ' ') || 
      lowerMessage === pattern + '!'
    )) {
      return true;
    }
    
    // Check for Arabic greeting transliterations
    if (arabicGreetingVariations.some(pattern => 
      lowerMessage === pattern || 
      lowerMessage.startsWith(pattern + ' ') || 
      lowerMessage.startsWith(pattern + '!')
    )) {
      return true;
    }
    
    // Check for greeting + short follow-up (handles both English and Arabic)
    const greetingWithFollowUp = /^(hello|hi|hey|greetings|مرحبا|السلام عليكم|أهلا|أهلين|aslamaleykum|assalamu|salam|ahlan|ahlayn|marhaba)[\s,،]*[\s\S]{0,30}$/i.test(trimmedMessage);
    if (greetingWithFollowUp && trimmedMessage.length < 50) {
      return true;
    }
    
    // Check if message is just a greeting word (handles variations)
    if (trimmedMessage.length <= 20) {
      // Check for Arabic greeting patterns
      const arabicGreetingRegex = /^(مرحبا|السلام عليكم|أهلا|أهلين|صباح الخير|مساء الخير)/;
      if (arabicGreetingRegex.test(trimmedMessage)) {
        return true;
      }
      
      // Check for transliterated greetings
      if (lowerMessage.match(/^(aslam|assalam|salam|ahlan|ahlayn|marhaba|hello|hi|hey)/i)) {
        return true;
      }
      
      // Check for greeting with response patterns
      if (lowerMessage.match(/^(aslam|assalam|salam|ahlan|ahlayn|marhaba|hello|hi|hey).*alaykum/i) ||
          lowerMessage.match(/^(aslam|assalam|salam|ahlan|ahlayn|marhaba|hello|hi|hey).*alaikum/i)) {
        return true;
      }
    }
    
    return false;
  }

  // Generate appropriate greeting response
  private getGreetingResponse(preferredLanguage: 'ar' | 'en' = 'en'): string {
    if (preferredLanguage === 'ar') {
      return `وعليكم السلام ورحمة الله وبركاته\n\n` +
             `مرحباً! أهلاً وسهلاً بك في مطار مسقط الدولي. 🛫\n\n` +
             `كيف يمكنني مساعدتك اليوم؟ يمكنني مساعدتك في:\n\n` +
             `• خدمات المطار والمرافق\n` +
             `• معلومات المواصلات والمواقف\n` +
             `• المطاعم والمقاهي\n` +
             `• التسوق والخدمات الأخرى\n\n` +
             `ما الذي تود معرفته؟`;
    }

    return `Hello! Welcome to Muscat International Airport. 🛫\n\n` +
           `How can I help you today? I can assist you with:\n\n` +
           `• Airport services and facilities\n` +
           `• Transportation and parking information\n` +
           `• Dining and shopping options\n` +
           `• And much more!\n\n` +
           `What would you like to know?`;
  }

  private getNoInformationResponse(message: string, preferredLanguage: 'ar' | 'en' = 'en'): string {
    if (preferredLanguage === 'ar') {
      return `عذراً، لا توجد معلومات متاحة حاليًا حول هذا الموضوع في قاعدة المعرفة الخاصة بنا.\n\n` +
             `**للحصول على المعلومات الأكثر دقة وحديثة، يرجى:**\n\n` +
             `• **زيارة الموقع الرسمي:** [www.muscatairport.co.om](https://www.muscatairport.co.om)\n` +
             `• **الاتصال بخدمة العملاء:** +968 24351234\n` +
             `• **البريد الإلكتروني:** info@muscatairport.co.om\n\n` +
             `سنكون سعداء لمساعدتك في أي استفسارات أخرى حول المطار ومرافقه.`;
    }
    
    return `I apologize, but we currently don't have information on this topic in our knowledge base.\n\n` +
           `**To get the most accurate and up-to-date information, please:**\n\n` +
           `• **Visit our official website:** [www.muscatairport.co.om](https://www.muscatairport.co.om)\n` +
           `• **Contact Customer Service:** +968 24351234\n` +
           `• **Email:** info@muscatairport.co.om\n\n` +
           `We're happy to help with any other inquiries about the airport and its facilities.`;
  }

  private getFallbackResponse(message: string, preferredLanguage: 'ar' | 'en' = 'en'): string {
    // Intelligent fallback responses based on query type
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('flight') || lowerMessage.includes('departure') || lowerMessage.includes('arrival')) {
      return `✈️ **Flight Information**

For the most up-to-date flight details:
• Check flight information displays at the airport
• Visit our website: **omanairports.co.om**
• Contact our information desk for assistance

Our team is here to help with any flight-related questions!`;
    }
    
    if (lowerMessage.includes('parking') || lowerMessage.includes('car')) {
      return `🅿️ **Parking Services**

Parking is available at all Oman Airports terminals:
• Multiple parking zones available
• Current rates and availability at **omanairports.co.om**
• Contact our customer service team at the airport for assistance

We offer convenient parking solutions for all travel needs!`;
    }
    
    if (lowerMessage.includes('taxi') || lowerMessage.includes('transport') || lowerMessage.includes('bus')) {
      return `🚗 **Transportation Options**

Multiple transportation options available:
• Taxis (available 24/7)
• Airport buses
• Car rental services
• Ride-sharing services

For detailed schedules and information:
• Visit the ground transportation area
• Check with airport information desk`;
    }
    
    if (lowerMessage.includes('baggage') || lowerMessage.includes('luggage')) {
      return `🧳 **Baggage Information**

I don't have specific baggage information from the official Muscat Airport website at this time.

For accurate baggage details:
• **Contact your airline directly** for specific policies and restrictions
• Visit the **baggage services counter** at your terminal
• Check your **airline's official website** for current requirements
• Visit the **airport information desk** for general assistance

Each airline has their own baggage allowances, restrictions, and procedures.`;
    }
    
    // Default fallback
    const fallbackResponses = [
      `🏢 **Information Not Available**

I don't have specific information about this topic from the official Muscat Airport website.

For accurate information:
• Visit our **information desk** at the terminal
• Check our website: **muscatairport.co.om**
• Speak with our airport staff for assistance

We're here to help make your journey smooth!`,
      
      `📞 **Limited Information Available**

I don't have detailed information about this topic from official sources.

For comprehensive assistance:
• Contact our **customer service team** at the airport
• Visit **muscatairport.co.om** for official information
• Our staff is available to help with specific inquiries`,
      
      `ℹ️ **Information & Support**

I don't have specific information about this from our website content.

For the most accurate and up-to-date information:
• Visit **muscatairport.co.om**
• Speak with our **airport staff**
• Check with our **information desks** at the terminal

We're committed to providing accurate service!`,
    ];
    
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  async getProviderStatus(): Promise<{ [key: string]: boolean }> {
    const status: { [key: string]: boolean } = {};
    
    for (const provider of this.providers) {
      try {
        switch (provider.name) {
          case 'gemini':
            status[provider.name] = !!provider.apiKey;
            break;
          case 'huggingface':
            status[provider.name] = !!provider.apiKey;
            break;
          case 'ollama':
            try {
              await fetch(`${provider.endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
              status[provider.name] = true;
            } catch {
              status[provider.name] = false;
            }
            break;
          default:
            status[provider.name] = false;
        }
      } catch (error) {
        status[provider.name] = false;
      }
    }
    
    return status;
  }

  // Check and update API quota
  private async checkAndUpdateQuota(provider: string): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's quota record
      let quotaRecord = await prisma.apiQuota.findUnique({
        where: {
          provider_date: {
            provider,
            date: today
          }
        }
      });

      // Create quota record if it doesn't exist
      if (!quotaRecord) {
        const resetAt = new Date(today);
        resetAt.setDate(resetAt.getDate() + 1); // Reset at midnight next day

        // Get real quota limits for Gemini
        let dailyLimit = 1000;
        if (provider === 'gemini') {
          try {
            const realLimits = await this.getRealQuotaLimits();
            dailyLimit = realLimits && realLimits.limits.requestsPerDay > 0 
              ? realLimits.limits.requestsPerDay 
              : 1000; // Free tier actual limit
          } catch (error) {
            console.warn('Could not get real quota limits, using default:', error);
            dailyLimit = 1000;
          }
        }

        quotaRecord = await prisma.apiQuota.create({
          data: {
            provider,
            date: today,
            dailyLimit,
            usedCount: 0,
            resetAt,
            isActive: true
          }
        });
      }

      // Check if quota is exceeded
      if (quotaRecord.usedCount >= quotaRecord.dailyLimit) {
        return false;
      }

      // Increment usage count
      await prisma.apiQuota.update({
        where: { id: quotaRecord.id },
        data: {
          usedCount: { increment: 1 },
          updatedAt: new Date()
        }
      });

      return true;
    } catch (error) {
      console.error('Error checking quota:', error);
      // Return true to allow operation if there's a DB error
      return true;
    }
  }

  // Get current quota status with real Gemini limits
  async getQuotaStatus(provider: string): Promise<{
    dailyLimit: number;
    usedCount: number;
    remainingCount: number;
    resetAt: Date;
    percentageUsed: number;
    quotaTier?: string;
    model?: string;
    rpmLimit?: number;
    tpmLimit?: number;
  } | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const quotaRecord = await prisma.apiQuota.findUnique({
        where: {
          provider_date: {
            provider,
            date: today
          }
        }
      });

      // Get real quota limits for Gemini
      let realLimits = null;
      if (provider === 'gemini') {
        realLimits = await this.getRealQuotaLimits();
      }

      if (!quotaRecord) {
        // Return default values if no record exists
        const resetAt = new Date(today);
        resetAt.setDate(resetAt.getDate() + 1);
        
        const dailyLimit = provider === 'gemini' 
          ? (realLimits && realLimits.limits.requestsPerDay > 0 ? realLimits.limits.requestsPerDay : 1000)
          : 1000;
        
        return {
          dailyLimit,
          usedCount: 0,
          remainingCount: dailyLimit,
          resetAt,
          percentageUsed: 0,
          quotaTier: realLimits?.tier,
          model: realLimits?.model,
          rpmLimit: realLimits?.limits.requestsPerMinute,
          tpmLimit: realLimits?.limits.tokensPerMinute
        };
      }

      const remainingCount = quotaRecord.dailyLimit - quotaRecord.usedCount;
      const percentageUsed = Math.round((quotaRecord.usedCount / quotaRecord.dailyLimit) * 100);

      return {
        dailyLimit: quotaRecord.dailyLimit,
        usedCount: quotaRecord.usedCount,
        remainingCount: Math.max(0, remainingCount),
        resetAt: quotaRecord.resetAt,
        percentageUsed,
        quotaTier: realLimits?.tier,
        model: realLimits?.model,
        rpmLimit: realLimits?.limits.requestsPerMinute,
        tpmLimit: realLimits?.limits.tokensPerMinute
      };
    } catch (error) {
      console.error('Error getting quota status:', error);
      return null;
    }
  }

  // Track RPM usage
  private trackRpmUsage(provider: string): void {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    if (!this.requestTracker.has(provider)) {
      this.requestTracker.set(provider, []);
    }
    
    const requests = this.requestTracker.get(provider)!;
    requests.push(currentMinute);
    
    // Keep only requests from the last minute
    const oneMinuteAgo = currentMinute - 1;
    this.requestTracker.set(provider, requests.filter(time => time > oneMinuteAgo));
  }

  // Get current RPM usage
  private getCurrentRpm(provider: string): number {
    if (!this.requestTracker.has(provider)) return 0;
    
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const requests = this.requestTracker.get(provider)!;
    
    // Count requests in current minute
    return requests.filter(time => time === currentMinute).length;
  }

  // Get all providers quota status
  async getAllQuotaStatus(): Promise<{ [provider: string]: any }> {
    const providers = ['gemini', 'huggingface'];
    const quotaStatus: { [provider: string]: any } = {};

    for (const provider of providers) {
      const status = await this.getQuotaStatus(provider);
      if (status && provider === 'gemini') {
        // Add real-time RPM data
        const currentRpm = this.getCurrentRpm(provider);
        const rpmPercentage = status.rpmLimit ? Math.round((currentRpm / status.rpmLimit) * 100) : 0;
        
        quotaStatus[provider] = {
          ...status,
          currentRpm,
          rpmPercentage,
          isNearDailyLimit: status.percentageUsed >= 90,
          isAtDailyLimit: status.percentageUsed >= 100,
          isNearRpmLimit: rpmPercentage >= 90,
          isAtRpmLimit: rpmPercentage >= 100
        };
      } else {
        quotaStatus[provider] = status;
      }
    }

    return quotaStatus;
  }

  // Method to detect quota tier (can be enhanced with API calls)
  async detectQuotaTier(): Promise<'FREE_TIER' | 'TIER_1' | 'TIER_2' | 'TIER_3'> {
    // This could be enhanced to:
    // 1. Make a test API call to check rate limits
    // 2. Check Google Cloud billing status
    // 3. Use Google Cloud Quotas API
    
    // For now, return FREE_TIER
    // TODO: Implement actual tier detection
    return 'FREE_TIER';
  }

  // Get real-time quota information
  async getRealQuotaLimits(): Promise<{
    model: string;
    tier: string;
    limits: {
      requestsPerMinute: number;
      tokensPerMinute: number;
      requestsPerDay: number;
    };
    description: string;
  }> {
    const tier = await this.detectQuotaTier();
    
    const QUOTA_TIERS = {
      FREE_TIER: {
        name: 'Free Tier',
        requestsPerMinute: 15,
        tokensPerMinute: 250000,
        requestsPerDay: 1000,
        description: 'Free tier for testing and development'
      },
      TIER_1: {
        name: 'Tier 1 (Billing Enabled)',
        requestsPerMinute: 4000,
        tokensPerMinute: 4000000,
        requestsPerDay: -1,
        description: 'Billing account linked to project'
      },
      TIER_2: {
        name: 'Tier 2 ($250+ spent)',
        requestsPerMinute: 10000,
        tokensPerMinute: 10000000,
        requestsPerDay: 100000,
        description: 'Total spend > $250 and at least 30 days since payment'
      },
      TIER_3: {
        name: 'Tier 3 ($1000+ spent)',
        requestsPerMinute: 30000,
        tokensPerMinute: 30000000,
        requestsPerDay: -1,
        description: 'Total spend > $1,000 and at least 30 days since payment'
      }
    };

    const currentTier = QUOTA_TIERS[tier];
    
    return {
      model: 'gemini-2.5-flash-lite-preview-06-17',
      tier: currentTier.name,
      limits: {
        requestsPerMinute: currentTier.requestsPerMinute,
        tokensPerMinute: currentTier.tokensPerMinute,
        requestsPerDay: currentTier.requestsPerDay
      },
      description: currentTier.description
    };
  }
}

export const aiService = AIService.getInstance(); 