import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AIProcessor } from '@/lib/ai-processor';
import { prisma } from '@/lib/database';

const messageSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
});

// Initialize AI processor
const aiProcessor = new AIProcessor();

// Mock responses for demo (fallback only)
const mockResponses = {
  flight: {
    pattern: /\b([A-Z]{2}\d{3,4})\b/,
    response: (flightNumber: string) => `✈️ **Flight ${flightNumber} Information**

**Status:** On Time
**Airline:** Oman Air

**🛫 Departure:**
• Airport: Muscat International (MCT)
• Terminal: 1, Gate A12
• Scheduled: 14:30 (Today)

**🛬 Arrival:**
• Airport: Dubai International (DXB)
• Terminal: 3, Gate B7
• Scheduled: 16:45 (Today)

**✈️ Aircraft:** Boeing 737-800

For real-time updates, please check the departure boards or contact airport information.`
  },
  greetings: {
    patterns: [/hello/i, /hi/i, /hey/i, /good morning/i, /good afternoon/i, /good evening/i],
    responses: [
      `👋 **Hello! Welcome to Oman Airports**

I'm here to help you with:
• ✈️ Flight information and status
• 🏢 Airport services and facilities  
• 🚗 Transportation and parking
• 🛂 Security and check-in procedures

How can I assist you today?`,
      `🌟 **Hi there! I'm your Oman Airports Assistant**

I can help you with:
• 📊 Flight status and schedules
• 🛍️ Airport facilities and amenities
• 🚌 Transportation options
• ℹ️ General airport information

What would you like to know?`,
      `✈️ **Greetings! Welcome to Oman Airports**

I'm here to provide information about:
• 🛫 Flights and departures
• 🏢 Airport services
• 🅿️ Parking and transport
• 📞 Contact information

How may I help you?`
    ]
  },
  airport: {
    patterns: [/airport/i, /facility/i, /service/i, /amenity/i],
    responses: [
      `🏢 **Oman Airports - Excellent Facilities**

**🛍️ Shopping & Dining:**
• Duty-free shopping
• Restaurants and cafes
• Local and international cuisine

**🛌 Comfort Services:**
• Rest lounges
• Prayer rooms
• Family areas

**🚗 Transportation:**
• Car rental services
• Taxi stands
• Bus connections

**💼 Business Services:**
• Free WiFi throughout
• Business lounges
• Meeting rooms

**💱 Other Services:**
• Currency exchange
• ATMs and banking
• Lost & found

Which specific service would you like to know more about?`
    ]
  },
  parking: {
    patterns: [/parking/i, /park/i, /car/i],
    responses: [
      `🅿️ **Parking at Oman Airports**

**💰 Parking Rates:**
• Short-term: OMR 1 per hour
• Long-term: OMR 15 per day
• Premium: OMR 3 per hour

**📍 Location & Access:**
• All parking areas within walking distance
• Covered and open-air options
• 24/7 security monitoring

**🚗 Additional Services:**
• Valet parking available
• Electric vehicle charging
• Disabled parking spaces

**💳 Payment Options:**
• Cash accepted
• Credit/debit cards
• Mobile payments

Would you like directions to the parking areas?`
    ]
  },
  transportation: {
    patterns: [/transport/i, /taxi/i, /bus/i, /how to get/i, /travel to/i],
    responses: [
      `🚗 **Transportation to/from Oman Airports**

**🚕 Taxi Services:**
• Available 24/7 outside terminals
• Licensed operators only
• Fare meters required

**🚌 Public Transport:**
• Airport buses to city center
• Regular scheduled services
• Affordable rates

**🚗 Car Rental:**
• Multiple international providers
• On-site rental desks
• Wide vehicle selection

**🏨 Hotel Services:**
• Hotel shuttle buses
• Check with your accommodation
• Advance booking recommended

**📱 Ride-Sharing:**
• Uber and Careem available
• Designated pickup areas
• App-based booking

**⏱️ Travel Time:**
Estimated 45 minutes to Muscat city center

Need specific directions or pricing information?`
    ]
  },
  security: {
    patterns: [/security/i, /check.?in/i, /prohibited/i, /baggage/i, /luggage/i],
    responses: [
      `🛂 **Security & Check-in Information**

**⏰ Arrival Times:**
• International flights: 3 hours early
• Domestic flights: 2 hours early

**🚫 Prohibited Items:**
• Liquids over 100ml (carry-on)
• Sharp objects and tools
• Flammable substances
• Weapons of any kind

**💼 Baggage Guidelines:**
• Check airline-specific allowances
• Weight limits vary by carrier
• Special items need declaration

**📱 Check-in Options:**
• Online: 24 hours before departure
• Mobile check-in available
• Airport counters open 3 hours prior

**🆔 Required Documents:**
• Valid passport or ID
• Boarding pass
• Visa (if required)

**💡 Pro Tips:**
• Arrive early during peak seasons
• Keep documents ready
• Remove electronics for screening

For specific airline policies, please contact your carrier directly.`
    ]
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = messageSchema.parse(body);

    const startTime = Date.now();

    // Get or create session
    const session = await getOrCreateSession(sessionId, request);

    // Store user message
    await storeMessage(session.sessionId, 'user', message);

    // Try enhanced AI processing first
    try {
      const processedResponse = await aiProcessor.processQuery(message, session.sessionId);

      // Store bot response
      await storeMessage(session.sessionId, 'bot', processedResponse.content, processedResponse.intent, processedResponse.responseTime);

      // Calculate total response time
      const responseTime = Date.now() - startTime;

      // Extract links for alternative separate message approach
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      const links = [];
      let match;
      
      while ((match = linkPattern.exec(processedResponse.content)) !== null) {
        links.push({
          text: match[1],
          url: match[2]
        });
      }

      return NextResponse.json({
        success: true,
        response: processedResponse.content,
        sessionId: session.sessionId,
        responseTime,
        confidence: processedResponse.confidence,
        intent: processedResponse.intent,
        sources: processedResponse.sources,
        suggestedActions: processedResponse.suggestedActions,
        requiresHuman: processedResponse.requiresHuman,
        links: links // Include extracted links for alternative approach
      });
    } catch (aiError) {
      console.warn('AI processing failed, falling back to mock responses:', aiError);
      
      // Fallback to mock responses
      const response = await processMessageWithMockResponses(message, session.sessionId);
      const responseTime = Date.now() - startTime;

      // Store bot response
      await storeMessage(session.sessionId, 'bot', response, 'mock_fallback', responseTime);

      return NextResponse.json({
        success: true,
        response,
        sessionId: session.sessionId,
        responseTime,
        confidence: 0.7,
        intent: 'mock_fallback',
        sources: [],
        suggestedActions: [],
        requiresHuman: false
      });
    }

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
    const existing = await prisma.chatSession.findUnique({
      where: { sessionId }
    });
    if (existing) return existing;
  }

  return await prisma.chatSession.create({
    data: {
      sessionId: crypto.randomUUID(),
      userIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
      language: request.headers.get('accept-language')?.split(',')[0] || 'en',
    }
  });
}

