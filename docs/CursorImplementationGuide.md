# Oman Airports AI Chatbot - Cursor.ai Implementation Guide

## **PHASE 1: PROJECT SETUP**

### **Step 1.1: Create Next.js Project**
```bash
# Create new Next.js project
npx create-next-app@latest omanairports-chatbot --typescript --tailwind --app --src-dir --import-alias "@/*"

# Navigate to project
cd omanairports-chatbot

# Install dependencies
npm install @prisma/client prisma socket.io redis ollama axios zod
npm install -D @types/node @types/redis
```

### **Step 1.2: Environment Configuration**
Create `.env.local`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/omanairports_chatbot"

# Redis
REDIS_URL="redis://localhost:6379"

# Ollama
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama2"

# Flight APIs
AVIATIONSTACK_API_KEY="your_api_key"
AVIATIONSTACK_API_URL="http://api.aviationstack.com/v1"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WIDGET_URL="http://localhost:3000/widget"
```

### **Step 1.3: Database Schema**
Create `prisma/schema.prisma`:
```prisma
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

```bash
# Initialize Prisma
npx prisma generate
npx prisma migrate dev --name init
```

---

## **PHASE 2: CORE SERVICES**

### **Step 2.1: Database Service**
Create `src/lib/database.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### **Step 2.2: Redis Service**
Create `src/lib/redis.ts`:
```typescript
import Redis from 'redis';

const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

