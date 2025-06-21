Oman Airports AI Chatbot - Technical Documentation
Table of Contents
Project Overview
System Architecture
Technology Stack
Database Design
API Design
Frontend Implementation
AI Integration
Web Scraping System
Flight Information System
Security Implementation
Deployment Strategy
Performance Optimization
Monitoring and Logging
Testing Strategy
Maintenance and Support
Project Overview
Purpose
The Oman Airports AI Chatbot is a standalone, intelligent chatbot application designed to provide comprehensive information and support to visitors of Oman Airports. The system integrates multiple data sources, real-time flight information, and AI-powered responses to deliver accurate and helpful information.
Key Objectives
Provide 24/7 automated support for airport visitors
Integrate real-time flight information and status updates
Aggregate information from multiple official sources
Support both Arabic and English languages
Enable seamless handoff to human agents when needed
Maintain high performance and reliability standards
Target Users
Airport visitors and passengers
Airlines and ground staff
Airport management and support teams
System administrators and content managers
System Architecture
High-Level Architecture



```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                          │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Chat Widget   │    │   Admin Panel   │                │
│  │   (Vanilla JS)  │    │   (Next.js)     │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                               │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Chat API      │    │   Admin API     │                │
│  │   (Next.js)     │    │   (Next.js)     │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                            │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   AI Service    │    │   Scraper       │                │
│  │   (Ollama)      │    │   Service       │                │
│  └─────────────────┘    └─────────────────┘                │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Flight API    │    │   Cache         │                │
│  │   Service       │    │   Service       │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                               │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   PostgreSQL    │    │   Redis         │                │
│  │   (Primary DB)  │    │   (Cache)       │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### **Component Architecture**
```
<code_block_to_apply_changes_from>
```

---

## **Technology Stack**

### **Backend Technologies**
- **Framework**: Next.js 14+ with TypeScript
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5+
- **Cache**: Redis 7+
- **AI Engine**: Ollama (Local AI Models)
- **Web Scraping**: Puppeteer + Cheerio
- **Real-time**: Socket.io
- **Authentication**: JWT + bcrypt
- **Validation**: Zod
- **Testing**: Jest + Playwright

### **Frontend Technologies**
- **Widget**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS Variables
- **Build Tool**: Vite (for widget)
- **Package Manager**: npm/yarn
- **Linting**: ESLint + Prettier

### **Infrastructure**
- **Hosting**: Vercel (Application) + Supabase (Database)
- **CDN**: Cloudflare
- **Monitoring**: Sentry + LogRocket
- **CI/CD**: GitHub Actions
- **Containerization**: Docker

### **External APIs**
- **Flight Data**: AviationStack, FlightAware, AeroDataBox
- **News**: NewsAPI, GNews
- **Maps**: Google Maps API
- **Translation**: Google Translate API

---

## **Database Design**

### **Database Schema**

#### **Core Tables**

```sql
-- Chat Sessions
CREATE TABLE chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL,
    user_ip INET,
    user_agent TEXT,
    language VARCHAR(2) DEFAULT 'en',
    status VARCHAR(20) DEFAULT 'active',
    website_user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    message_type VARCHAR(10) NOT NULL CHECK (message_type IN ('user', 'bot', 'agent')),
    content TEXT NOT NULL,
    intent VARCHAR(255),
    confidence DECIMAL(3,2),
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

-- Knowledge Base
CREATE TABLE knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords JSONB,
    language VARCHAR(2) DEFAULT 'en',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flight Cache
