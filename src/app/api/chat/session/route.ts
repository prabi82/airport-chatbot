import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Session API endpoint called');
    
    // Parse request body
    const body = await request.json();
    const { userAgent, language = 'en' } = body;

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Try to create session in database
      const session = await prisma.chatSession.create({
        data: {
          sessionId,
          userAgent: userAgent || 'Unknown',
          ipAddress,
          language
        }
      });

      console.log(`✅ Session created: ${sessionId}`);

      return NextResponse.json({
        success: true,
        sessionId: session.sessionId,
        message: 'Session created successfully'
      });

    } catch (dbError) {
      console.warn('Database session creation failed, using fallback:', dbError);
      
      // Fallback: return session ID without database storage
      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Session created (fallback mode)'
      });
    }

  } catch (error) {
    console.error('💥 Error in session API:', error);

    // Generate session ID even if everything fails
    const fallbackSessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json({
      success: true,
      sessionId: fallbackSessionId,
      message: 'Session created (emergency fallback)'
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    try {
      // Try to get session from database
      const session = await prisma.chatSession.findUnique({
        where: { sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50 // Last 50 messages
          }
        }
      });

      if (session) {
        return NextResponse.json({
          success: true,
          session: {
            id: session.sessionId,
            language: session.language,
            createdAt: session.createdAt,
            messageCount: session.messages.length
          },
          messages: session.messages.map((msg: any) => ({
            id: msg.id,
            message: msg.message,
            response: msg.response,
            createdAt: msg.createdAt,
            queryType: msg.queryType
          }))
        });
      } else {
        return NextResponse.json({
          success: true,
          session: { id: sessionId, language: 'en', messageCount: 0 },
          messages: []
        });
      }

    } catch (dbError) {
      console.warn('Database session retrieval failed:', dbError);
      
      // Fallback response
      return NextResponse.json({
        success: true,
        session: { id: sessionId, language: 'en', messageCount: 0 },
        messages: []
      });
    }

  } catch (error) {
    console.error('💥 Error retrieving session:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 