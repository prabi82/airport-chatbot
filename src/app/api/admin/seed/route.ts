import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/knowledge-base';

const knowledgeBase = new KnowledgeBaseService();

export async function POST(request: NextRequest) {
  try {
    // Seed initial knowledge base data
    await knowledgeBase.seedInitialData();

    return NextResponse.json({
      success: true,
      message: 'Knowledge base seeded successfully'
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed knowledge base' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get knowledge base statistics
    const categories = await knowledgeBase.getCategories('en');
    const arabicCategories = await knowledgeBase.getCategories('ar');

    return NextResponse.json({
      success: true,
      statistics: {
        englishCategories: categories.length,
        arabicCategories: arabicCategories.length,
        totalCategories: categories.length + arabicCategories.length,
        categories: {
          english: categories,
          arabic: arabicCategories
        }
      }
    });

  } catch (error) {
    console.error('Statistics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
} 