import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language = 'en' } = body;

    // Generate a mock session
    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      sessionId,
      createdAt,
      message: 'Demo session created successfully'
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
} 