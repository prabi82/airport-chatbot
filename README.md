# Oman Airports AI Chatbot 🛫

A standalone AI-powered chatbot application for Oman Airports that provides comprehensive information through web scraping, flight APIs, and local AI processing. The chatbot is designed as an embeddable widget for the main Oman Airports website.

![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7+-red?style=flat-square&logo=redis)
![Ollama](https://img.shields.io/badge/Ollama-Local%20AI-green?style=flat-square)

## ✨ Features

### 🤖 AI-Powered Responses
- **Local AI Processing** with Ollama (no monthly API costs)
- **Context-aware conversations** with memory
- **Intent recognition** and confidence scoring
- **Fallback mechanisms** for service unavailability

### ✈️ Flight Information System
- **Real-time flight data** from multiple APIs
- **Flight number detection** in natural language
- **Comprehensive flight details** (status, gates, terminals, times)
- **Smart caching** with 30-minute expiration

### 🌐 Multi-Source Information
- **Web scraping** from official Oman Airports websites
- **Content aggregation** from multiple sources
- **Intelligent parsing** and relevance scoring
- **Respectful rate limiting** and caching

### 💬 Interactive Widget
- **Standalone JavaScript** widget (no framework dependencies)
- **Responsive design** for all devices
- **Customizable themes** (light/dark)
- **Real-time typing indicators**
- **Multiple positioning** options

### 🔒 Security & Performance
- **Input validation** and sanitization
- **Rate limiting** and CORS protection
- **Response caching** for optimal performance
- **Error handling** and graceful degradation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- Ollama (for local AI)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/prabi82/airport-chatbot.git
   cd airport-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Database setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Test the demo**
   Open http://localhost:3000/demo.html

## 🎯 Demo

The application includes a comprehensive demo at `/demo.html` that showcases all features without requiring external dependencies. The demo includes:

- **Interactive chat interface** with real-time responses
- **Flight information queries** (try "WY123", "OV456", or "EK123")
- **Airport services information**
- **Parking and transportation details**
- **Security and check-in procedures**

### Demo Features
- ✅ **Smart responses** based on query type
- ✅ **Flight number recognition**
- ✅ **Context-aware conversations**
- ✅ **Professional UI/UX design**
- ✅ **Mobile responsive**
- ✅ **Error handling and fallbacks**

## 🔧 Configuration

### Widget Configuration
```javascript
window.omanairportsChatConfig = {
  apiUrl: 'https://your-domain.com/api',
  theme: 'light', // 'light' | 'dark'
  language: 'en', // 'en' | 'ar'
  position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  autoOpen: false,
  welcomeMessage: 'Welcome to Oman Airports!'
};
```

### Environment Variables
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
```

## 🏗️ Architecture

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
│  │   Chat API      │    │   Flight API    │                │
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

## 📁 Project Structure

```
omanairports-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   ├── send/route.ts
│   │   │   │   └── session/route.ts
│   │   │   └── flight/
│   │   │       └── [flightNumber]/route.ts
│   │   ├── widget/
│   │   │   └── styles/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── database.ts
│       ├── flight-service.ts
│       ├── ollama.ts
│       └── redis.ts
├── public/
│   ├── widget/
│   │   └── chat-widget.js
│   ├── demo.html
│   └── test.html
├── prisma/
│   └── schema.prisma
├── docs/
│   ├── CursorImplementationGuide.md
│   ├── DevelopmentPhases.md
│   ├── FeaturesList.md
│   └── TechnicalDocument.md
└── package.json
```

## 🛠️ API Endpoints

### Chat API
- `POST /api/chat/send` - Send message and get AI response
- `POST /api/chat/session` - Create new chat session

### Flight API
- `GET /api/flight/[flightNumber]` - Get flight information

### Widget API
- `GET /widget/styles` - Get widget CSS styles

## 🧪 Testing

The project includes comprehensive testing capabilities:

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Test the demo
npm run dev
# Open http://localhost:3000/demo.html
```

## 📊 Performance Metrics

- **Response Time**: < 2 seconds average
- **Uptime**: 99.9% target
- **Accuracy**: > 90% response accuracy
- **Scalability**: 1000+ concurrent users
- **Cache Hit Rate**: > 80% for frequent queries

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📋 Development Phases

The project is developed in phases:

- ✅ **Phase 1**: Project Setup & Foundation
- ✅ **Phase 2**: Core Chatbot Implementation  
- ✅ **Phase 3**: Flight Information System
- ✅ **Phase 4**: Widget Implementation
- 🔄 **Phase 5**: Web Scraping System
- ⏳ **Phase 6**: Enhanced AI Processing
- ⏳ **Phase 7**: Human Agent Support
- ⏳ **Phase 8**: Admin Dashboard

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live Demo**: [Coming Soon]
- **Documentation**: [docs/](./docs/)
- **API Documentation**: [Coming Soon]
- **Support**: [Issues](https://github.com/prabi82/airport-chatbot/issues)

## 🙏 Acknowledgments

- Oman Airports for the project requirements
- Ollama team for local AI capabilities
- Next.js team for the excellent framework
- All contributors and testers

---

**Built with ❤️ for Oman Airports**
