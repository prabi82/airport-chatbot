import { prisma } from './database';

export interface KnowledgeBaseEntry {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  language: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  entry: KnowledgeBaseEntry;
  relevance: number;
  confidence: number;
}

export class KnowledgeBaseService {
  private cache: Map<string, KnowledgeBaseEntry[]> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async search(query: string, language: string = 'en', limit: number = 5): Promise<SearchResult[]> {
    await this.ensureCacheUpdated();
    
    const entries = this.cache.get(language) || [];
    const results: SearchResult[] = [];

    for (const entry of entries) {
      if (!entry.isActive) continue;

      const relevance = this.calculateRelevance(query, entry);
      if (relevance > 0.3) { // Minimum relevance threshold
        results.push({
          entry,
          relevance,
          confidence: this.calculateConfidence(relevance, entry)
        });
      }
    }

    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  async getBestMatch(query: string, language: string = 'en'): Promise<SearchResult | null> {
    const results = await this.search(query, language, 1);
    return results.length > 0 ? results[0] : null;
  }

  async getByCategory(category: string, language: string = 'en'): Promise<KnowledgeBaseEntry[]> {
    await this.ensureCacheUpdated();
    
    const entries = this.cache.get(language) || [];
    return entries.filter(entry => 
      entry.isActive && 
      entry.category.toLowerCase() === category.toLowerCase()
    );
  }

  async addEntry(entry: Omit<KnowledgeBaseEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeBaseEntry> {
    const created = await prisma.knowledgeBase.create({
      data: {
        category: entry.category,
        subcategory: entry.subcategory,
        question: entry.question,
        answer: entry.answer,
        keywords: entry.keywords,
        language: entry.language,
        isActive: entry.isActive
      }
    });

    // Clear cache to force refresh
    this.cache.clear();

    return {
      id: created.id,
      category: created.category,
      subcategory: created.subcategory || undefined,
      question: created.question,
      answer: created.answer,
      keywords: created.keywords as string[],
      language: created.language,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };
  }

  async updateEntry(id: string, updates: Partial<KnowledgeBaseEntry>): Promise<KnowledgeBaseEntry | null> {
    try {
      const updated = await prisma.knowledgeBase.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // Clear cache to force refresh
      this.cache.clear();

      return {
        id: updated.id,
        category: updated.category,
        subcategory: updated.subcategory || undefined,
        question: updated.question,
        answer: updated.answer,
        keywords: updated.keywords as string[],
        language: updated.language,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      };
    } catch (error) {
      console.error('Error updating knowledge base entry:', error);
      return null;
    }
  }

  async deleteEntry(id: string): Promise<boolean> {
    try {
      await prisma.knowledgeBase.delete({
        where: { id }
      });

      // Clear cache to force refresh
      this.cache.clear();
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base entry:', error);
      return false;
    }
  }

  async getCategories(language: string = 'en'): Promise<string[]> {
    await this.ensureCacheUpdated();
    
    const entries = this.cache.get(language) || [];
    const categories = new Set<string>();
    
    entries.forEach(entry => {
      if (entry.isActive) {
        categories.add(entry.category);
      }
    });

    return Array.from(categories).sort();
  }

  async getSubcategories(category: string, language: string = 'en'): Promise<string[]> {
    await this.ensureCacheUpdated();
    
    const entries = this.cache.get(language) || [];
    const subcategories = new Set<string>();
    
    entries.forEach(entry => {
      if (entry.isActive && 
          entry.category.toLowerCase() === category.toLowerCase() && 
          entry.subcategory) {
        subcategories.add(entry.subcategory);
      }
    });

    return Array.from(subcategories).sort();
  }

  private async ensureCacheUpdated(): Promise<void> {
    const now = new Date();
    if (now.getTime() - this.lastCacheUpdate.getTime() > this.cacheTimeout) {
      await this.updateCache();
    }
  }

  private async updateCache(): Promise<void> {
    try {
      const entries = await prisma.knowledgeBase.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      // Group by language
      const entriesByLanguage = new Map<string, KnowledgeBaseEntry[]>();
      
      entries.forEach((entry: any) => {
        const kbEntry: KnowledgeBaseEntry = {
          id: entry.id,
          category: entry.category,
          subcategory: entry.subcategory || undefined,
          question: entry.question,
          answer: entry.answer,
          keywords: entry.keywords as string[],
          language: entry.language,
          isActive: entry.isActive,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        };

        if (!entriesByLanguage.has(entry.language)) {
          entriesByLanguage.set(entry.language, []);
        }
        entriesByLanguage.get(entry.language)!.push(kbEntry);
      });

      this.cache = entriesByLanguage;
      this.lastCacheUpdate = new Date();
    } catch (error) {
      console.error('Error updating knowledge base cache:', error);
    }
  }

  private calculateRelevance(query: string, entry: KnowledgeBaseEntry): number {
    const queryLower = query.toLowerCase();
    const questionLower = entry.question.toLowerCase();
    const answerLower = entry.answer.toLowerCase();
    
    let score = 0;

    // Exact question match
    if (questionLower === queryLower) {
      return 1.0;
    }

    // Question contains query
    if (questionLower.includes(queryLower)) {
      score += 0.8;
    }

    // Query contains question words
    const questionWords = questionLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    
    let matchingWords = 0;
    questionWords.forEach(word => {
      if (word.length > 2 && queryWords.includes(word)) {
        matchingWords++;
      }
    });
    
    if (questionWords.length > 0) {
      score += (matchingWords / questionWords.length) * 0.6;
    }

    // Keyword matching
    if (entry.keywords && entry.keywords.length > 0) {
      let keywordMatches = 0;
      entry.keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      });
      
      if (keywordMatches > 0) {
        score += (keywordMatches / entry.keywords.length) * 0.4;
      }
    }

    // Answer contains query terms
    let answerMatches = 0;
    queryWords.forEach(word => {
      if (word.length > 2 && answerLower.includes(word)) {
        answerMatches++;
      }
    });
    
    if (queryWords.length > 0) {
      score += (answerMatches / queryWords.length) * 0.2;
    }

    // Category/subcategory matching
    if (entry.category && queryLower.includes(entry.category.toLowerCase())) {
      score += 0.3;
    }
    
    if (entry.subcategory && queryLower.includes(entry.subcategory.toLowerCase())) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private calculateConfidence(relevance: number, entry: KnowledgeBaseEntry): number {
    let confidence = relevance;

    // Boost confidence for entries with more keywords
    if (entry.keywords && entry.keywords.length > 0) {
      confidence += Math.min(entry.keywords.length * 0.05, 0.2);
    }

    // Boost confidence for more detailed answers
    if (entry.answer.length > 100) {
      confidence += 0.1;
    }

    // Boost confidence for recently updated entries
    const daysSinceUpdate = (Date.now() - entry.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  // Seed initial knowledge base with common airport questions
  async seedInitialData(): Promise<void> {
    const initialEntries = [
      {
        category: 'Flight Information',
        question: 'How do I check my flight status?',
        answer: 'You can check your flight status by providing your flight number (e.g., WY123) or by visiting the flight information displays throughout the airport.',
        keywords: ['flight status', 'check flight', 'flight information'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Airport Services',
        question: 'Where can I find WiFi at the airport?',
        answer: 'Free WiFi is available throughout all terminals. Connect to "OmanAirports_Free_WiFi" network and follow the instructions to get online.',
        keywords: ['wifi', 'internet', 'connection', 'free wifi'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Transportation',
        question: 'How do I get a taxi from the airport?',
        answer: 'Official airport taxis are available outside all terminals 24/7. You can also use ride-hailing apps like Careem and Uber.',
        keywords: ['taxi', 'transportation', 'careem', 'uber', 'ride'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Airport Services',
        question: 'Where are the prayer rooms located?',
        answer: 'Prayer rooms are available in all terminals. Look for the prayer room signs or ask at the information desk for directions.',
        keywords: ['prayer room', 'mosque', 'religious', 'prayer'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Baggage',
        question: 'What should I do if my baggage is lost?',
        answer: 'Report lost baggage immediately at the baggage claim area. Our staff will help you file a report and track your luggage.',
        keywords: ['lost baggage', 'missing luggage', 'baggage claim'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Security',
        question: 'What items are not allowed in carry-on luggage?',
        answer: 'Liquids over 100ml, sharp objects, and flammable items are not allowed in carry-on. Check the security guidelines for a complete list.',
        keywords: ['security', 'prohibited items', 'carry-on', 'banned items'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Check-in',
        question: 'When should I arrive at the airport for my flight?',
        answer: 'Arrive 2 hours early for domestic flights and 3 hours early for international flights to allow time for check-in and security.',
        keywords: ['check-in time', 'arrival time', 'how early'],
        language: 'en',
        isActive: true
      },
      {
        category: 'Airport Services',
        question: 'Are there restaurants and shops at the airport?',
        answer: 'Yes, all terminals have restaurants, cafes, duty-free shops, and retail stores offering local and international options.',
        keywords: ['restaurants', 'food', 'shops', 'duty free', 'dining'],
        language: 'en',
        isActive: true
      }
    ];

    for (const entry of initialEntries) {
      try {
        // Check if entry already exists
        const existing = await prisma.knowledgeBase.findFirst({
          where: {
            question: entry.question,
            language: entry.language
          }
        });

        if (!existing) {
          await this.addEntry(entry);
        }
      } catch (error) {
        console.error('Error seeding knowledge base entry:', error);
      }
    }
  }
} 