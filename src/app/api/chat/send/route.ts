import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const messageSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
});

// Mock responses for demo
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

    // Generate or use provided session ID
    const currentSessionId = sessionId || crypto.randomUUID();

    // Process message and generate response
    const response = await processMessage(message);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      response,
      sessionId: currentSessionId,
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

async function processMessage(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // Check for flight number
  const flightMatch = message.toUpperCase().match(mockResponses.flight.pattern);
  if (flightMatch) {
    return mockResponses.flight.response(flightMatch[1]);
  }

  // Check for greetings
  if (mockResponses.greetings.patterns.some(pattern => pattern.test(message))) {
    const responses = mockResponses.greetings.responses;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Check for airport-related queries
  if (mockResponses.airport.patterns.some(pattern => pattern.test(message))) {
    return mockResponses.airport.responses[0];
  }

  // Check for parking queries
  if (mockResponses.parking.patterns.some(pattern => pattern.test(message))) {
    return mockResponses.parking.responses[0];
  }

  // Check for transportation queries
  if (mockResponses.transportation.patterns.some(pattern => pattern.test(message))) {
    return mockResponses.transportation.responses[0];
  }

  // Check for security/check-in queries
  if (mockResponses.security.patterns.some(pattern => pattern.test(message))) {
    return mockResponses.security.responses[0];
  }

  // Default response for unmatched queries
  return `🤖 **Thank you for your question!**

"${message}"

**I can help you with:**
• ✈️ Flight status (try "WY123" or "OV456")
• 🏢 Airport facilities and services
• 🅿️ Parking information and rates
• 🚗 Transportation options
• 🛂 Security and check-in procedures

**Need immediate assistance?**
📞 Customer Service: +968 2451 4444 (24/7)

Could you please rephrase your question or ask about one of these topics?`;
} 