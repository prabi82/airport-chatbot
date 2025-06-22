import { NextRequest, NextResponse } from 'next/server';
import { WebScraperService } from '@/lib/web-scraper';
import { prisma } from '@/lib/database';

const webScraper = new WebScraperService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, source } = body;

    switch (action) {
      case 'scrape_all':
        const allResults = await webScraper.scrapeAllSources();
        return NextResponse.json({
          success: true,
          message: `Scraped ${allResults.length} items from all sources`,
          results: allResults.map(r => ({
            source: r.source,
            title: r.title,
            category: r.category,
            relevance: r.relevance
          }))
        });

      case 'scrape_source':
        if (!source) {
          return NextResponse.json(
            { success: false, error: 'Source name required' },
            { status: 400 }
          );
        }
        
        // This would require implementing source selection by name
        return NextResponse.json({
          success: false,
          error: 'Source-specific scraping not implemented yet'
        });

      case 'cleanup':
        await webScraper.cleanup();
        return NextResponse.json({
          success: true,
          message: 'Cleanup completed successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Scraper API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health':
        const health = await webScraper.getSourceHealth();
        return NextResponse.json({
          success: true,
          sources: health
        });

      case 'cache_stats':
        const cacheStats = await getCacheStatistics();
        return NextResponse.json({
          success: true,
          statistics: cacheStats
        });

      case 'cached_content':
        const limit = parseInt(searchParams.get('limit') || '20');
        const category = searchParams.get('category');
        
        const cachedContent = await getCachedContent(limit, category);
        return NextResponse.json({
          success: true,
          content: cachedContent
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Scraper API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getCacheStatistics() {
  try {
    const total = await prisma.scrapingCache.count();
    const active = await prisma.scrapingCache.count({
      where: {
        expiresAt: { gt: new Date() }
      }
    });
    const expired = total - active;

    const bySource = await prisma.scrapingCache.groupBy({
      by: ['sourceUrl'],
      where: {
        expiresAt: { gt: new Date() }
      },
      _count: {
        id: true
      }
    });

    const oldestEntry = await prisma.scrapingCache.findFirst({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        createdAt: true
      }
    });

    const newestEntry = await prisma.scrapingCache.findFirst({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        createdAt: true
      }
    });

    return {
      total,
      active,
      expired,
      bySource: bySource.map((item: any) => ({
        source: item.sourceUrl,
        count: item._count.id
      })),
      oldestEntry: oldestEntry?.createdAt,
      newestEntry: newestEntry?.createdAt
    };

  } catch (error) {
    console.error('Error getting cache statistics:', error);
    return {
      total: 0,
      active: 0,
      expired: 0,
      bySource: [],
      oldestEntry: null,
      newestEntry: null
    };
  }
}

async function getCachedContent(limit: number, category?: string | null) {
  try {
    const whereClause: any = {
      expiresAt: { gt: new Date() }
    };

    if (category) {
      whereClause.scrapedData = {
        path: ['category'],
        equals: category
      };
    }

    const cached = await prisma.scrapingCache.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      select: {
        id: true,
        sourceUrl: true,
        scrapedData: true,
        createdAt: true,
        expiresAt: true
      }
    });

    return cached.map((item: any) => ({
      id: item.id,
      sourceUrl: item.sourceUrl,
      data: item.scrapedData,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt
    }));

  } catch (error) {
    console.error('Error getting cached content:', error);
    return [];
  }
} 