CREATE TABLE flight_cache (
    id BIGSERIAL PRIMARY KEY,
    flight_number VARCHAR(20) NOT NULL,
    flight_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback Forms
CREATE TABLE feedback_forms (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    subject VARCHAR(255),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support Agents
CREATE TABLE support_agents (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    current_session_id UUID,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web Scraping Cache
CREATE TABLE scraping_cache (
    id BIGSERIAL PRIMARY KEY,
    source_url VARCHAR(500) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    scraped_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics
CREATE TABLE chat_analytics (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Indexes**
```sql
-- Performance indexes
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_flight_cache_number ON flight_cache(flight_number);
CREATE INDEX idx_flight_cache_expires ON flight_cache(expires_at);
CREATE INDEX idx_knowledge_base_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX idx_scraping_cache_url ON scraping_cache(source_url);
CREATE INDEX idx_scraping_cache_expires ON scraping_cache(expires_at);
CREATE UNIQUE INDEX idx_chat_analytics_date ON chat_analytics(date);
```

### **Prisma Schema**
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ChatSession {
  id            String   @id @default(cuid())
  sessionId     String   @unique @map("session_id")
  userIp        String?  @map("user_ip")
  userAgent     String?  @map("user_agent")
  language      String   @default("en")
  status        String   @default("active")
  websiteUserId String?  @map("website_user_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  messages ChatMessage[]
  feedback FeedbackForm?

  @@map("chat_sessions")
}

model ChatMessage {
  id             String   @id @default(cuid())
  sessionId      String   @map("session_id")
  messageType    String   @map("message_type")
  content        String
  intent         String?
  confidence     Float?
  responseTimeMs Int?     @map("response_time_ms")
  createdAt      DateTime @default(now()) @map("created_at")

  session ChatSession @relation(fields: [sessionId], references: [sessionId], onDelete: Cascade)

  @@map("chat_messages")
}

model KnowledgeBase {
  id         String   @id @default(cuid())
  category   String
  subcategory String?
  question   String
  answer     String
  keywords   Json?
  language   String   @default("en")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("knowledge_base")
}

model FlightCache {
  id           String   @id @default(cuid())
  flightNumber String   @unique @map("flight_number")
  flightData   Json     @map("flight_data")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("flight_cache")
}

model FeedbackForm {
  id        String   @id @default(cuid())
  sessionId String?  @map("session_id")
  name      String?
  email     String?
  phone     String?
  subject   String?
  message   String?
  status    String   @default("pending")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  session ChatSession? @relation(fields: [sessionId], references: [sessionId])

  @@map("feedback_forms")
}

model SupportAgent {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  isOnline         Boolean   @default(false) @map("is_online")
  currentSessionId String?   @map("current_session_id")
  lastActivity     DateTime? @map("last_activity")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@map("support_agents")
}

model ScrapingCache {
  id          String   @id @default(cuid())
  sourceUrl   String   @map("source_url")
  contentHash String   @map("content_hash")
  scrapedData Json     @map("scraped_data")
  expiresAt   DateTime @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("scraping_cache")
}

model ChatAnalytics {
  id                String   @id @default(cuid())
  date              DateTime @unique
  totalSessions     Int      @default(0) @map("total_sessions")
  totalMessages     Int      @default(0) @map("total_messages")
  avgResponseTimeMs Int?     @map("avg_response_time_ms")
  satisfactionScore Float?   @map("satisfaction_score")
  createdAt         DateTime @default(now()) @map("created_at")

  @@map("chat_analytics")
}
```

---

## **API Design**

### **API Endpoints**

#### **Chat API**
```typescript
// POST /api/chat/send
interface SendMessageRequest {
  message: string;
  sessionId?: string;
  language?: string;
}

interface SendMessageResponse {
  success: boolean;
  response: string;
  sessionId: string;
  responseTime: number;
  confidence?: number;
  sources?: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;
}

// POST /api/chat/session
interface CreateSessionRequest {
  language?: string;
  userAgent?: string;
  userIp?: string;
}

interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  createdAt: string;
}

// GET /api/chat/history/:sessionId
interface ChatHistoryResponse {
  success: boolean;
  messages: Array<{
    id: string;
    type: 'user' | 'bot' | 'agent';
    content: string;
    timestamp: string;
  }>;
}
```

#### **Flight API**
```typescript
// GET /api/flight/:flightNumber
interface FlightInfoResponse {
  success: boolean;
  flight: {
    number: string;
    status: 'scheduled' | 'boarding' | 'departed' | 'arrived' | 'delayed' | 'cancelled';
    departure: {
      airport: string;
      terminal: string;
      gate: string;
      scheduled: string;
      actual?: string;
    };
    arrival: {
      airport: string;
      terminal: string;
      gate: string;
      scheduled: string;
      actual?: string;
    };
    airline: {
      name: string;
      code: string;
    };
    aircraft: {
      type: string;
      registration: string;
    };
  };
  lastUpdated: string;
}

// GET /api/flight/search
interface FlightSearchRequest {
  origin?: string;
  destination?: string;
  date?: string;
  airline?: string;
}

interface FlightSearchResponse {
  success: boolean;
  flights: Array<FlightInfo>;
  total: number;
}
```

#### **Admin API**
```typescript
// GET /api/admin/analytics
interface AnalyticsResponse {
  success: boolean;
  data: {
    totalSessions: number;
    totalMessages: number;
    avgResponseTime: number;
    satisfactionScore: number;
    popularQueries: Array<{
      query: string;
      count: number;
    }>;
    dailyStats: Array<{
      date: string;
      sessions: number;
      messages: number;
    }>;
  };
}

// POST /api/admin/knowledge
interface KnowledgeBaseRequest {
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords?: string[];
  language?: string;
  isActive?: boolean;
}

// GET /api/admin/sessions
interface SessionsResponse {
  success: boolean;
  sessions: Array<{
    id: string;
    sessionId: string;
    status: string;
    messageCount: number;
    createdAt: string;
    lastActivity: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

### **API Authentication**
```typescript
// JWT Token Structure
interface JWTPayload {
  userId: string;
  role: 'admin' | 'agent' | 'user';
  sessionId?: string;
  exp: number;
  iat: number;
}

// API Rate Limiting
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
};
```

### **Error Handling**
```typescript
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

// Error Codes
enum ErrorCodes {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  FLIGHT_NOT_FOUND = 'FLIGHT_NOT_FOUND',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
}
```

---

## **Frontend Implementation**

### **Widget Architecture**
```javascript
// Widget Class Structure
class OmanAirportsChatWidget {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://chatbot.omanairports.co.om/api',
      theme: config.theme || 'light',
      language: config.language || 'en',
      position: config.position || 'bottom-right',
      ...config
    };
    
    this.sessionId = null;
    this.isOpen = false;
    this.isTyping = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.init();
  }

  async init() {
    await this.loadStyles();
    this.createWidget();
    this.createChatButton();
    this.bindEvents();
    await this.createSession();
    this.initWebSocket();
  }

  // Widget creation and styling
  createWidget() {
    const widget = document.createElement('div');
    widget.id = 'omanairports-chat-widget';
    widget.className = `chat-widget chat-widget--${this.config.theme} chat-widget--${this.config.position}`;
    
    widget.innerHTML = this.getWidgetHTML();
    document.body.appendChild(widget);
  }

  // Event handling
  bindEvents() {
    // Toggle events
    document.getElementById('omanairports-chat-button')?.addEventListener('click', () => {
      this.toggleChat();
    });

    document.getElementById('chat-widget-close')?.addEventListener('click', () => {
      this.toggleChat();
    });

    // Message sending
    document.getElementById('chat-widget-send')?.addEventListener('click', () => {
      this.sendMessage();
    });

    document.getElementById('chat-widget-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleChat();
      }
    });
  }

  // Message handling
  async sendMessage() {
    const input = document.getElementById('chat-widget-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message
    this.addMessage('user', message);
    input.value = '';

    // Show typing indicator
    this.showTyping();

    try {
      const response = await this.apiCall('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
        })
      });

      if (response.success) {
        this.hideTyping();
        this.addMessage('bot', response.response);
        
        // Add sources if available
        if (response.sources && response.sources.length > 0) {
          this.addSources(response.sources);
        }
      } else {
        throw new Error(response.error?.message || 'Failed to send message');
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.hideTyping();
      this.addMessage('bot', 'Sorry, I encountered an error. Please try again.');
    }
  }

  // API communication
  async apiCall(endpoint, options = {}) {
    const url = `${this.config.apiUrl}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Version': '1.0.0',
      },
      ...options
    };

    try {
      const response = await fetch(url, defaultOptions);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // WebSocket for real-time features
  initWebSocket() {
    this.ws = new WebSocket(`${this.config.apiUrl.replace('https', 'wss')}/ws`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'typing':
        this.showTyping();
        break;
      case 'message':
        this.hideTyping();
        this.addMessage('bot', data.content);
        break;
      case 'agent_available':
        this.showAgentAvailable();
        break;
      case 'session_transfer':
        this.handleSessionTransfer(data);
        break;
    }
  }
}
```

### **Widget Styling**
```css
/* Base Widget Styles */
.chat-widget {
  position: fixed;
  z-index: 9999;
  width: 350px;
  height: 500px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.chat-widget--open {
  transform: translateY(0);
  opacity: 1;
}

/* Position Variants */
.chat-widget--bottom-right {
  bottom: 20px;
  right: 20px;
}

.chat-widget--bottom-left {
  bottom: 20px;
  left: 20px;
}

.chat-widget--top-right {
  top: 20px;
  right: 20px;
}

.chat-widget--top-left {
  top: 20px;
  left: 20px;
}

/* Header Styles */
.chat-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1e3a8a, #3b82f6);
  color: white;
  border-radius: 12px 12px 0 0;
  min-height: 60px;
}

.chat-widget__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.chat-widget__logo {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
}

.chat-widget__close {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-widget__close:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Body Styles */
.chat-widget__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-widget__messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

/* Message Styles */
.chat-message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  animation: messageSlideIn 0.3s ease-out;
}

.chat-message--user {
  align-self: flex-end;
}

.chat-message--bot {
  align-self: flex-start;
}

.chat-message--agent {
  align-self: flex-start;
  border-left: 3px solid #10b981;
}

.chat-message__content {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.chat-message--user .chat-message__content {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-message--bot .chat-message__content {
  background: #f3f4f6;
  color: #374151;
  border-bottom-left-radius: 4px;
}

.chat-message--agent .chat-message__content {
  background: #ecfdf5;
  color: #065f46;
  border-bottom-left-radius: 4px;
}

.chat-message__time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  align-self: flex-end;
}

/* Input Styles */
.chat-widget__input-container {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.chat-widget__input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: none;
  min-height: 20px;
  max-height: 100px;
}

.chat-widget__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.chat-widget__send {
  width: 40px;
  height: 40px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
  flex-shrink: 0;
}

.chat-widget__send:hover {
  background: #2563eb;
  transform: scale(1.05);
}

.chat-widget__send:active {
  transform: scale(0.95);
}

/* Chat Button */
.chat-button {
  position: fixed;
  z-index: 9998;
  width: 60px;
  height: 60px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: buttonPulse 2s infinite;
}

.chat-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(59, 130, 246, 0.4);
}

.chat-button--bottom-right {
  bottom: 20px;
  right: 20px;
}

.chat-button--bottom-left {
  bottom: 20px;
  left: 20px;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 12px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes buttonPulse {
  0% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
}

/* Dark Theme */
.chat-widget--dark {
  background: #1f2937;
  color: white;
}

.chat-widget--dark .chat-message--bot .chat-message__content {
  background: #374151;
  color: #f9fafb;
}

.chat-widget--dark .chat-widget__input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.chat-widget--dark .chat-widget__input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
}

/* Responsive Design */
@media (max-width: 480px) {
  .chat-widget {
    width: calc(100vw - 40px);
    height: calc(100vh - 40px);
    max-width: 400px;
    max-height: 600px;
  }
  
  .chat-button {
    width: 50px;
    height: 50px;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .chat-widget,
  .chat-button,
  .chat-message {
    animation: none;
    transition: none;
  }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  .chat-widget {
    border: 2px solid #000;
  }
  
  .chat-message__content {
    border: 1px solid #000;
  }
}
```

---

## **AI Integration**

### **Ollama Service Implementation**
```typescript
// src/lib/ollama.ts
import axios, { AxiosInstance } from 'axios';

export interface OllamaConfig {
  host: string;
  model: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  topP: number;
}

export interface OllamaResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export class OllamaService {
  private client: AxiosInstance;
  private config: OllamaConfig;
  private isAvailable: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OllamaConfig>) {
    this.config = {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama2',
      timeout: 30000,
      maxTokens: 500,
      temperature: 0.7,
      topP: 0.9,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.host,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.startHealthCheck();
  }

  async generateResponse(
    query: string, 
    context: string = '', 
    options: Partial<OllamaConfig> = {}
  ): Promise<string | null> {
    try {
      if (!this.isAvailable) {
        throw new Error('Ollama service is not available');
      }

      const prompt = this.buildPrompt(query, context);
      const requestConfig = { ...this.config, ...options };

      const response = await this.client.post<OllamaResponse>('/api/generate', {
        model: requestConfig.model,
        prompt,
        stream: false,
        options: {
          temperature: requestConfig.temperature,
          top_p: requestConfig.topP,
          num_predict: requestConfig.maxTokens,
        }
      });

      return response.data.response;

    } catch (error) {
      console.error('Ollama generation error:', error);
      this.isAvailable = false;
      return null;
    }
  }

  async generateStreamingResponse(
    query: string,
    context: string = '',
    onChunk: (chunk: string) => void,
    options: Partial<OllamaConfig> = {}
  ): Promise<void> {
    try {
      if (!this.isAvailable) {
        throw new Error('Ollama service is not available');
      }

      const prompt = this.buildPrompt(query, context);
      const requestConfig = { ...this.config, ...options };

      const response = await this.client.post('/api/generate', {
        model: requestConfig.model,
        prompt,
        stream: true,
        options: {
          temperature: requestConfig.temperature,
          top_p: requestConfig.topP,
          num_predict: requestConfig.maxTokens,
        }
      }, {
        responseType: 'stream'
      });

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                onChunk(data.response);
              }
            } catch (e) {
              // Ignore parsing errors for incomplete JSON
            }
          }
        }
      });

    } catch (error) {
      console.error('Ollama streaming error:', error);
      this.isAvailable = false;
    }
  }

  private buildPrompt(query: string, context: string = ''): string {
    const basePrompt = `You are an AI assistant for Oman Airports (omanairports.co.om). 
You help visitors with information about flights, facilities, services, and general airport information.

Your responses should be:
- Helpful and accurate
- Concise but informative
- Professional and friendly
- In the same language as the user's query
- Based on official information when available

${context ? `Context from previous conversation: ${context}\n\n` : ''}
Visitor Question: ${query}

Please provide a helpful response:`;

    return basePrompt;
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      this.isAvailable = true;
      return true;
    } catch (error) {
      this.isAvailable = false;
      return false;
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAvailability();
    }, 30000); // Check every 30 seconds
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models.map((model: any) => model.name);
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  async switchModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.getAvailableModels();
      if (models.includes(modelName)) {
        this.config.model = modelName;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to switch model:', error);
      return false;
    }
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
```

### **AI Response Processing**
```typescript
// src/lib/ai-processor.ts
import { OllamaService } from './ollama';
import { WebScraperService } from './web-scraper';
import { FlightService } from './flight-service';
import { KnowledgeBaseService } from './knowledge-base';

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
}

