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
}

interface ScoredKnowledgeEntry extends KnowledgeEntry {
  relevanceScore: number;
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
        model: 'gemini-1.5-flash', // More stable free model with higher quota
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
  async searchKnowledgeBase(query: string): Promise<ScoredKnowledgeEntry[]> {
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
      const scoredEntries: ScoredKnowledgeEntry[] = entries.map(entry => {
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
        } as ScoredKnowledgeEntry;
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
        return {
          message: this.formatResponse(response),
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

  // Format AI responses for better readability
  private formatResponse(response: string): string {
    let formatted = response.trim();
    
    // Step 1: Clean up and normalize the text
    formatted = formatted.replace(/\s+/g, ' '); // Remove extra spaces
    
    // Step 2: Add emojis to key terms
    if (!formatted.includes('🚗')) {
      formatted = formatted.replace(/\b(car rental|rent[- ]a[- ]car|rental car)\b/gi, '🚗 car rental');
    }
    if (!formatted.includes('🅿️')) {
      formatted = formatted.replace(/\bparking\b/gi, '🅿️ parking');
    }
    if (!formatted.includes('✈️')) {
      formatted = formatted.replace(/\bairport\b/gi, '✈️ airport');
    }
    if (!formatted.includes('💰')) {
      formatted = formatted.replace(/\bOMR\b/g, '💰 OMR');
    }
    
    // Step 3: Structure the content with proper sections
    // Find and format section headers (words ending with colon)
    formatted = formatted.replace(/\b([A-Z][^.]*?):\s*([^.]*\.)/g, '\n\n**$1:**\n• $2');
    
    // Step 4: Convert lists to proper bullet points
    // Handle company names in lists
    const companies = ['Avis', 'Hertz', 'Budget', 'Europcar', 'Sixt', 'Mark Rent a Car', 'Fast Rent a Car', 'United Car Rental'];
    companies.forEach(company => {
      const regex = new RegExp(`\\b${company}\\b`, 'g');
      formatted = formatted.replace(regex, `\n• **${company}**`);
    });
    
    // Step 5: Clean up formatting artifacts
    formatted = formatted.replace(/\*\*\*+/g, '**'); // Fix triple asterisks
    formatted = formatted.replace(/([.!?])\s*\n*\s*•/g, '$1\n\n•'); // Proper spacing before bullets
    formatted = formatted.replace(/•\s*\*\*/g, '• **'); // Fix bullet + bold formatting
    formatted = formatted.replace(/\*\*\s*•/g, '**\n• '); // Fix bold + bullet formatting
    
    // Step 6: Improve readability with proper line breaks
    formatted = formatted.replace(/\.\s*([A-Z])/g, '.\n\n$1'); // Break after sentences
    formatted = formatted.replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks
    formatted = formatted.replace(/^\s*\n+/, ''); // Remove leading breaks
    
    // Step 7: Final cleanup
    formatted = formatted.trim();
    
    return formatted;
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

FORMATTING GUIDELINES:
- Use clear bullet points (•) for lists
- Add line breaks between sections
- Use emojis sparingly for better visual appeal (🚗 for cars, 🅿️ for parking, ✈️ for flights, 💰 for prices)
- Structure information logically with headers when appropriate
- Keep paragraphs short and scannable
- Use bold formatting (**text**) for important information like prices and key details

IMPORTANT: If specific information is provided in the knowledge base context below, use that exact information in your response. Include specific details like prices, zones, rates, and contact information when available.

Format your response to be easy to read and scan quickly. Always prioritize accuracy over general guidance.`;

    if (context) {
      return `${systemPrompt}\n\nContext: ${context}\n\nUser Question: ${message}\n\nResponse:`;
    }
    
    return `${systemPrompt}\n\nUser Question: ${message}\n\nResponse:`;
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

        quotaRecord = await prisma.apiQuota.create({
          data: {
            provider,
            date: today,
            dailyLimit: provider === 'gemini' ? 1500 : 1000, // Gemini free tier: 1500/day
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

  // Get current quota status
  async getQuotaStatus(provider: string): Promise<{
    dailyLimit: number;
    usedCount: number;
    remainingCount: number;
    resetAt: Date;
    percentageUsed: number;
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

      if (!quotaRecord) {
        // Return default values if no record exists
        const resetAt = new Date(today);
        resetAt.setDate(resetAt.getDate() + 1);
        
        return {
          dailyLimit: provider === 'gemini' ? 1500 : 1000,
          usedCount: 0,
          remainingCount: provider === 'gemini' ? 1500 : 1000,
          resetAt,
          percentageUsed: 0
        };
      }

      const remainingCount = quotaRecord.dailyLimit - quotaRecord.usedCount;
      const percentageUsed = Math.round((quotaRecord.usedCount / quotaRecord.dailyLimit) * 100);

      return {
        dailyLimit: quotaRecord.dailyLimit,
        usedCount: quotaRecord.usedCount,
        remainingCount: Math.max(0, remainingCount),
        resetAt: quotaRecord.resetAt,
        percentageUsed
      };
    } catch (error) {
      console.error('Error getting quota status:', error);
      return null;
    }
  }

  // Get all providers quota status
  async getAllQuotaStatus(): Promise<{ [provider: string]: any }> {
    const providers = ['gemini', 'huggingface'];
    const quotaStatus: { [provider: string]: any } = {};

    for (const provider of providers) {
      quotaStatus[provider] = await this.getQuotaStatus(provider);
    }

    return quotaStatus;
  }
}

export const aiService = AIService.getInstance(); 