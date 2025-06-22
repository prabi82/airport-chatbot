import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chat API endpoint called');
    
    // Parse request body
    const body = await request.json();
    const { message, sessionId } = body;

    // Validate input
    if (!message || typeof message !== 'string') {
      console.error('❌ Invalid message provided');
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      console.error('❌ Invalid sessionId provided');
      return NextResponse.json(
        { error: 'SessionId is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`📝 Processing message: "${message}" for session: ${sessionId}`);

    // Process query with database and fallback
    const response = await processQueryWithDatabase(message, sessionId);

    console.log(`✅ Response generated successfully`);

    // Return successful response
    return NextResponse.json({
      success: true,
      response: response.content,
      confidence: response.confidence,
      sources: response.sources,
      intent: response.intent,
      requiresHuman: false,
      suggestedActions: response.suggestedActions,
      responseTime: response.responseTime
    });

  } catch (error) {
    console.error('💥 Error in chat API:', error);

    // Return error response
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Sorry, I encountered an error processing your request. Please try again.'
      },
      { status: 500 }
    );
  }
}

async function processQueryWithDatabase(query: string, sessionId: string) {
  const startTime = Date.now();
  let usedDatabase = false;
  
  try {
    // Try to get or create session
    const session = await getOrCreateSession(sessionId);
    
    // Search knowledge base first
    const knowledgeMatch = await searchKnowledgeBase(query);
    if (knowledgeMatch) {
      usedDatabase = true;
      
      // Save to database
      await saveMessage(sessionId, query, knowledgeMatch.answer, 'knowledge_base', Date.now() - startTime, true);
      
      return {
        content: knowledgeMatch.answer,
        confidence: knowledgeMatch.confidence,
        sources: [{ title: `Knowledge Base - ${knowledgeMatch.category}`, url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
        intent: knowledgeMatch.category,
        suggestedActions: ['ask_more', 'contact_support'],
        responseTime: Date.now() - startTime
      };
    }
  } catch (error) {
    console.warn('Database operation failed, using fallback:', error);
  }
  
  // Fallback to static processing
  const staticResponse = await processQueryDirectly(query);
  
  // Try to save to database (non-blocking)
  try {
    if (!usedDatabase) {
      await saveMessage(sessionId, query, staticResponse.content, staticResponse.intent, Date.now() - startTime, true);
    }
  } catch (error) {
    console.warn('Failed to save message to database:', error);
  }
  
  return staticResponse;
}

async function getOrCreateSession(sessionId: string) {
  try {
    return await prisma.chatSession.upsert({
      where: { sessionId },
      update: { updatedAt: new Date() },
      create: {
        sessionId,
        userAgent: 'Web Browser',
        ipAddress: '0.0.0.0',
        language: 'en'
      }
    });
  } catch (error) {
    console.warn('Failed to create/update session:', error);
    return null;
  }
}

async function searchKnowledgeBase(query: string) {
  try {
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
      orderBy: { priority: 'desc' },
      take: 1
    });

    if (entries.length === 0) return null;
    
    const entry = entries[0];
    return {
      answer: entry.answer,
      category: entry.category,
      confidence: calculateConfidence(query, entry)
    };
  } catch (error) {
    console.warn('Knowledge base search failed:', error);
    return null;
  }
}

