import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import path from 'path';
import { createRequire } from 'module';

// Safely load geoip-lite with error handling
let geoip: any = null;
try {
  // Try multiple paths for geoip-lite data directory (works in both dev and production)
  const possiblePaths = [
    path.resolve(process.cwd(), 'node_modules/geoip-lite/data'),
    path.resolve(process.cwd(), '.next/server/node_modules/geoip-lite/data'),
    path.resolve(process.cwd(), '.next/standalone/node_modules/geoip-lite/data'),
    path.join(__dirname, '../../../../node_modules/geoip-lite/data'),
    path.join(__dirname, '../../../node_modules/geoip-lite/data'),
  ];
  
  let geoDataDir: string | null = null;
  const require = createRequire(import.meta.url);
  const fs = require('fs');
  
  for (const possiblePath of possiblePaths) {
    try {
      if (fs.existsSync(possiblePath)) {
        geoDataDir = possiblePath;
        break;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // If no path found, try to find it via require.resolve
  if (!geoDataDir) {
    try {
      const geoipPath = require.resolve('geoip-lite');
      geoDataDir = path.join(path.dirname(geoipPath), 'data');
      if (!fs.existsSync(geoDataDir)) {
        geoDataDir = null;
      }
    } catch (e) {
      // Fallback
    }
  }
  
  if (geoDataDir) {
    process.env.GEODATADIR = geoDataDir;
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).geodatadir = geoDataDir;
    }
    console.log('[Sessions API] GeoIP data directory found:', geoDataDir);
  } else {
    console.warn('[Sessions API] GeoIP data directory not found, trying default paths');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  geoip = require('geoip-lite') as typeof import('geoip-lite');
  console.log('[Sessions API] GeoIP-lite loaded successfully');
} catch (geoipError: any) {
  console.error('[Sessions API] Failed to load geoip-lite:', geoipError?.message || geoipError);
  console.error('[Sessions API] Error details:', {
    code: geoipError?.code,
    stack: geoipError?.stack?.split('\n').slice(0, 3)
  });
  // Continue without geoip - country resolution will return null
}

// Safely initialize regionNames
let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch (error) {
  console.warn('[Sessions API] Failed to initialize Intl.DisplayNames:', error);
  regionNames = null;
}

function isPrivateIp(ip: string) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('127.') ||
    ip === '::1' ||
    ip === '0.0.0.0'
  );
}

// Fallback: Use external API for IP geolocation when geoip-lite fails
async function resolveCountryViaAPI(ipAddress: string): Promise<string | null> {
  try {
    // Use ip-api.com (free tier: 45 requests/minute, no API key needed)
    // Use HTTPS to avoid mixed content issues
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://ip-api.com/json/${ipAddress}?fields=status,country,countryCode`, {
      headers: {
        'User-Agent': 'Oman-Airports-Chatbot/1.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.country && data.countryCode) {
        return `${data.country} (${data.countryCode})`;
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.warn('[Sessions API] External API fallback failed:', error?.message || error);
    }
  }
  
  return null;
}

function resolveCountry(ipAddress?: string | null): string | null {
  try {
    if (!ipAddress) {
      return null;
    }
    
    const normalizedIp = ipAddress.trim();
    if (!normalizedIp || isPrivateIp(normalizedIp)) {
      return 'Private / Local Network';
    }
    
    // Try geoip-lite first (faster, no API call)
    if (geoip) {
      try {
        const lookup = geoip.lookup(normalizedIp);
        if (lookup?.country) {
          let countryName = lookup.country;
          try {
            if (regionNames) {
              countryName = regionNames.of(lookup.country) || lookup.country;
            }
          } catch {
            countryName = lookup.country;
          }
          return `${countryName} (${lookup.country})`;
        }
      } catch (geoipError: any) {
        console.warn('[Sessions API] GeoIP lookup failed:', geoipError?.message);
      }
    } else {
      console.warn('[Sessions API] GeoIP module not loaded');
    }
    
    // Return null - will be resolved via async API call in the mapping function
    return null;
  } catch (error: any) {
    console.error('[Sessions API] Country resolution error:', error?.message || error);
    return null;
  }
}

