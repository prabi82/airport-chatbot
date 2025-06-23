import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/agent-service';

// Request Human Handoff
export async function POST(request: NextRequest) {
  try {
    const { sessionId, reason, priority, context } = await request.json();

    if (!sessionId || !reason) {
      return NextResponse.json(
        { error: 'Session ID and reason are required' },
        { status: 400 }
      );
    }

    const handoffId = await agentService.requestHandoff({
      sessionId,
      reason,
      priority: priority || 'normal',
      context
    });

    if (!handoffId) {
      return NextResponse.json(
        { error: 'Failed to request handoff' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      handoffId,
      message: 'Handoff requested successfully. An agent will be with you shortly.'
    });

  } catch (error) {
    console.error('Handoff request error:', error);
    return NextResponse.json(
      { error: 'Failed to request handoff' },
      { status: 500 }
    );
  }
}

// Get Pending Handoffs (for agents)
export async function GET(request: NextRequest) {
  try {
    const handoffs = await agentService.getPendingHandoffs();

    return NextResponse.json({
      success: true,
      handoffs
    });

  } catch (error) {
    console.error('Get handoffs error:', error);
    return NextResponse.json(
      { error: 'Failed to get handoffs' },
      { status: 500 }
    );
  }
}