// AI Service for Oman Airports Chatbot
// Supports multiple AI providers with free tiers

import { prisma } from './database';

interface AIResponse {
  message: string;
  success: boolean;
  provider: string;
  processingTime: number;
  knowledgeBaseUsed?: boolean;
  sources?: string[];
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
  relevanceScore?: number;
}

export class AIService {
  private static instance: AIService;
  private providers: AIProvider[] = [];

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
        model: 'gemini-2.0-flash', // Latest free model
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

  // Enhanced knowledge base search
  async searchKnowledgeBase(query: string): Promise<KnowledgeEntry[]> {
    try {
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 10); // Limit to 10 keywords for performance

      if (keywords.length === 0) return [];

      // Search in knowledge base
      const entries = await prisma.knowledgeBase.findMany({
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
          sourceUrl: true
        }
      });

      // Calculate relevance scores
      const scoredEntries = entries.map(entry => {
        const combinedText = `${entry.question} ${entry.answer} ${entry.category}`.toLowerCase();
        
        let score = 0;
        keywords.forEach(keyword => {
          const matches = (combinedText.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
          
          // Bonus for exact phrase matches
          if (combinedText.includes(keyword)) {
            score += 2;
          }
          
          // Bonus for question title matches
          if (entry.question.toLowerCase().includes(keyword)) {
            score += 3;
          }
        });

        return {
          ...entry,
          relevanceScore: score
        };
      });

      // Filter and sort by relevance
      return scoredEntries
        .filter(entry => entry.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3); // Top 3 most relevant entries

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

    // Combine contexts
    const fullContext = context + knowledgeContext;

    // Try each provider in order
    for (const provider of this.providers) {
      try {
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
        return {
          message: response,
          success: true,
          provider: provider.name,
          processingTime,
          knowledgeBaseUsed: knowledgeEntries.length > 0,
          sources: [...new Set(sources)] // Remove duplicates
        };

      } catch (error) {
        console.log(`${provider.name} failed:`, error);
        continue;
      }
    }

    // Fallback to knowledge base if AI providers fail
    if (knowledgeEntries.length > 0) {
      const processingTime = Date.now() - startTime;
      return {
        message: knowledgeEntries[0].answer,
        success: true,
        provider: 'knowledge-base',
        processingTime,
        knowledgeBaseUsed: true,
        sources: [...new Set(sources)]
      };
    }

    // Final fallback response if all providers fail
    const processingTime = Date.now() - startTime;
    return {
      message: this.getFallbackResponse(message),
      success: false,
      provider: 'fallback',
      processingTime,
      knowledgeBaseUsed: false,
      sources: []
    };
  }

  private async callGemini(message: string, context: string, provider: AIProvider): Promise<string> {
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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
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

  private buildPrompt(message: string, context: string): string {
    const systemPrompt = `You are a helpful AI assistant for Oman Airports. You provide accurate, specific information about:
- Flight schedules and status
- Airport services and facilities  
- Transportation options (taxis, buses, car rentals)
- Parking information and rates
- Airport policies and procedures
- Baggage handling and security
- Dining and shopping options

IMPORTANT: If specific information is provided in the knowledge base context below, use that exact information in your response. Include specific details like prices, zones, rates, and contact information when available.

Keep responses concise but informative. Always prioritize accuracy over general guidance.`;

    if (context) {
      return `${systemPrompt}\n\nContext: ${context}\n\nUser Question: ${message}\n\nResponse:`;
    }
    
    return `${systemPrompt}\n\nUser Question: ${message}\n\nResponse:`;
  }

  private getFallbackResponse(message: string): string {
    // Intelligent fallback responses based on query type
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('flight') || lowerMessage.includes('departure') || lowerMessage.includes('arrival')) {
      return "For the most up-to-date flight information, please check the flight information displays at the airport or visit our website at omanairports.co.om. You can also contact our information desk for assistance.";
    }
    
    if (lowerMessage.includes('parking') || lowerMessage.includes('car')) {
      return "Parking is available at all Oman Airports terminals. For current rates and availability, please visit omanairports.co.om or contact our customer service team at the airport.";
    }
    
    if (lowerMessage.includes('taxi') || lowerMessage.includes('transport') || lowerMessage.includes('bus')) {
      return "Transportation options are available at all airport terminals including taxis, buses, and car rentals. For detailed information and current schedules, please visit the ground transportation area or check with airport information.";
    }
    
    if (lowerMessage.includes('baggage') || lowerMessage.includes('luggage')) {
      return "For baggage services and policies, please contact your airline directly or visit the baggage services counter at the terminal. Each airline has specific baggage allowances and procedures.";
    }
    
    // Default fallback
    const fallbackResponses = [
      "Thank you for contacting Oman Airports. For immediate assistance, please visit our information desk at the terminal or check our website at omanairports.co.om for the latest information.",
      "I'm currently unable to process your request. Please contact our customer service team at the airport or visit omanairports.co.om for comprehensive information about our services.",
      "For the most accurate and up-to-date information, please visit our website at omanairports.co.om or speak with our airport staff who will be happy to assist you.",
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
}

export const aiService = AIService.getInstance(); 