import { prisma } from './database';

export interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  confidence: number;
  relevance: number;
}

export class KnowledgeBaseService {
  async getBestMatch(query: string, language: string = 'en'): Promise<KnowledgeMatch | null> {
    try {
      return await this.searchDatabase(query, language);
    } catch (error) {
      console.warn('Database search failed:', error);
      return this.getFallbackResponse(query);
    }
  }

  private async searchDatabase(query: string, language: string): Promise<KnowledgeMatch | null> {
    const lowerQuery = query.toLowerCase();
    
    const entries = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: lowerQuery, mode: 'insensitive' } },
          { answer: { contains: lowerQuery, mode: 'insensitive' } },
          { keywords: { hasSome: lowerQuery.split(' ') } }
        ]
      },
      orderBy: { priority: 'desc' }
    });

    if (entries.length === 0) return null;

    const matches = entries.map(entry => ({
      entry: {
        id: entry.id,
        category: entry.category,
        subcategory: entry.subcategory || undefined,
        question: entry.question,
        answer: entry.answer,
        keywords: entry.keywords,
        priority: entry.priority,
        isActive: entry.isActive
      },
      confidence: this.calculateConfidence(query, entry),
      relevance: this.calculateRelevance(query, entry)
    }));

    return matches.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private getFallbackResponse(query: string): KnowledgeMatch | null {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('burj al sahwa') || lowerQuery.includes('directions')) {
      return {
        entry: {
          id: 'fallback-directions',
          category: 'transportation',
          subcategory: 'directions',
          question: 'How to get to the airport?',
          answer: `🗺️ **Directions from Burj Al Sahwa Roundabout to Muscat Airport:**

**Route:** Take Sultan Qaboos Highway (Highway 1) eastbound towards Seeb
**Distance:** Approximately 12-15 km
**Travel Time:** 15-20 minutes (depending on traffic)

**Detailed Directions:**
1. From Burj Al Sahwa roundabout, head northeast toward Sultan Qaboos Highway
2. Merge onto Sultan Qaboos Highway (Highway 1) heading towards Seeb
3. Continue on Highway 1 for approximately 12 km
4. Take the exit for Muscat International Airport (clearly signposted)
5. Follow the airport access road to the terminal building`,
          keywords: ['directions', 'route', 'drive', 'highway'],
          priority: 1,
          isActive: true
        },
        confidence: 0.9,
        relevance: 0.9
      };
    }

    return null;
  }

  private calculateConfidence(query: string, entry: any): number {
    const lowerQuery = query.toLowerCase();
    const lowerQuestion = entry.question.toLowerCase();
    
    let confidence = 0;
    
    if (lowerQuestion.includes(lowerQuery)) confidence += 0.5;
    
    const queryWords = lowerQuery.split(' ');
    const matchingKeywords = entry.keywords.filter((keyword: string) => 
      queryWords.some(word => keyword.toLowerCase().includes(word))
    );
    confidence += (matchingKeywords.length / entry.keywords.length) * 0.3;
    
    return Math.min(confidence, 1);
  }

  private calculateRelevance(query: string, entry: any): number {
    return this.calculateConfidence(query, entry);
  }
}
