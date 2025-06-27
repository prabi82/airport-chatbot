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
      knowledgeEntries.forEach((entry, index) => {
        knowledgeContext += `${index + 1}. Q: ${entry.question}\n   A: ${entry.answer}\n`;
        if (entry.sourceUrl) {
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
    
    // Determine response type based on question (only for dining/restaurant lists)
    const isListingQuestion = (questionLower.includes('dining options') || 
                              questionLower.includes('restaurants') ||
                              questionLower.includes('coffee') ||
                              questionLower.includes('where can i get coffee') ||
                              questionLower.includes('dining') ||
                              questionLower.includes('food options')) && 
                              !questionLower.includes('rates') && 
                              !questionLower.includes('cost') && 
                              !questionLower.includes('price') &&
                              !questionLower.includes('how much');
    
    if (isListingQuestion && knowledgeEntries.length > 1) {
      // Create comprehensive listing response
      return this.createListingResponse(userQuestion, knowledgeEntries);
    } else {
      // Enhanced single-answer response with context
      return this.createEnhancedSingleResponse(knowledgeEntries[0], knowledgeEntries.slice(1));
    }
  }
  
  private createListingResponse(userQuestion: string, entries: ScoredKnowledgeEntry[]): string {
    const questionLower = userQuestion.toLowerCase();
    let response = '';
    
    // Create simple header
    if (questionLower.includes('coffee')) {
      response = 'Coffee locations ☕:\n';
    } else if (questionLower.includes('dining') || questionLower.includes('restaurant') || questionLower.includes('food')) {
      response = 'Dining options 🍽️:\n';
    } else {
      response = 'Available options:\n';
    }
    
    // Extract restaurants from knowledge base entries
    const restaurants: Array<{ name: string; location: string }> = [];
    const seenRestaurants = new Set<string>();
    
    entries.slice(0, 8).forEach((entry) => {
      const restaurantName = this.extractRestaurantName(entry.question);
      if (restaurantName && !seenRestaurants.has(restaurantName)) {
        seenRestaurants.add(restaurantName);
        
        // Extract simple location info
        const answer = entry.answer.toLowerCase();
        let location = 'Level 4';
        if (answer.includes('arrivals')) location = 'Arrivals';
        if (answer.includes('gate a')) location = 'Gate A';
        if (answer.includes('gate b')) location = 'Gate B';
        
        restaurants.push({ name: restaurantName, location });
      }
    });
    
    // Add coffee-specific places for coffee questions
    if (questionLower.includes('coffee') && restaurants.length < 4) {
      const coffeeShops = [
        { name: 'Caffè Nero', location: 'Level 4' },
        { name: 'Caribou Coffee', location: 'Gate A' },
        { name: 'Tim Hortons', location: 'Level 4' }
      ];
      
      coffeeShops.forEach(shop => {
        if (!seenRestaurants.has(shop.name)) {
          restaurants.push(shop);
          seenRestaurants.add(shop.name);
        }
      });
    }
    
    // Format as clean bullet points
    restaurants.slice(0, 5).forEach((restaurant) => {
      response += `• **${restaurant.name}** - ${restaurant.location}\n`;
    });
    
    return response.trim();
  }
  
  private createEnhancedSingleResponse(mainEntry: ScoredKnowledgeEntry, additionalEntries: ScoredKnowledgeEntry[]): string {
    let response = this.cleanAndFormatAnswer(mainEntry.answer);
    
    // Add related information if available
    const relatedInfo = additionalEntries
      .slice(0, 2)
      .map(entry => this.cleanAndFormatAnswer(entry.answer))
      .filter(info => info.length > 50 && !response.includes(info.substring(0, 30)));
    
    if (relatedInfo.length > 0) {
      response += `\n\n**Additional Information:**\n${relatedInfo[0]}`;
    }
    
    return response;
  }
  
  private extractRestaurantName(question: string): string {
    // Extract restaurant name from "What is [Restaurant Name]?" format
    const match = question.match(/What is (.+?)\?/i);
    if (match) {
      return match[1]
        .replace(/&amp;/g, '&')
        .replace(/&egrave;/g, 'è')
        .replace(/&eacute;/g, 'é');
    }
    return '';
  }
  
  private extractRestaurantMentions(text: string): Array<{ name: string; description: string }> {
    const restaurants: Array<{ name: string; description: string }> = [];
    
    // Common restaurant names at the airport
    const knownRestaurants = [
      'McDonald\'s', 'KFC', 'Tim Hortons', 'Caffè Nero', 'Spice Kitchen',
      'Tickerdaze', 'Cakes&Bakes', 'Plenty', 'Noor', 'Luna'
    ];
    
    knownRestaurants.forEach(name => {
      if (text.includes(name)) {
        // Get context around the restaurant name
        const index = text.indexOf(name);
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(text.length, index + name.length + 100);
        const context = text.substring(contextStart, contextEnd).trim();
        
        restaurants.push({
          name: name,
          description: context.replace(name, '').trim()
        });
      }
    });
    
    return restaurants;
  }
  
  private cleanAndFormatAnswer(answer: string): string {
    // Clean HTML entities and improve formatting
    let cleaned = answer
      .replace(/&amp;/g, '&')
      .replace(/&egrave;/g, 'è')
      .replace(/&eacute;/g, 'é')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove navigation/footer content
    cleaned = cleaned.replace(/SHOP&DINE.*$/i, '').trim();
    cleaned = cleaned.replace(/Pre-order Service.*$/i, '').trim();
    
    return cleaned;
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