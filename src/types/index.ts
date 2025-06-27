export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'bot';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  sessionId: string;
  messages: ChatMessage[];
  createdAt: Date;
}

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  subcategory?: string;
  priority?: number;
  sourceUrl?: string;
  dataSource: 'manual' | 'scraping' | 'import';
  lastUpdated: string;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
} 