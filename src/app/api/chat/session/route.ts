import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Handle empty body gracefully
    let body: any = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.log('No JSON body provided, using defaults');
    }
    
    const { language = 'en' } = body;

    // Generate a session
    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    console.log(`✅ Session created: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      createdAt,
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
} 