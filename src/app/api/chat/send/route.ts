import { NextRequest, NextResponse } from 'next/server';
import { AIProcessor } from '@/lib/ai-processor';

// Initialize AI processor
const aiProcessor = new AIProcessor();

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

    // Process the query using AI processor
    const response = await aiProcessor.processQuery(message, sessionId);

    console.log(`✅ Response generated successfully with confidence: ${response.confidence}`);

    // Return successful response
    return NextResponse.json({
      success: true,
      response: response.content,
      confidence: response.confidence,
      sources: response.sources,
      intent: response.intent,
      requiresHuman: response.requiresHuman,
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

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
} 