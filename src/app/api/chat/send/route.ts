import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { aiService } from '@/lib/ai-service';
import { agentService } from '@/lib/agent-service';
import { detectLanguage, Language } from '@/lib/language-detector';

// Check if IP is blocked
async function isIPBlocked(ipAddress: string): Promise<boolean> {
  try {
    const blocked = await prisma.blockedIP.findUnique({
      where: { ipAddress, isActive: true }
    });
    return !!blocked;
  } catch (error) {
    console.error('[Chat Send API] Error checking blocked IP:', error);
    return false; // Allow on error to avoid blocking legitimate users
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chat API endpoint called');
    
    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

    // Check if IP is blocked
    if (await isIPBlocked(ipAddress)) {
      console.warn(`🚫 Blocked IP attempt: ${ipAddress}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied',
          message: 'Your IP address has been blocked due to suspicious activity.'
        },
        { status: 403 }
      );
    }
    
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

    // Detect language of the incoming message
    const detectedLanguage: Language = detectLanguage(message);
    console.log(`🌍 Detected language: ${detectedLanguage}`);

    // Get or update session language
    let sessionLanguage: Language = 'en';
    try {
      const session = await prisma.chatSession.findUnique({
        where: { sessionId },
        select: { language: true }
      });

      if (session) {
        // If session exists, use its language, but update if user switched languages
        sessionLanguage = (session.language as Language) || 'en';
        
        // If user switched language (e.g., from English to Arabic or vice versa), update session
        if (detectedLanguage !== sessionLanguage) {
          console.log(`🔄 Language switch detected: ${sessionLanguage} → ${detectedLanguage}`);
          await prisma.chatSession.update({
            where: { sessionId },
            data: { language: detectedLanguage }
          });
          sessionLanguage = detectedLanguage;
        }
      } else {
        // New session or session not found, use detected language
        sessionLanguage = detectedLanguage;
        // Try to update/create session with detected language
        try {
          await prisma.chatSession.upsert({
            where: { sessionId },
            update: { language: detectedLanguage },
            create: {
              sessionId,
              language: detectedLanguage,
              userAgent: 'Web Browser',
              ipAddress: '0.0.0.0'
            }
          });
        } catch (error) {
          console.warn('Failed to update session language:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to get/update session language, using detected language:', error);
      sessionLanguage = detectedLanguage;
    }

    // Retrieve conversation history for context
    let conversationContext = '';
    try {
      const recentMessages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 3, // Reduced from 5 to 3 for better performance
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
    // Pass the session language to ensure consistent language responses
    let aiResponse;
    try {
      aiResponse = await aiService.generateResponse(message, conversationContext, sessionId, sessionLanguage);
    } catch (aiError) {
      console.error('💥 AI Service error:', aiError);
      console.error('AI Service error stack:', aiError instanceof Error ? aiError.stack : 'No stack trace');
      // Return a fallback response instead of crashing
      return NextResponse.json({
        success: false,
        response: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment or contact customer service at +968 24351234.',
        error: 'AI service unavailable',
        confidence: 0,
        requiresHuman: false,
        responseTime: 0,
        provider: 'error',
        knowledgeBaseUsed: false
      }, { status: 200 }); // Return 200 with error flag instead of 500
    }

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
      console.log(`✅ Message saved to database for session: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to save message to database:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }

    console.log(`✅ AI response generated with ${(confidence * 100).toFixed(1)}% confidence using ${aiResponse.provider}`);

    // Use AI response directly without human agent fallback
    let responseContent = aiResponse.message;

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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Return error response with more details in development
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
          details: error.message,
          stack: error.stack
        } : {})
      },
      { status: 500 }
    );
  }
}

// POST /api/chat/feedback
export async function PUT(req: NextRequest) {
  try {
    const { sessionId, messageId, isHelpful, reason } = await req.json();
    if (!sessionId || typeof isHelpful !== 'boolean') {
      return NextResponse.json({ error: 'sessionId and isHelpful required' }, { status: 400 });
    }

    await prisma.feedbackForm.create({
      data: {
        sessionId,
        rating: isHelpful ? 5 : 1,
        feedback: reason || (isHelpful ? 'thumbs_up' : 'thumbs_down'),
        isResolved: isHelpful,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
}

async function saveMessage(sessionId: string, message: string, response: string, queryType: string, processingTime: number, isSuccessful: boolean, kbEntryId: string | null) {
  try {
    console.log(`💾 Saving message for session: ${sessionId}`);
    
    // Ensure session exists
    const session = await prisma.chatSession.upsert({
      where: { sessionId },
      update: { updatedAt: new Date() },
      create: {
        sessionId,
        userAgent: 'Web Browser',
        ipAddress: '0.0.0.0',
        language: 'en'
      }
    });
    console.log(`✅ Session upserted: ${session.sessionId}`);

    // Save the message using raw SQL to bypass Prisma's kbEntryId column validation
    // Prisma Client expects the column to exist even if we don't use it
    console.log('⚠️  Using raw SQL to save message (bypassing Prisma schema validation)');
    
    // Generate a unique ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use raw SQL with parameterized query to insert without kbEntryId
    await prisma.$executeRawUnsafe(`
      INSERT INTO chat_messages (id, "sessionId", message, response, "queryType", "processingTime", "isSuccessful", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, messageId, sessionId, message, response, queryType || null, processingTime || null, isSuccessful);
    
    console.log(`✅ Message inserted with ID: ${messageId}`);
    
    // Retrieve the saved message using raw query to avoid Prisma validation
    const result: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, "sessionId", message, response, "queryType", "processingTime", "isSuccessful", "createdAt"
      FROM chat_messages
      WHERE id = $1
    `, messageId);
    
    if (result && result.length > 0) {
      const savedMessage = result[0];
      console.log(`✅ Message saved and retrieved: ${savedMessage.id}`);
      
      // Return in Prisma format
      return {
        id: savedMessage.id,
        sessionId: savedMessage.sessionId,
        message: savedMessage.message,
        response: savedMessage.response,
        queryType: savedMessage.queryType,
        processingTime: savedMessage.processingTime,
        isSuccessful: savedMessage.isSuccessful,
        createdAt: savedMessage.createdAt,
        kbEntryId: null
      } as any;
    } else {
      throw new Error('Failed to retrieve saved message');
    }
  } catch (error) {
    console.error('❌ Failed to save message:', error);
    console.error('Session ID:', sessionId);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'code' in error) {
      console.error('Error code:', (error as any).code);
    }
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    // Re-throw to let caller handle it
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Oman Airports AI Chat API is running',
    version: '2.0.0',
    features: ['semantic_analysis', 'intent_recognition', 'knowledge_base', 'fallback_responses']
  });
}

// (Removed legacy PUT handler to allow feedback endpoint above)

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 