// Knowledge API 

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { prisma } from '@/lib/database';

// GET - Retrieve knowledge base entries with enhanced data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sourceUrl = searchParams.get('sourceUrl');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build where clause for filtering
    const where: any = { isActive: true };
    if (category) where.category = category;
    if (sourceUrl) where.sourceUrl = sourceUrl;
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
        { keywords: { has: search } }
      ];
    }
    
    // Get knowledge base entries
    const entries = await prisma.knowledgeBase.findMany({
      where,
      select: {
        id: true,
        category: true,
        subcategory: true,
        question: true,
        answer: true,
        keywords: true,
        sourceUrl: true,
        dataSource: true,
        priority: true,
        updatedAt: true
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: limit
    });
    
    // Get category statistics
    const stats = await prisma.knowledgeBase.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    // Get total count
    const totalEntries = await prisma.knowledgeBase.count({
      where: { isActive: true }
    });

    // Skip hit counts for now - can be implemented later when chat messages exist
    const countMap: Record<string, number> = {};

    // Format entries for frontend
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      subcategory: entry.subcategory,
      priority: entry.priority,
      sourceUrl: entry.sourceUrl,
      dataSource: entry.dataSource || 'manual',
      lastUpdated: entry.updatedAt.toISOString(),
      keywords: entry.keywords,
      hits: countMap[entry.id] || 0
    }));

    return NextResponse.json({
      success: true,
      items: formattedEntries,
      stats: stats.map(stat => ({
        category: stat.category,
        count: stat._count.id
      })),
      totalEntries,
      pagination: {
        total: entries.length,
        limit,
        hasMore: entries.length >= limit
      }
    });

  } catch (error) {
    console.error('Knowledge GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch knowledge base' },
      { status: 500 }
    );
  }
}

// POST - Create new knowledge base entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, subcategory, question, answer, keywords, priority, sourceUrl, dataSource } = body;

    // Validate required fields
    if (!category || !question || !answer) {
      return NextResponse.json(
        { success: false, error: 'Category, question, and answer are required' },
        { status: 400 }
      );
    }

    // Create the entry
    const entry = await adminService.createKnowledgeEntry({
      category,
      subcategory,
      question,
      answer,
      keywords: keywords || [],
      priority: priority || 1,
      sourceUrl,
      dataSource: dataSource || 'manual'
    });

    if (entry) {
    return NextResponse.json({
      success: true,
      message: 'Knowledge entry created successfully',
        data: {
          id: entry.id,
          category: entry.category,
          question: entry.question,
          answer: entry.answer
        }
    });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create knowledge entry' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Knowledge POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update existing knowledge base entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, category, subcategory, question, answer, keywords, priority, sourceUrl, dataSource, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const entry = await adminService.updateKnowledgeEntry(id, {
      category,
      subcategory,
      question,
      answer,
      keywords,
      priority,
      sourceUrl,
      dataSource,
      isActive
    });

    if (entry) {
    return NextResponse.json({
      success: true,
      message: 'Knowledge entry updated successfully',
      data: entry
    });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update knowledge entry' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Knowledge PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete knowledge base entry
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const success = await adminService.deleteKnowledgeEntry(id);

    if (success) {
    return NextResponse.json({
      success: true,
      message: 'Knowledge entry deleted successfully'
    });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to delete knowledge entry' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Knowledge DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk delete knowledge base entries
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required' },
        { status: 400 }
      );
    }

    const deletedCount = await adminService.deleteKnowledgeEntries(ids);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} entries successfully`,
      deletedCount
    });
  } catch (error) {
    console.error('Knowledge PATCH bulk delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
