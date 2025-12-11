import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const items = await prisma.feedbackForm.findMany({
      where: { rating: 1 },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, sessionId: true, rating: true, feedback: true, createdAt: true }
    });

    // For each session, fetch last few Q&A pairs
    const sessions = await prisma.chatMessage.groupBy({
      by: ['sessionId'],
      _max: { createdAt: true }
    });

    // Map sessionId -> recent messages
    const details: Record<string, any[]> = {};
    for (const it of items) {
      const msgs = await prisma.chatMessage.findMany({
        where: { sessionId: it.sessionId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, message: true, response: true, createdAt: true, queryType: true, isSuccessful: true }
      });
      details[it.sessionId] = msgs.reverse();
    }

    return NextResponse.json({ items, details });
  } catch (e) {
    return NextResponse.json({ items: [], error: 'Failed to load feedback' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, rating, feedback } = await req.json();

    if (!sessionId || rating === undefined) {
      return NextResponse.json({ error: 'sessionId and rating are required' }, { status: 400 });
    }

    const feedbackEntry = await prisma.feedbackForm.create({
      data: {
        sessionId,
        rating: rating,
        feedback: feedback || null
      }
    });

    return NextResponse.json({ success: true, id: feedbackEntry.id });
  } catch (e) {
    console.error('Feedback POST error:', e);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, ids } = await req.json();
    const targetIds: string[] = Array.isArray(ids) ? ids : (id ? [id] : []);
    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
    }
    const res = await prisma.feedbackForm.deleteMany({ where: { id: { in: targetIds } } });
    return NextResponse.json({ success: true, deletedCount: res.count });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}


