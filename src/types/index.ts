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

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
} 