// GET /api/admin/sessions
export async function GET(req: NextRequest) {
  console.log('[Sessions API] GET request received at', new Date().toISOString());
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    if (sessionId) {
      // Return all Q&A pairs for a given sessionId
      const session = await prisma.chatSession.findUnique({
        where: { sessionId },
        select: {
          sessionId: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              message: true,
              response: true,
              createdAt: true,
              queryType: true,
              isSuccessful: true,
            },
          },
        },
      });
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ session: { ...session, country: resolveCountry(session.ipAddress) } });
    }

    // Paginated list of sessions - only show sessions with messages
    // Using simplified approach for maximum reliability
    console.log('[Sessions API] Fetching sessions with messages filter...');
    
    try {
      // First, test database connection
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('[Sessions API] Database connection OK');
      } catch (dbTestError: any) {
        console.error('[Sessions API] Database connection test failed:', dbTestError);
        // Return 200 with empty array instead of 500 to prevent frontend crashes
        return NextResponse.json({
          sessions: [],
          total: 0,
          page: page || 1,
          pageSize: pageSize || 20,
          error: 'Database connection failed',
          details: process.env.NODE_ENV === 'development' ? dbTestError.message : undefined
        }, { status: 200 }); // Changed from 500 to 200
      }

      // Get unique session IDs that have messages - try multiple methods
      let sessionIds: string[] = [];
      
      // Method 1: Try Prisma findMany (most reliable)
      try {
        console.log('[Sessions API] Method 1: Trying Prisma findMany...');
        const allMessages = await prisma.chatMessage.findMany({
          select: { sessionId: true },
          take: 5000, // Increased limit
        });
        const uniqueIds = [...new Set(allMessages.map(m => m.sessionId).filter((id: string | null) => id && id.trim() !== ''))];
        sessionIds = uniqueIds;
        console.log('[Sessions API] Prisma method successful, found', sessionIds.length, 'session IDs');
      } catch (prismaError: any) {
        console.error('[Sessions API] Prisma findMany failed:', prismaError?.message || prismaError);
        console.error('[Sessions API] Error code:', prismaError?.code);
        console.error('[Sessions API] Error meta:', prismaError?.meta);
        
        // Method 2: Try raw SQL as fallback
        try {
          console.log('[Sessions API] Method 2: Attempting raw SQL query...');
          const result: any[] = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT "sessionId" 
            FROM chat_messages 
            WHERE "sessionId" IS NOT NULL
            LIMIT 5000
          `);
          sessionIds = result.map((m: any) => m.sessionId || m.sessionid).filter((id: string) => id && id.trim() !== '');
          console.log('[Sessions API] Raw SQL successful, found', sessionIds.length, 'session IDs');
        } catch (sqlError: any) {
          console.error('[Sessions API] Raw SQL also failed:', sqlError?.message || sqlError);
          
          // Method 3: Just return empty - better than crashing
          console.log('[Sessions API] All methods failed, returning empty result');
          return NextResponse.json({
            sessions: [],
            total: 0,
            page,
            pageSize,
            error: 'Unable to query sessions',
            details: process.env.NODE_ENV === 'development' ? sqlError?.message : undefined
          }, { status: 200 }); // Return 200 with empty array instead of 500
        }
      }
      
      console.log(`[Sessions API] Found ${sessionIds.length} unique session IDs with messages`);
      
      // If no sessions have messages, return empty
      if (sessionIds.length === 0) {
        console.log('[Sessions API] No sessions with messages found');
        return NextResponse.json({
          sessions: [],
          total: 0,
          page,
          pageSize,
        });
      }
      
      // Now fetch the sessions with pagination
      // Limit sessionIds array to avoid "too many parameters" error in production
      const limitedSessionIds = sessionIds.slice(0, 1000);
      console.log('[Sessions API] Fetching sessions for', limitedSessionIds.length, 'session IDs');
      
      let sessions: any[] = [];
      let total = 0;
      
      try {
        [sessions, total] = await Promise.all([
          prisma.chatSession.findMany({
            where: {
              sessionId: {
                in: limitedSessionIds,
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
              sessionId: true,
              userAgent: true,
              ipAddress: true,
              createdAt: true,
              updatedAt: true,
              isActive: true,
              needsHuman: true,
              messages: {
                select: { id: true },
              },
            },
          }),
          prisma.chatSession.count({
            where: {
              sessionId: {
                in: limitedSessionIds,
              },
            },
          }),
        ]);
        console.log('[Sessions API] Successfully fetched', sessions.length, 'sessions');
      } catch (fetchError: any) {
        console.error('[Sessions API] Error fetching sessions:', fetchError);
        console.error('[Sessions API] Fetch error details:', {
          message: fetchError?.message,
          code: fetchError?.code,
          meta: fetchError?.meta
        });
        // Return empty result instead of crashing
        return NextResponse.json({
          sessions: [],
          total: 0,
          page,
          pageSize,
          error: 'Failed to fetch session details',
          details: process.env.NODE_ENV === 'development' ? fetchError?.message : undefined
        }, { status: 200 });
      }

      console.log(`[Sessions API] Found ${sessions.length} sessions (total: ${total})`);
      
      // Debug: Log first few session IDs found
      if (sessions.length > 0) {
        console.log(`[Sessions API] Sample session IDs: ${sessions.slice(0, 3).map(s => s.sessionId).join(', ')}`);
      }

      // Get session counts per IP for bot detection (improved - check multiple time windows)
      const ipSessionCounts: Record<string, number> = {};
      const ipTotalCounts: Record<string, number> = {}; // Total sessions (all time)
      try {
        // Last 24 hours
        const ipCounts24h = await prisma.chatSession.groupBy({
          by: ['ipAddress'],
          where: {
            ipAddress: { not: null },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          _count: {
            sessionId: true
          }
        });

        ipCounts24h.forEach((item) => {
          if (item.ipAddress) {
            ipSessionCounts[item.ipAddress] = item._count.sessionId;
          }
        });

        // Total sessions (all time) for better detection
        const ipCountsTotal = await prisma.chatSession.groupBy({
          by: ['ipAddress'],
          where: {
            ipAddress: { not: null }
          },
          _count: {
            sessionId: true
          }
        });

        ipCountsTotal.forEach((item) => {
          if (item.ipAddress) {
            ipTotalCounts[item.ipAddress] = item._count.sessionId;
          }
        });
      } catch (error) {
        console.warn('[Sessions API] Failed to get IP session counts:', error);
      }

      // Get blocked IPs
      const blockedIPs = new Set<string>();
      try {
        const blocked = await prisma.blockedIP.findMany({
          where: { isActive: true },
          select: { ipAddress: true }
        });
        blocked.forEach(b => blockedIPs.add(b.ipAddress));
      } catch (error) {
        console.warn('[Sessions API] Failed to get blocked IPs:', error);
      }

      // Map to include message count - with comprehensive error handling
      // Resolve countries with API fallback if geoip-lite fails
      const sessionList: any[] = [];
      for (const s of sessions) {
        try {
          // Safely get country - try geoip-lite first, then external API
          let country = null;
          try {
            country = s.ipAddress ? resolveCountry(s.ipAddress) : null;
            // If geoip-lite failed (returned null) and IP is not private, try external API
            if (!country && s.ipAddress && !isPrivateIp(s.ipAddress.trim())) {
              console.log(`[Sessions API] GeoIP-lite failed for ${s.ipAddress}, trying external API...`);
              country = await resolveCountryViaAPI(s.ipAddress);
            }
          } catch (countryError) {
            console.warn('[Sessions API] Country resolution failed for session:', s.sessionId, countryError);
            country = null;
          }

          // Safely format dates
          let createdAt = new Date().toISOString();
          let updatedAt = new Date().toISOString();
          try {
            if (s.createdAt) {
              createdAt = s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString();
            }
          } catch (dateError) {
            console.warn('[Sessions API] Date formatting error for createdAt:', dateError);
          }
          try {
            if (s.updatedAt) {
              updatedAt = s.updatedAt instanceof Date ? s.updatedAt.toISOString() : new Date(s.updatedAt).toISOString();
            }
          } catch (dateError) {
            console.warn('[Sessions API] Date formatting error for updatedAt:', dateError);
          }

          const ipAddr = s.ipAddress || null;
          const sessionCount24h = ipAddr ? (ipSessionCounts[ipAddr] || 0) : 0;
          const totalSessions = ipAddr ? (ipTotalCounts[ipAddr] || 0) : 0;
          const isBlocked = ipAddr ? blockedIPs.has(ipAddr) : false;
          
          // Improved bot detection:
          // - 10+ sessions in last 24 hours, OR
          // - 50+ total sessions (even if spread over time), OR
          // - 5+ sessions in 24h with very low message count (suspicious pattern)
          const isBot = sessionCount24h >= 10 || 
                       totalSessions >= 50 || 
                       (sessionCount24h >= 5 && s.messages?.length === 0);

          sessionList.push({
            sessionId: s.sessionId || 'unknown',
            userAgent: s.userAgent || null,
            ipAddress: ipAddr,
            createdAt,
            updatedAt,
            isActive: s.isActive ?? true,
            needsHuman: s.needsHuman ?? false,
            messageCount: s.messages?.length || 0,
            country,
            sessionCount: sessionCount24h, // Number of sessions from this IP in last 24h
            totalSessions, // Total sessions from this IP (all time)
            isBlocked, // Whether this IP is blocked
            isBot, // Whether this IP is flagged as bot
          });
        } catch (mapError: any) {
          console.error('[Sessions API] Error mapping session:', mapError);
          console.error('[Sessions API] Session data:', JSON.stringify(s, null, 2));
          // Return minimal safe data
          sessionList.push({
            sessionId: s?.sessionId || 'unknown',
            userAgent: s?.userAgent || null,
            ipAddress: s?.ipAddress || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: s?.isActive ?? true,
            needsHuman: s?.needsHuman ?? false,
            messageCount: s?.messages?.length || 0,
            country: null,
          });
        }
      }

      // Final safety check before returning
      try {
        const response = {
          sessions: sessionList || [],
          total: total || 0,
          page: page || 1,
          pageSize: pageSize || 20,
        };

        console.log('[Sessions API] Returning response with', response.sessions.length, 'sessions');
        
        // Try to stringify to catch any serialization errors
        JSON.stringify(response);
        
        return NextResponse.json(response);
      } catch (responseError: any) {
        console.error('[Sessions API] Error creating response:', responseError);
        console.error('[Sessions API] Response error stack:', responseError?.stack);
        // Return minimal safe response
        return NextResponse.json({
          sessions: [],
          total: 0,
          page: page || 1,
          pageSize: pageSize || 20,
          error: 'Failed to format response',
          details: process.env.NODE_ENV === 'development' ? responseError?.message : undefined
        }, { status: 200 });
      }
    } catch (queryError: any) {
      console.error('[Sessions API] Query error:', queryError);
      console.error('[Sessions API] Error details:', queryError instanceof Error ? queryError.message : String(queryError));
      console.error('[Sessions API] Error stack:', queryError?.stack);
      // Return 200 with empty array instead of 500 to prevent frontend crashes
      return NextResponse.json(
        {
          sessions: [],
          total: 0,
          page: page || 1,
          pageSize: pageSize || 20,
          error: 'Failed to fetch sessions',
          details: process.env.NODE_ENV === 'development' ? (queryError?.message || String(queryError)) : undefined
        },
        { status: 200 } // Changed from 500 to 200
      );
    }
  } catch (error: any) {
    console.error('[Sessions API] Top-level error:', error);
    console.error('[Sessions API] Error type:', error?.constructor?.name);
    console.error('[Sessions API] Error message:', error?.message);
    console.error('[Sessions API] Error stack:', error?.stack);
    console.error('[Sessions API] Error code:', error?.code);
    
    // Return 200 with empty array instead of 500 to prevent frontend crashes
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? (error instanceof Error ? error.message : String(error))
      : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch sessions',
        details: errorDetails,
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 20
      },
      { status: 200 } // Changed from 500 to 200
    );
  }
}

// DELETE /api/admin/sessions
export async function DELETE(req: NextRequest) {
  try {
    const { sessionIds, keepLatest } = await req.json();
    
    // Mode A: explicit list deletion
    if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
      const deleteResult = await prisma.chatSession.deleteMany({
        where: { sessionId: { in: sessionIds } }
      });
      return NextResponse.json({ success: true, message: `Successfully deleted ${deleteResult.count} session(s)`, deletedCount: deleteResult.count });
    }

    // Mode B: keep only latest N sessions (default 100) and delete the rest
    const keepCount = Math.max(1, Math.min(1000, Number(keepLatest) || 100));
    const latest = await prisma.chatSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: keepCount,
      select: { sessionId: true }
    });
    const latestIds = new Set(latest.map(s => s.sessionId));
    const oldSessions = await prisma.chatSession.findMany({
      orderBy: { createdAt: 'asc' },
      select: { sessionId: true },
    });
    const toDelete = oldSessions.map(s => s.sessionId).filter(id => !latestIds.has(id));
    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, message: `No sessions to delete. Latest ${keepCount} retained.` , deletedCount: 0 });
    }
    const deleteOld = await prisma.chatSession.deleteMany({ where: { sessionId: { in: toDelete } } });
    return NextResponse.json({ success: true, message: `Kept ${keepCount} latest sessions. Deleted ${deleteOld.count} older session(s).`, deletedCount: deleteOld.count });

    

  } catch (error) {
    console.error('Error deleting sessions:', error);
    return NextResponse.json({ 
      error: 'Failed to delete sessions' 
    }, { status: 500 });
  }
} 