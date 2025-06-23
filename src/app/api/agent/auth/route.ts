import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/agent-service';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await agentService.authenticateAgent(email, password);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: result.agent,
      token: result.token
    });

  } catch (error) {
    console.error('Agent auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// Agent Registration (for admin use)
export async function PUT(request: NextRequest) {
  try {
    const { name, email, password, role, skills, maxChats } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    const agent = await agentService.registerAgent({
      name,
      email,
      password,
      role,
      skills,
      maxChats
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Registration failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      agent
    });

  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
} 