export { redisClient };
```

### **Step 2.3: Ollama Service**
Create `src/lib/ollama.ts`:
```typescript
import axios from 'axios';

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2';
  }

  async generateResponse(query: string, context: string = ''): Promise<string | null> {
    try {
      const prompt = this.buildPrompt(query, context);
      
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500,
        }
      }, {
        timeout: 30000,
      });

      return response.data.response;

    } catch (error) {
      console.error('Ollama error:', error);
      return null;
    }
  }

  private buildPrompt(query: string, context: string = ''): string {
    return `You are an AI assistant for Oman Airports (omanairports.co.om). 
You help visitors with information about flights, facilities, services, and general airport information.

${context ? `Context: ${context}\n\n` : ''}
Visitor Question: ${query}

Please provide a helpful, accurate, and concise response. If you don't have specific information, 
suggest contacting customer support or provide general guidance.

Response:`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
```

### **Step 2.4: Flight Service**
Create `src/lib/flight-service.ts`:
```typescript
import axios from 'axios';
import { prisma } from './database';

export class FlightService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.AVIATIONSTACK_API_KEY || '';
    this.baseUrl = process.env.AVIATIONSTACK_API_URL || 'http://api.aviationstack.com/v1';
  }

  async getFlightInfo(flightNumber: string) {
    // Check cache first
    const cached = await this.getCachedFlight(flightNumber);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const flightData = await this.fetchFromAPI(flightNumber);
    
    if (flightData) {
      await this.cacheFlight(flightNumber, flightData);
      return flightData;
    }

    return null;
  }

  private async getCachedFlight(flightNumber: string) {
    const cache = await prisma.flightCache.findFirst({
      where: {
        flightNumber,
        expiresAt: { gt: new Date() }
      }
    });

    return cache ? JSON.parse(cache.flightData as string) : null;
  }

  private async cacheFlight(flightNumber: string, data: any) {
    await prisma.flightCache.upsert({
      where: { flightNumber },
      update: {
        flightData: data,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      },
      create: {
        flightNumber,
        flightData: data,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
  }

  private async fetchFromAPI(flightNumber: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/flights`, {
        params: {
          access_key: this.apiKey,
          flight_iata: flightNumber
        },
        timeout: 10000
      });

      if (response.data && response.data.data && response.data.data[0]) {
        const flight = response.data.data[0];
        
        return {
          flightNumber,
          status: flight.flight_status || 'Unknown',
          departure: {
            airport: flight.departure?.airport || 'Unknown',
            terminal: flight.departure?.terminal || 'TBD',
            gate: flight.departure?.gate || 'TBD',
            scheduled: flight.departure?.scheduled || 'Unknown',
            actual: flight.departure?.actual || null
          },
          arrival: {
            airport: flight.arrival?.airport || 'Unknown',
            terminal: flight.arrival?.terminal || 'TBD',
            gate: flight.arrival?.gate || 'TBD',
            scheduled: flight.arrival?.scheduled || 'Unknown',
            actual: flight.arrival?.actual || null
          },
          airline: {
            name: flight.airline?.name || 'Unknown',
            code: flight.airline?.iata || 'Unknown'
          },
          aircraft: {
            type: flight.aircraft?.type || 'Unknown',
            registration: flight.aircraft?.registration || 'Unknown'
          },
          sourceUrl: `${this.baseUrl}/flights`
        };
      }

      return null;

    } catch (error) {
      console.error('Flight API error:', error);
      return null;
    }
  }
}
```

---

## **PHASE 3: API ROUTES**

### **Step 3.1: Chat Send API**
Create `src/app/api/chat/send/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { OllamaService } from '@/lib/ollama';
import { FlightService } from '@/lib/flight-service';
import { z } from 'zod';

const prismaClient = prisma;
const ollama = new OllamaService();
const flightService = new FlightService();

const messageSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = messageSchema.parse(body);

    const startTime = Date.now();

    // Get or create session
    const session = await getOrCreateSession(sessionId, request);

    // Store user message
    await storeMessage(session.sessionId, 'user', message);

    // Process message
    const response = await processMessage(message, session.sessionId);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Store bot response
    await storeMessage(session.sessionId, 'bot', response, null, responseTime);

    return NextResponse.json({
      success: true,
      response,
      sessionId: session.sessionId,
      responseTime
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getOrCreateSession(sessionId: string | undefined, request: NextRequest) {
  if (sessionId) {
    const existing = await prismaClient.chatSession.findUnique({
      where: { sessionId }
    });
    if (existing) return existing;
  }

  return await prismaClient.chatSession.create({
    data: {
      sessionId: crypto.randomUUID(),
      userIp: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
      language: request.headers.get('accept-language')?.split(',')[0] || 'en',
    }
  });
}

async function processMessage(message: string, sessionId: string) {
  // Check for flight number
  const flightInfo = extractFlightInfo(message);
  if (flightInfo) {
    const flightData = await flightService.getFlightInfo(flightInfo.flightNumber);
    if (flightData) {
      return formatFlightResponse(flightData);
    }
  }

  // Use Ollama for general queries
  const aiResponse = await ollama.generateResponse(message);
  if (aiResponse) {
    return aiResponse;
  }

  // Fallback response
  return "I apologize, but I couldn't find specific information for your query. Please try rephrasing your question or contact our customer support team.";
}

function extractFlightInfo(message: string) {
  const flightPattern = /\b([A-Z]{2}\d{3,4})\b/;
  const match = message.toUpperCase().match(flightPattern);
  return match ? { flightNumber: match[1] } : null;
}

function formatFlightResponse(flightData: any) {
  return `Flight ${flightData.flightNumber} (${flightData.airline.name}): ${flightData.status}

Departure: ${flightData.departure.airport} - Terminal ${flightData.departure.terminal}${flightData.departure.gate !== 'TBD' ? `, Gate ${flightData.departure.gate}` : ''}
Scheduled: ${flightData.departure.scheduled}

Arrival: ${flightData.arrival.airport} - Terminal ${flightData.arrival.terminal}${flightData.arrival.gate !== 'TBD' ? `, Gate ${flightData.arrival.gate}` : ''}
Scheduled: ${flightData.arrival.scheduled}`;
}

async function storeMessage(sessionId: string, type: string, content: string, intent?: string, responseTime?: number) {
  await prismaClient.chatMessage.create({
    data: {
      sessionId,
      messageType: type,
      content,
      intent,
      responseTimeMs: responseTime,
    }
  });
}
```

### **Step 3.2: Chat Session API**
Create `src/app/api/chat/session/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language = 'en' } = body;

    const session = await prisma.chatSession.create({
      data: {
        sessionId: crypto.randomUUID(),
        userIp: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || '',
        language,
      }
    });

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      createdAt: session.createdAt
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
```

### **Step 3.3: Flight API**
Create `src/app/api/flight/[flightNumber]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { FlightService } from '@/lib/flight-service';

const flightService = new FlightService();

export async function GET(
  request: NextRequest,
  { params }: { params: { flightNumber: string } }
) {
  try {
    const flightNumber = params.flightNumber.toUpperCase();
    
    const flightData = await flightService.getFlightInfo(flightNumber);
    
    if (flightData) {
      return NextResponse.json({
        success: true,
        flight: flightData,
        lastUpdated: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Flight not found',
        message: `No information available for flight ${flightNumber}`
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Flight API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## **PHASE 4: WIDGET IMPLEMENTATION**

### **Step 4.1: Widget JavaScript**
Create `public/widget/chat-widget.js`:
```javascript
class OmanAirportsChatWidget {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:3000/api',
      theme: config.theme || 'light',
      language: config.language || 'en',
      position: config.position || 'bottom-right',
      ...config
    };
    
    this.sessionId = null;
    this.isOpen = false;
    this.isTyping = false;
    
    this.init();
  }

  async init() {
    await this.loadStyles();
    this.createWidget();
    this.createChatButton();
    this.bindEvents();
    await this.createSession();
  }

  async loadStyles() {
    if (document.getElementById('chat-widget-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'chat-widget-styles';
    link.rel = 'stylesheet';
    link.href = `${this.config.apiUrl.replace('/api', '')}/widget/styles`;
    document.head.appendChild(link);
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.id = 'omanairports-chat-widget';
    widget.className = `chat-widget chat-widget--${this.config.theme} chat-widget--${this.config.position}`;
    
    widget.innerHTML = `
      <div class="chat-widget__header">
        <div class="chat-widget__title">
          <span>✈️ Oman Airports Assistant</span>
        </div>
        <button class="chat-widget__close" id="chat-widget-close">×</button>
      </div>
      
      <div class="chat-widget__body">
        <div class="chat-widget__messages" id="chat-widget-messages">
          <div class="chat-message chat-message--bot">
            <div class="chat-message__content">
              Welcome to Oman Airports! How can I help you today?
            </div>
            <div class="chat-message__time">${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        
        <div class="chat-widget__input-container">
          <input type="text" 
                 class="chat-widget__input" 
                 id="chat-widget-input" 
                 placeholder="Type your message...">
          <button class="chat-widget__send" id="chat-widget-send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
  }

  createChatButton() {
    const button = document.createElement('div');
    button.id = 'omanairports-chat-button';
    button.className = `chat-button chat-button--${this.config.position}`;
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    
    document.body.appendChild(button);
  }

  bindEvents() {
    // Toggle chat
    document.getElementById('omanairports-chat-button')?.addEventListener('click', () => {
      this.toggleChat();
    });

    document.getElementById('chat-widget-close')?.addEventListener('click', () => {
      this.toggleChat();
    });

    // Send message
    document.getElementById('chat-widget-send')?.addEventListener('click', () => {
      this.sendMessage();
    });

    document.getElementById('chat-widget-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  async createSession() {
    try {
      const response = await fetch(`${this.config.apiUrl}/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: this.config.language,
        })
      });

      const data = await response.json();
      if (data.success) {
        this.sessionId = data.sessionId;
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-widget-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message
    this.addMessage('user', message);
    input.value = '';

    // Show typing
    this.showTyping();

    try {
      const response = await fetch(`${this.config.apiUrl}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
        })
      });

      const data = await response.json();

      if (data.success) {
        this.hideTyping();
        this.addMessage('bot', data.response);
      } else {
        throw new Error('Failed to send message');
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.hideTyping();
      this.addMessage('bot', 'Sorry, I encountered an error. Please try again.');
    }
  }

  addMessage(type, content) {
    const messagesContainer = document.getElementById('chat-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message--${type}`;
    
    const time = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
      <div class="chat-message__content">${this.escapeHtml(content)}</div>
      <div class="chat-message__time">${time}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  showTyping() {
    if (this.isTyping) return;
    
    this.isTyping = true;
    const messagesContainer = document.getElementById('chat-widget-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message chat-message--bot chat-message--typing';
    typingDiv.id = 'chat-typing-indicator';
    
    typingDiv.innerHTML = `
      <div class="chat-message__content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTyping() {
    this.isTyping = false;
    const typingIndicator = document.getElementById('chat-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  toggleChat() {
    const widget = document.getElementById('omanairports-chat-widget');
    const button = document.getElementById('omanairports-chat-button');
    
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      widget.classList.add('chat-widget--open');
      button.style.display = 'none';
    } else {
      widget.classList.remove('chat-widget--open');
      button.style.display = 'block';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-initialize widget
if (typeof window !== 'undefined') {
  window.OmanAirportsChatWidget = OmanAirportsChatWidget;
  
  // Auto-initialize if config is present
  if (window.omanairportsChatConfig) {
    new OmanAirportsChatWidget(window.omanairportsChatConfig);
  }
}
```

### **Step 4.2: Widget CSS Route**
Create `src/app/widget/styles/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const css = `
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
  `;

  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```

---

## **PHASE 5: TESTING AND DEPLOYMENT**

### **Step 5.1: Test HTML Page**
Create `public/test.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Oman Airports Chatbot Test</title>
</head>
<body>
    <h1>Oman Airports Chatbot Test Page</h1>
    <p>This page tests the chatbot widget integration.</p>
    
    <script>
        // Configure the chatbot
        window.omanairportsChatConfig = {
            apiUrl: 'http://localhost:3000/api',
            theme: 'light',
            language: 'en',
            position: 'bottom-right'
        };
    </script>
    
    <!-- Load the chatbot widget -->
    <script src="/widget/chat-widget.js"></script>
</body>
</html>
```

### **Step 5.2: Setup Commands**
```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the Llama2 model
ollama pull llama2

# Test Ollama
ollama run llama2 "Hello, how are you?"

# Start the development server
npm run dev

# Test the API endpoints
curl -X POST http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'

curl -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the status of flight WY123?", "sessionId": "your-session-id"}'
```

---

## **NEXT PHASES FOR CURSOR.AI**

After completing Phase 1-5, continue with:

**Phase 6: Web Scraping System**
- Implement Puppeteer for web scraping
- Add multi-source information gathering
- Create content processing and caching

**Phase 7: Enhanced AI Processing**
- Improve context management
- Add intent recognition
- Implement knowledge integration

**Phase 8: Human Agent Support**
- Create agent management system
- Implement handoff logic
- Add live chat capabilities

**Phase 9: Admin Dashboard**
- Build analytics dashboard
- Create content management tools
- Implement system monitoring

**Phase 10: Security & Performance**
- Add authentication and authorization
- Implement rate limiting
- Optimize performance

**Phase 11: Advanced Features**
- Multi-language support
- Voice integration
- Advanced analytics

**Phase 12: Production Deployment**
- Setup production environment
- Implement CI/CD pipeline
- Add monitoring and alerting

Each phase builds upon the previous one, ensuring a systematic and complete implementation of the Oman Airports AI Chatbot. 