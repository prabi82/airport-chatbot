import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { aiService } from '@/lib/ai-service';
import { agentService } from '@/lib/agent-service';

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

    // Retrieve conversation history for context
    let conversationContext = '';
    try {
      const recentMessages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 5, // Last 5 messages for context
        select: {
          message: true,
          response: true,
          createdAt: true
        }
      });

      if (recentMessages.length > 0) {
        conversationContext = '\n\nRecent Conversation History:\n';
        recentMessages.reverse().forEach((msg, index) => {
          conversationContext += `${index + 1}. User: ${msg.message}\n   AI: ${msg.response}\n`;
        });
        conversationContext += '\nPlease consider this conversation history when responding to maintain context and continuity.\n';
      }
    } catch (error) {
      console.warn('Failed to retrieve conversation history:', error);
    }

    // Check for explicit handoff requests
    const handoffKeywords = [
      'speak to human', 'talk to human', 'human agent', 'customer service',
      'representative', 'supervisor', 'manager', 'complaint', 'escalate',
      'not satisfied', 'unhappy', 'frustrated', 'this is not working',
      'need help', 'complex issue', 'urgent matter'
    ];

    const needsHandoff = handoffKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    // Use AI service for response generation with conversation context
    const aiResponse = await aiService.generateResponse(message, conversationContext, sessionId);

    // Determine if human assistance is needed (using success as confidence indicator)
    const confidence = aiResponse.success ? 0.8 : 0.3;
    const requiresHuman = confidence < 0.5 || needsHandoff;

    // Auto-request handoff if needed
    let handoffId = null;
    if (requiresHuman && needsHandoff) {
      console.log('🤝 Auto-requesting handoff for session:', sessionId);
      handoffId = await agentService.requestHandoff({
        sessionId,
        reason: needsHandoff ? 'Customer explicitly requested human assistance' : 'Low AI confidence response',
        priority: needsHandoff ? 'high' : 'normal',
        context: {
          lastMessage: message,
          aiConfidence: confidence,
          explicitRequest: needsHandoff
        }
      });
    }

    // Save the interaction to database (non-blocking)
    const queryType = aiResponse.knowledgeBaseUsed ? 'kb' : 'no_kb';
    const mainEntryId = aiResponse.kbEntryId || null;

    try {
      await saveMessage(sessionId, message, aiResponse.message, queryType, aiResponse.processingTime, aiResponse.success, mainEntryId);
    } catch (error) {
      console.warn('Failed to save message to database:', error);
    }

    console.log(`✅ AI response generated with ${(confidence * 100).toFixed(1)}% confidence using ${aiResponse.provider}`);

    // Enhanced response with handoff information
    let responseContent = aiResponse.message;
    if (handoffId) {
      responseContent += '\n\n🤝 **I\'ve connected you with our human support team. An agent will be with you shortly to assist with your request.**';
    } else if (requiresHuman) {
      responseContent += '\n\n💬 *If you need further assistance, I can connect you with a human agent. Just say "I need human help".*';
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      response: responseContent,
      confidence: confidence,
      sources: aiResponse.sources || [], // Use actual sources from AI service
      intent: 'general', // Simplified intent detection
      requiresHuman,
      handoffRequested: !!handoffId,
      handoffId,
      suggestedActions: [], // AI service doesn't provide suggested actions currently
      responseTime: aiResponse.processingTime,
      provider: aiResponse.provider,
      knowledgeBaseUsed: aiResponse.knowledgeBaseUsed || false
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

async function saveMessage(sessionId: string, message: string, response: string, queryType: string, processingTime: number, isSuccessful: boolean, kbEntryId: string | null) {
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
        isSuccessful,
        ...(kbEntryId ? { kbEntryId } : {})
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