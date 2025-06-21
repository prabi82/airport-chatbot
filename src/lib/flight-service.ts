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