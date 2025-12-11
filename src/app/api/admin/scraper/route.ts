import { NextRequest, NextResponse } from 'next/server';
import { webScraperService } from '@/lib/web-scraper';
import { prisma } from '@/lib/database';

// GET - Get scraping history and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50'); // Increased default from 10 to 50
    
    // Get recent scraping history with entry counts
    const scrapingHistory = await prisma.scrapingCache.findMany({
      orderBy: { lastScraped: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        title: true,
        lastScraped: true,
        createdAt: true
      }
    });

    // Get knowledge base entry counts for each source
    const scrapingHistoryWithCounts = await Promise.all(
      scrapingHistory.map(async (item) => {
        const entryCount = await prisma.knowledgeBase.count({
          where: {
            sourceUrl: item.url,
            isActive: true
          }
        });
        
        return {
          ...item,
          entryCount
        };
      })
    );

    // Get knowledge base stats
    const knowledgeStats = await prisma.knowledgeBase.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        scrapingHistory: scrapingHistoryWithCounts,
        knowledgeStats: knowledgeStats.map(stat => ({
          category: stat.category,
          count: stat._count.id
        })),
        totalEntries: await prisma.knowledgeBase.count({ where: { isActive: true } })
      }
    });

  } catch (error) {
    console.error('Scraper GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scraper data' },
      { status: 500 }
    );
  }
}

// POST - Submit URL for scraping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, category } = body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`🕷️ Starting scraping process for: ${url}`);

    // Check if URL was recently scraped
    const recentScrape = await prisma.scrapingCache.findFirst({
      where: {
        url,
        lastScraped: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    if (recentScrape) {
      return NextResponse.json({
        success: false,
        error: 'URL was scraped recently. Please wait 24 hours before re-scraping.',
        lastScraped: recentScrape.lastScraped
      });
    }

    // Perform scraping
    const result = await webScraperService.scrapeAndProcess(url);

    if (result.success) {
      // Log the successful scraping
      console.log(`✅ Successfully scraped ${url} - Created ${result.entriesCreated} knowledge entries`);
      
      return NextResponse.json({
        success: true,
        message: `Successfully scraped website and created ${result.entriesCreated} knowledge base entries`,
        data: {
          url,
          entriesCreated: result.entriesCreated,
          scrapedAt: new Date().toISOString()
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to scrape website'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Scraper POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove scraped content and related knowledge entries
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Delete knowledge base entries from this URL
    const deletedKnowledge = await prisma.knowledgeBase.updateMany({
      where: { sourceUrl: url },
      data: { isActive: false }
    });

    // Delete scraping cache entry
    await prisma.scrapingCache.delete({
      where: { url }
    });

    return NextResponse.json({
      success: true,
      message: `Removed ${deletedKnowledge.count} knowledge entries and scraping cache for ${url}`
    });

  } catch (error) {
    console.error('Scraper DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scraped content' },
      { status: 500 }
    );
  }
}

// PUT - Re-scrape existing URL
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Remove existing knowledge entries for this URL
    await prisma.knowledgeBase.updateMany({
      where: { sourceUrl: url },
      data: { isActive: false }
    });

    // Perform fresh scraping
    const result = await webScraperService.scrapeAndProcess(url);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully re-scraped website and created ${result.entriesCreated} updated knowledge base entries`,
        data: {
          url,
          entriesCreated: result.entriesCreated,
          scrapedAt: new Date().toISOString()
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to re-scrape website'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Scraper PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-scrape website' },
      { status: 500 }
    );
  }
} 