// AI Service for Oman Airports Chatbot
// Supports multiple AI providers with free tiers

import { prisma } from './database';
import { getRelevantKnowledgeEntries } from './rag-service';

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
    // First attempt semantic vector search via pgvector
    try {
      const vectorMatches = await getRelevantKnowledgeEntries(query, 8);
      if (vectorMatches && vectorMatches.length > 0) {
        return vectorMatches as ScoredKnowledgeEntry[];
      }
    } catch (err) {
      console.error('[AIService] Vector search failed, falling back to keyword search:', err);
    }

    try {
      // Extract meaningful keywords (excluding common words and location terms)
      const stopWords = ['what', 'is', 'are', 'the', 'at', 'in', 'on', 'and', 'or', 'for', 'with', 'by', 'to', 'from', 'of', 'a', 'an', 'airport', 'airports', 'muscat', 'oman'];
      const keywords = query.toLowerCase()
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
          sourceUrl: true
        }
      });

      // Calculate relevance scores with improved algorithm
      const scoredEntries: ScoredKnowledgeEntry[] = entries.map(entry => {
        const questionText = entry.question.toLowerCase();
        const answerText = entry.answer.toLowerCase();
        const categoryText = entry.category.toLowerCase();
        
        let score = 0;
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
          
                  // Special boost for dining-related keywords
        const diningKeywords = ['food', 'restaurant', 'dining', 'coffee', 'cafe', 'kitchen', 'eat', 'drink', 'meal', 'indian', 'spice', 'options', 'healthy'];
        if (diningKeywords.includes(keyword) && categoryText.includes('dining')) {
          score += 15; // Significant boost for dining queries
        }
        
        // Boost for health-related queries
        if (['healthy', 'health', 'nutritious'].includes(keyword)) {
          if (questionText.includes('plenty') || answerText.includes('plenty') || 
              answerText.includes('healthy') || answerText.includes('nutritious') || answerText.includes('wholesome')) {
            score += 30; // Major boost for healthy dining content
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

        return {
          ...entry,
          relevanceScore: score
        } as ScoredKnowledgeEntry;
      });

      const filtered = scoredEntries.filter(e => e.relevanceScore >= 20);
      return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 8);

    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  async generateResponse(
    message: string,
    context: string = '',
    sessionId: string = ''
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Search knowledge base for relevant information
    const knowledgeEntries = await this.searchKnowledgeBase(message);
    let knowledgeContext = '';
    let sources: string[] = [];

    // Check if this is an airport-related question
    const isAirportRelated = this.isAirportRelatedQuestion(message);
    
    // Determine if we have strong knowledge base matches
    const hasStrongKnowledgeMatch = knowledgeEntries.length > 0 && knowledgeEntries[0].relevanceScore > 15;

    if (knowledgeEntries.length > 0) {
      knowledgeContext = '\n\nRelevant Information from Knowledge Base:\n';
      
            // Smart source collection: only from highly relevant entries
      const topEntry = knowledgeEntries[0];
      const messageLower = message.toLowerCase();
      
      // Detect query type for better source filtering
      const isDiningQuery = messageLower.includes('kfc') || messageLower.includes('restaurant') || 
                           messageLower.includes('food') || messageLower.includes('dining') ||
                           messageLower.includes('coffee') || messageLower.includes('eat');
      
      // Detect lounge-specific queries
      const isLoungeQuery = messageLower.includes('lounge') || messageLower.includes('primeclass') ||
                           messageLower.includes('porter') || messageLower.includes('entertainment') ||
                           (messageLower.includes('where') && (messageLower.includes('located') || messageLower.includes('find'))) ||
                           messageLower.includes('facilities') || messageLower.includes('amenities');
      
      // Detect parking/transportation queries
      const isParkingQuery = messageLower.includes('parking') || messageLower.includes('park') ||
                            messageLower.includes('car') || messageLower.includes('vehicle');
      
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
            
            // General filtering for dining vs non-dining queries
            if (isDiningQuery && (isLoungeSource || isTransportSource)) {
              // For dining queries, exclude lounge/transport sources
              shouldIncludeSource = false;
            } else if (!isDiningQuery && !isLoungeQuery && !isParkingQuery && isDiningSource && entry.relevanceScore < 25) {
              // For general queries, exclude low-relevance dining sources
              shouldIncludeSource = false;
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
    const messageLower = message.toLowerCase();
    const isFollowUpQuestion = messageLower.includes('more details') || 
                              messageLower.includes('tell me more') ||
                              messageLower.includes('can you provide more') ||
                              messageLower.includes('what about') ||
                              messageLower.includes('more info') ||
                              messageLower.includes('elaborate') ||
                              messageLower.startsWith('more ') ||
                              messageLower === 'more' ||
                              messageLower.includes('details');

    // For listing questions (coffee, dining, etc), use enhanced knowledge base for better formatting
    const isListingQuestion = messageLower.includes('coffee') || messageLower.includes('dining') || 
                              messageLower.includes('restaurant') || messageLower.includes('food') ||
                              messageLower.includes('where can i get') || messageLower.includes('what are');
    
    // Use enhanced knowledge base for listing questions (but not follow-ups which need AI context)
    if (knowledgeEntries.length > 0 && isListingQuestion && !isFollowUpQuestion) {
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
            response = await this.callGemini(message, fullContext, provider);
            break;
          case 'huggingface':
            response = await this.callHuggingFace(message, fullContext, provider);
            break;
          case 'ollama':
            response = await this.callOllama(message, fullContext, provider);
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
        
        return {
          message: this.formatResponse(response),
          success: true,
          provider: provider.name,
          processingTime,
          knowledgeBaseUsed: hasStrongKnowledgeMatch,
          sources: [...new Set(sources)], // Remove duplicates
          kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
        };

      } catch (error) {
        console.log(`${provider.name} failed:`, error);
        continue;
      }
    }

    // Enhanced knowledge base fallback with intelligent processing
    if (knowledgeEntries.length > 0) {
      const processingTime = Date.now() - startTime;
      
      // Create comprehensive response using all relevant knowledge entries
      const comprehensiveResponse = this.createComprehensiveKnowledgeResponse(
        message, 
        knowledgeEntries
      );
      
      return {
        message: comprehensiveResponse,
        success: true,
        provider: 'enhanced-knowledge-base',
        processingTime,
        knowledgeBaseUsed: hasStrongKnowledgeMatch,
        sources: [...new Set(sources)],
        kbEntryId: knowledgeEntries.length > 0 ? knowledgeEntries[0].id : undefined
      };
    }

    // Final fallback response if all providers fail
    const processingTime = Date.now() - startTime;
    return {
      message: this.getFallbackResponse(message),
      success: false,
      provider: 'fallback',
      processingTime,
      knowledgeBaseUsed: false, // Always false for fallback responses
      sources: [],
      kbEntryId: undefined
    };
  }

  private async callGemini(message: string, context: string, provider: AIProvider): Promise<string> {
    // Track RPM usage for real-time monitoring
    this.trackRpmUsage('gemini');
    
    const prompt = this.buildPrompt(message, context);
    
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

  private async callHuggingFace(message: string, context: string, provider: AIProvider): Promise<string> {
    const prompt = this.buildPrompt(message, context);
    
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

  private async callOllama(message: string, context: string, provider: AIProvider): Promise<string> {
    // Check if Ollama is available
    try {
      await fetch(`${provider.endpoint}/api/tags`);
    } catch {
      throw new Error('Ollama not available');
    }

    const prompt = this.buildPrompt(message, context);
    
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
    
    // 1. Ensure bullet points have a space after the symbol
    text = text.replace(/•\s*/g, '• ');

    // 2. Convert Gemini's triple-asterisk artefacts ***Title** → **Title**
    text = text.replace(/\*\*\*([^\*]+)\*\*/g, '**$1**');

    // 3. Fix unmatched bold markers like **Heading:** → **Heading:**
    // Already fine but ensure trailing ** after colon isn't doubled
    text = text.replace(/\*\*([^\*]+):\*\*/g, '**$1:**');

    // 4. Collapse excessive blank lines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
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
      
      default:
        return this.createDetailedOverviewResponse(knowledgeEntries);
    }
  }
  
  private analyzeQuestionType(questionLower: string): string {
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
    
    return 'general';
  }
  
  private createDetailedOverviewResponse(entries: ScoredKnowledgeEntry[]): string {
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
    
    // Create comprehensive response from multiple entries
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

  private buildPrompt(message: string, context: string): string {
    const systemPrompt = `You are a helpful AI assistant for Muscat International Airport.

🎯 PROVIDE: Clear, contextual answers that consider conversation history.

CONTEXT AWARENESS:
- If user asks "more details" or "tell me more", refer to previous conversation
- For follow-up questions, expand on previously mentioned topics
- Maintain conversation continuity and remember what was discussed

FORMAT RULES:
- Keep answers concise but complete
- Use • for bullet points when listing items
- Bold important names with **Name**
- If user asks for more details, provide specific information about the topic`;

    if (context) {
      return `${systemPrompt}\n\n📚 CONTEXT & KNOWLEDGE:\n${context}\n\n❓ USER QUESTION: ${message}\n\n💬 YOUR CONTEXTUAL RESPONSE:`;
    }
    
    return `${systemPrompt}\n\n❓ USER QUESTION: ${message}\n\n💬 YOUR RESPONSE:`;
  }

  private getFallbackResponse(message: string): string {
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
      return `🧳 **Baggage Services**

For baggage assistance:
• Contact your **airline directly** for policies
• Visit the baggage services counter at your terminal
• Each airline has specific allowances and procedures

Our baggage services team is available to help!`;
    }
    
    // Default fallback
    const fallbackResponses = [
      `🏢 **Oman Airports Assistance**

Thank you for contacting us! For immediate help:
• Visit our information desk at the terminal
• Check our website: **omanairports.co.om**
• Speak with our friendly airport staff

We're here to make your journey smooth and comfortable!`,
      
      `📞 **Customer Service**

I'm currently unable to process your specific request.

For comprehensive assistance:
• Contact our customer service team at the airport
• Visit **omanairports.co.om** for detailed information
• Our staff is available to help with all inquiries`,
      
      `ℹ️ **Information & Support**

For the most accurate and up-to-date information:
• Visit **omanairports.co.om**
• Speak with our airport staff
• Check with our information desks

We're committed to providing excellent service!`,
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