export class AIProcessor {
  private ollama: OllamaService;
  private scraper: WebScraperService;
  private flightService: FlightService;
  private knowledgeBase: KnowledgeBaseService;

  constructor() {
    this.ollama = new OllamaService();
    this.scraper = new WebScraperService();
    this.flightService = new FlightService();
    this.knowledgeBase = new KnowledgeBaseService();
  }

  async processQuery(
    query: string, 
    sessionId: string, 
    context: string = ''
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Check knowledge base
      const kbResult = await this.knowledgeBase.search(query);
      if (kbResult && kbResult.confidence > 0.8) {
        return {
          content: kbResult.answer,
          confidence: kbResult.confidence,
          sources: [],
          intent: 'knowledge_base',
          requiresHuman: false,
          suggestedActions: []
        };
      }

      // Step 2: Check for flight queries
      const flightInfo = this.extractFlightInfo(query);
      if (flightInfo) {
        const flightData = await this.flightService.getFlightInfo(flightInfo.flightNumber);
        if (flightData) {
          return {
            content: this.formatFlightResponse(flightData),
            confidence: 0.9,
            sources: [{
              title: 'Flight Information',
              url: flightData.sourceUrl,
              relevance: 0.9
            }],
            intent: 'flight_inquiry',
            requiresHuman: false,
            suggestedActions: ['track_flight', 'view_schedule']
          };
        }
      }

      // Step 3: Search web sources
      const webResults = await this.scraper.searchAcrossSources(query);
      let aiContext = '';
      let sources: Array<{title: string, url: string, relevance: number}> = [];

      if (webResults.length > 0) {
        aiContext = this.buildContextFromSources(webResults);
        sources = webResults.slice(0, 3).map(result => ({
          title: result.title,
          url: result.url,
          relevance: result.relevance
        }));
      }

      // Step 4: Generate AI response
      const aiResponse = await this.ollama.generateResponse(query, aiContext + context);
      
      if (aiResponse) {
        const confidence = this.calculateConfidence(query, aiResponse, webResults);
        const intent = this.detectIntent(query);
        const requiresHuman = this.shouldEscalateToHuman(query, confidence);

        return {
          content: aiResponse,
          confidence,
          sources,
          intent,
          requiresHuman,
          suggestedActions: this.generateSuggestedActions(intent, query)
        };
      }

      // Step 5: Fallback response
      return {
        content: this.getFallbackResponse(query),
        confidence: 0.3,
        sources: [],
        intent: 'unknown',
        requiresHuman: true,
        suggestedActions: ['contact_support', 'feedback_form']
      };

    } catch (error) {
      console.error('AI processing error:', error);
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact our support team.',
        confidence: 0.1,
        sources: [],
        intent: 'error',
        requiresHuman: true,
        suggestedActions: ['contact_support']
      };
    } finally {
      const processingTime = Date.now() - startTime;
      console.log(`Query processed in ${processingTime}ms`);
    }
  }

  private extractFlightInfo(query: string): { flightNumber: string } | null {
    // Extract flight numbers (e.g., WY123, OV456, XY789)
    const flightPattern = /\b([A-Z]{2}\d{3,4})\b/;
    const match = query.toUpperCase().match(flightPattern);
    
    if (match) {
      return { flightNumber: match[1] };
    }
    
    return null;
  }

  private formatFlightResponse(flightData: any): string {
    const status = flightData.status;
    const airline = flightData.airline?.name || 'Unknown';
    const flightNumber = flightData.flightNumber;
    
    let response = `Flight ${flightNumber} (${airline}): ${status}\n\n`;
    
    if (flightData.departure) {
      response += `Departure: ${flightData.departure.airport} - Terminal ${flightData.departure.terminal}`;
      if (flightData.departure.gate) {
        response += `, Gate ${flightData.dep
</message_from_colleague>

<code_block_to_apply_changes_from>
```
</code_block_to_apply_changes_from>
</rewritten_file>