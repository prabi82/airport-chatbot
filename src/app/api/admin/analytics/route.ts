// Analytics API 

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { AIService } from '@/lib/ai-service';

const aiService = AIService.getInstance();

export async function GET(request: NextRequest) {
  try {
    // Extract date range from query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    let dateRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    const analytics = await adminService.getAnalytics(dateRange);

    // Get real-time quota information with actual limits
    const quotaStatus = await aiService.getAllQuotaStatus();
    
    // Get real Gemini quota limits
    const realGeminiLimits = await aiService.getRealQuotaLimits();
    
    // Enhanced quota information
    const enhancedQuotaStatus = {
      ...quotaStatus,
      gemini: {
        ...quotaStatus.gemini,
        realLimits: realGeminiLimits,
        actualTier: realGeminiLimits.tier,
        model: realGeminiLimits.model,
        description: realGeminiLimits.description
      }
    };

    return NextResponse.json({
      success: true,
      analytics,
      quotaStatus: enhancedQuotaStatus,
      realQuotaInfo: {
        gemini: realGeminiLimits,
        lastUpdated: new Date().toISOString(),
        source: 'Google AI API Documentation'
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type, filters } = await request.json();

    switch (type) {
      case 'agent_performance':
        const agentPerformance = await adminService.getAgentPerformance();
        return NextResponse.json({
          success: true,
          data: agentPerformance
        });

      case 'system_health':
        const systemHealth = await adminService.getSystemHealth();
        return NextResponse.json({
          success: true,
          data: systemHealth
        });

      default:
        return NextResponse.json(
          { error: 'Invalid analytics type' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 
