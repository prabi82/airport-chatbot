import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { prisma } from '@/lib/database';

// GET - list unanswered queries that had no KB grounding
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const items = await adminService.getUnansweredQueries(limit);

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error('Unanswered queries GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch unanswered queries' }, { status: 500 });
  }
}

// PATCH - mark a question as resolved
export async function PATCH(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question) {
      return NextResponse.json({ success: false, error: 'question is required' }, { status: 400 });
    }

    await adminService.markUnansweredResolved(question);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unanswered PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Failed to resolve' }, { status: 500 });
  }
}

// DELETE - permanently delete irrelevant questions
export async function DELETE(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question) {
      return NextResponse.json({ success: false, error: 'question is required' }, { status: 400 });
    }

    // Delete all chat messages with this specific question that have queryType 'no_kb'
    await prisma.chatMessage.deleteMany({
      where: {
        message: question,
        queryType: 'no_kb'
      }
    });

    return NextResponse.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Unanswered DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 });
  }
} 