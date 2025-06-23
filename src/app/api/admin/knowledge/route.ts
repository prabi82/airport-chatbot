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
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Get knowledge base entries
    const entries = await adminService.getKnowledgeBase(category || undefined, search || undefined);
    
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

    // Format entries for frontend
    const formattedEntries = entries.slice(0, limit).map(entry => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      subcategory: entry.subcategory,
      priority: entry.priority,
      sourceUrl: entry.sourceUrl,
      lastUpdated: entry.updatedAt.toISOString(),
      keywords: entry.keywords
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
        hasMore: entries.length > limit
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
    const { category, subcategory, question, answer, keywords, priority, sourceUrl } = body;

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
      priority: priority || 1
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
    const { id, category, subcategory, question, answer, keywords, priority, isActive } = body;

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