async function processMessageWithMockResponses(message: string, sessionId: string): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // Check for flight numbers
  const flightMatch = message.match(mockResponses.flight.pattern);
  if (flightMatch) {
    return mockResponses.flight.response(flightMatch[1]);
  }

  // Check greetings
  for (const pattern of mockResponses.greetings.patterns) {
    if (pattern.test(lowerMessage)) {
      const responses = mockResponses.greetings.responses;
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  // Check airport services
  for (const pattern of mockResponses.airport.patterns) {
    if (pattern.test(lowerMessage)) {
      return mockResponses.airport.responses[0];
    }
  }

  // Check parking
  for (const pattern of mockResponses.parking.patterns) {
    if (pattern.test(lowerMessage)) {
      return mockResponses.parking.responses[0];
    }
  }

  // Check transportation
  for (const pattern of mockResponses.transportation.patterns) {
    if (pattern.test(lowerMessage)) {
      return mockResponses.transportation.responses[0];
    }
  }

  // Check security
  for (const pattern of mockResponses.security.patterns) {
    if (pattern.test(lowerMessage)) {
      return mockResponses.security.responses[0];
    }
  }

  // Default response
  return `Thank you for your question. I'm here to help with information about Oman Airports including:

• ✈️ Flight information and status
• 🏢 Airport facilities and services
• 🚗 Transportation and parking
• 🛂 Security and check-in procedures

Could you please rephrase your question or ask about one of these topics?`;
}

async function storeMessage(sessionId: string, type: string, content: string, intent?: string, responseTime?: number) {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      messageType: type,
      content,
      intent,
      responseTimeMs: responseTime,
    }
  });
} 