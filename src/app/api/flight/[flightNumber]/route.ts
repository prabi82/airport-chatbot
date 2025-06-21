import { NextRequest, NextResponse } from 'next/server';

// Mock flight data for demo
const mockFlights: Record<string, any> = {
  'WY123': {
    flightNumber: 'WY123',
    status: 'On Time',
    departure: {
      airport: 'Muscat International Airport (MCT)',
      terminal: 'Terminal 1',
      gate: 'A12',
      scheduled: '14:30',
      actual: null
    },
    arrival: {
      airport: 'Dubai International Airport (DXB)',
      terminal: 'Terminal 3',
      gate: 'B7',
      scheduled: '16:45',
      actual: null
    },
    airline: {
      name: 'Oman Air',
      code: 'WY'
    },
    aircraft: {
      type: 'Boeing 737-800',
      registration: 'A4O-BAA'
    }
  },
  'OV456': {
    flightNumber: 'OV456',
    status: 'Delayed',
    departure: {
      airport: 'Salalah Airport (SLL)',
      terminal: 'Terminal 1',
      gate: 'C3',
      scheduled: '09:15',
      actual: '09:45'
    },
    arrival: {
      airport: 'Muscat International Airport (MCT)',
      terminal: 'Terminal 1',
      gate: 'A8',
      scheduled: '10:30',
      actual: '11:00'
    },
    airline: {
      name: 'SalamAir',
      code: 'OV'
    },
    aircraft: {
      type: 'Airbus A320',
      registration: 'A4O-SAA'
    }
  },
  'EK123': {
    flightNumber: 'EK123',
    status: 'Boarding',
    departure: {
      airport: 'Dubai International Airport (DXB)',
      terminal: 'Terminal 3',
      gate: 'A1',
      scheduled: '11:20',
      actual: '11:20'
    },
    arrival: {
      airport: 'Muscat International Airport (MCT)',
      terminal: 'Terminal 1',
      gate: 'B5',
      scheduled: '12:35',
      actual: null
    },
    airline: {
      name: 'Emirates',
      code: 'EK'
    },
    aircraft: {
      type: 'Boeing 777-300ER',
      registration: 'A6-EBK'
    }
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flightNumber: string }> }
) {
  try {
    const resolvedParams = await params;
    const flightNumber = resolvedParams.flightNumber.toUpperCase();
    
    // Check if we have mock data for this flight
    const flightData = mockFlights[flightNumber];
    
    if (flightData) {
      return NextResponse.json({
        success: true,
        flight: flightData,
        lastUpdated: new Date().toISOString(),
        source: 'demo_data'
      });
    } else {
      // Generate a generic mock flight for any flight number
      const genericFlight = {
        flightNumber,
        status: 'Scheduled',
        departure: {
          airport: 'Muscat International Airport (MCT)',
          terminal: 'Terminal 1',
          gate: 'TBD',
          scheduled: '15:00',
          actual: null
        },
        arrival: {
          airport: 'Dubai International Airport (DXB)',
          terminal: 'Terminal 3',
          gate: 'TBD',
          scheduled: '17:15',
          actual: null
        },
        airline: {
          name: 'Sample Airline',
          code: flightNumber.substring(0, 2)
        },
        aircraft: {
          type: 'Boeing 737',
          registration: 'A4O-XXX'
        }
      };

      return NextResponse.json({
        success: true,
        flight: genericFlight,
        lastUpdated: new Date().toISOString(),
        source: 'demo_data',
        message: 'This is demo data for testing purposes'
      });
    }

  } catch (error) {
    console.error('Flight API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 