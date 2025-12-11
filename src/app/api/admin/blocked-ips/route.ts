import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET /api/admin/blocked-ips - Get all blocked IPs
export async function GET(req: NextRequest) {
  try {
    const blockedIPs = await prisma.blockedIP.findMany({
      orderBy: { createdAt: 'desc' },
      where: { isActive: true }
    });

    return NextResponse.json({ blockedIPs });
  } catch (error: any) {
    console.error('[BlockedIPs API] Error fetching blocked IPs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blocked IPs' },
      { status: 500 }
    );
  }
}

// POST /api/admin/blocked-ips - Block an IP address
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ipAddress, reason, blockedBy, sessionCount } = body;

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }

    // Check if already blocked
    const existing = await prisma.blockedIP.findUnique({
      where: { ipAddress }
    });

    if (existing) {
      // Update existing block
      const updated = await prisma.blockedIP.update({
        where: { ipAddress },
        data: {
          reason: reason || existing.reason,
          blockedBy: blockedBy || existing.blockedBy,
          sessionCount: sessionCount ?? existing.sessionCount,
          isActive: true,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'IP address blocked successfully',
        blockedIP: updated
      });
    }

    // Create new block
    const blockedIP = await prisma.blockedIP.create({
      data: {
        ipAddress,
        reason: reason || 'Bot activity detected',
        blockedBy: blockedBy || 'admin',
        sessionCount: sessionCount || 0,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'IP address blocked successfully',
      blockedIP
    });
  } catch (error: any) {
    console.error('[BlockedIPs API] Error blocking IP:', error);
    return NextResponse.json(
      { error: 'Failed to block IP address' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/blocked-ips - Unblock an IP address
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ipAddress = searchParams.get('ipAddress');

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }

    const blockedIP = await prisma.blockedIP.findUnique({
      where: { ipAddress }
    });

    if (!blockedIP) {
      return NextResponse.json(
        { error: 'IP address not found in blocked list' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.blockedIP.update({
      where: { ipAddress },
      data: { isActive: false, updatedAt: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: 'IP address unblocked successfully'
    });
  } catch (error: any) {
    console.error('[BlockedIPs API] Error unblocking IP:', error);
    return NextResponse.json(
      { error: 'Failed to unblock IP address' },
      { status: 500 }
    );
  }
}