function calculateConfidence(query: string, entry: any): number {
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

async function saveMessage(sessionId: string, message: string, response: string, queryType: string, processingTime: number, isSuccessful: boolean) {
  try {
    await prisma.chatMessage.create({
      data: {
        sessionId,
        message,
        response,
        queryType,
        processingTime,
        isSuccessful
      }
    });
  } catch (error) {
    console.warn('Failed to save message:', error);
  }
}

// Keep the existing static processing as fallback
async function processQueryDirectly(query: string) {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase();
  
  // Direction queries
  if (lowerQuery.includes('direction') || lowerQuery.includes('how to get') || lowerQuery.includes('route') || lowerQuery.includes('drive')) {
    if (lowerQuery.includes('burj al sahwa') || lowerQuery.includes('roundabout')) {
      return {
        content: `🗺️ **Directions from Burj Al Sahwa Roundabout to Muscat Airport:**

**Route:** Take Sultan Qaboos Highway (Highway 1) eastbound towards Seeb. The airport is approximately 15-20 minutes drive from Burj Al Sahwa roundabout.

**Detailed Directions:**
1. From Burj Al Sahwa roundabout, head northeast toward Sultan Qaboos Highway
2. Merge onto Sultan Qaboos Highway (Highway 1) heading towards Seeb
3. Continue on Highway 1 for approximately 12 km
4. Take the exit for Muscat International Airport (clearly signposted)
5. Follow the airport access road to the terminal building

**Distance:** Approximately 12-15 km
**Travel Time:** 15-20 minutes (depending on traffic)
**Highway:** Sultan Qaboos Highway (Highway 1)

The airport is well-signposted from the highway, and you'll see clear directional signs as you approach the exit.`,
        confidence: 0.95,
        sources: [{ title: 'Muscat Airport Directions', url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
        intent: 'directions',
        suggestedActions: ['check_traffic', 'view_map', 'contact_taxi'],
        responseTime: Date.now() - startTime
      };
    }
    
    return {
      content: `🗺️ **Getting to Muscat International Airport:**

**From Muscat City Center:**
- Take Sultan Qaboos Highway (Highway 1) towards Seeb
- Distance: Approximately 32 km
- Travel Time: 35-45 minutes

**From Seeb:**
- Take Sultan Qaboos Highway (Highway 1) eastbound
- Distance: Approximately 15 km  
- Travel Time: 15-20 minutes

**Key Landmarks:**
- The airport is clearly signposted from the highway
- Look for "Muscat International Airport" signs
- Exit is well-marked and easy to find

**Highway Information:**
- Main route: Sultan Qaboos Highway (Highway 1)
- The airport connects to the rest of Oman via this major highway`,
      confidence: 0.9,
      sources: [{ title: 'Muscat Airport Access', url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
      intent: 'directions',
      suggestedActions: ['check_traffic', 'view_map', 'book_taxi'],
      responseTime: Date.now() - startTime
    };
  }
  
  // Public transportation queries
  if (lowerQuery.includes('public transport') || lowerQuery.includes('bus') || lowerQuery.includes('shuttle')) {
    return {
      content: `🚌 **Public Transportation from Muscat Airport:**

**Mwasalat Public Buses:**
- **Route 1**: Airport ↔ Ruwi (City Center)
- **Route 2**: Airport ↔ Seeb
- **Operating Hours**: 6:00 AM - 10:00 PM
- **Frequency**: Every 30-45 minutes
- **Fare**: 500 Baisa - 1 OMR

**Bus Stops:**
- Located outside the arrivals hall
- Clear signage in English and Arabic
- Ticket machines and staff available

**Hotel Shuttle Services:**
- Many hotels provide complimentary shuttle services
- Advance booking required (24-48 hours)
- Contact your hotel directly for schedules

**Alternative Options:**
- Taxis available 24/7 from arrivals hall
- Ride-hailing apps (Careem, Uber)
- Car rental services available`,
      confidence: 0.95,
      sources: [{ title: 'Mwasalat Public Transport', url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
      intent: 'public_transport',
      suggestedActions: ['check_bus_schedule', 'contact_hotel', 'book_taxi'],
      responseTime: Date.now() - startTime
    };
  }
  
  // Parking queries
  if (lowerQuery.includes('parking') || lowerQuery.includes('park')) {
    return {
      content: `🅿️ **Parking at Muscat Airport:**

**Parking Areas:**
- **P1**: Short-term parking (closest to terminal)
- **P2**: Medium-term parking
- **P3**: Long-term parking (most economical)

**Rates:**
- **First 30 minutes**: Free
- **1-2 hours**: 2 OMR
- **2-24 hours**: 5 OMR per day
- **Long-term**: 3 OMR per day (P3 area)

**Payment Methods:**
- Cash (OMR)
- Credit/Debit cards
- Payment machines available

**Features:**
- 24/7 availability
- CCTV surveillance
- Covered parking available
- Easy access to terminal`,
      confidence: 0.9,
      sources: [{ title: 'Muscat Airport Parking', url: 'https://www.muscatairport.co.om', relevance: 0.9 }],
      intent: 'parking',
      suggestedActions: ['view_rates', 'check_availability', 'book_parking'],
      responseTime: Date.now() - startTime
    };
  }
  
  // Greeting queries
  if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
    return {
      content: `👋 **Welcome to Oman Airports!**

I'm here to help you with information about Muscat International Airport.

**I can assist you with:**
🛫 Flight information and schedules
🚗 Transportation options (taxis, buses, parking)
🏢 Airport facilities and services
🗺️ Directions to and from the airport
🎫 General airport information

**How can I help you today?**`,
      confidence: 0.9,
      sources: [{ title: 'Oman Airports Assistant', url: 'https://www.omanairports.co.om', relevance: 0.9 }],
      intent: 'greeting',
      suggestedActions: ['ask_directions', 'check_parking', 'find_taxi'],
      responseTime: Date.now() - startTime
    };
  }
  
  // Default response
  return {
    content: `🏢 **Muscat International Airport Information:**

I can help you with information about:

**🚗 Transportation:**
- Parking rates and locations
- Taxi services and rates  
- Public bus routes (Mwasalat)
- Hotel shuttle services

**🗺️ Directions:**
- Driving directions to the airport
- Highway access routes
- Travel times from different locations

**🏢 Airport Services:**
- Terminal facilities
- Check-in procedures
- Security information

**What specific information would you like to know about Muscat Airport?**`,
    confidence: 0.7,
    sources: [{ title: 'Muscat Airport Guide', url: 'https://www.muscatairport.co.om', relevance: 0.8 }],
    intent: 'general',
    suggestedActions: ['ask_directions', 'check_parking', 'find_transportation'],
    responseTime: Date.now() - startTime
  };
}

export async function GET() {
  return NextResponse.json({ message: 'Chat API is running' });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 