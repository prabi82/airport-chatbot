import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { aiService } from '@/lib/ai-service';

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

    // Use AI service for semantic analysis and response generation
    const aiResponse = await aiService.processQuery(message, sessionId);

    // Save the interaction to database (non-blocking)
    try {
      await saveMessage(sessionId, message, aiResponse.content, aiResponse.intent, aiResponse.responseTime, true);
    } catch (error) {
      console.warn('Failed to save message to database:', error);
    }

    console.log(`✅ AI response generated with ${(aiResponse.confidence * 100).toFixed(1)}% confidence`);

    // Return successful response
    return NextResponse.json({
      success: true,
      response: aiResponse.content,
      confidence: aiResponse.confidence,
      sources: aiResponse.sources,
      intent: aiResponse.intent,
      requiresHuman: aiResponse.confidence < 0.5, // Suggest human help for low confidence
      suggestedActions: aiResponse.suggestedActions,
      responseTime: aiResponse.responseTime
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

async function saveMessage(sessionId: string, message: string, response: string, queryType: string, processingTime: number, isSuccessful: boolean) {
  try {
    // Ensure session exists
    await prisma.chatSession.upsert({
      where: { sessionId },
      update: { updatedAt: new Date() },
      create: {
        sessionId,
        userAgent: 'Web Browser',
        ipAddress: '0.0.0.0',
        language: 'en'
      }
    });

    // Save the message
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

export async function GET() {
  return NextResponse.json({ 
    message: 'Oman Airports AI Chat API is running',
    version: '2.0.0',
    features: ['semantic_analysis', 'intent_recognition', 'knowledge_base', 'fallback_responses']
  });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 