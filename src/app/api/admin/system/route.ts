// System API 

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { aiService } from '@/lib/ai-service';

// Get System Information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'health':
        const health = await adminService.getSystemHealth();
        return NextResponse.json({
          success: true,
          data: health
        });

      case 'config':
        const config = await adminService.getSystemConfig();
        return NextResponse.json({
          success: true,
          data: config
        });

      default:
        // Return general system info
        const [health2, config2, quotaStatus] = await Promise.all([
          adminService.getSystemHealth(),
          adminService.getSystemConfig(),
          aiService.getAllQuotaStatus()
        ]);

        return NextResponse.json({
          success: true,
          system: {
            health: health2,
            config: config2,
            version: '1.0.0',
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            apiQuotas: quotaStatus
          }
        });
    }

  } catch (error) {
    console.error('System API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system information' },
      { status: 500 }
    );
  }
}

// Update System Configuration
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'restart_service':
        // Simulate service restart
        return NextResponse.json({
          success: true,
          message: `Service ${data.service} restart initiated`
        });

      case 'clear_cache':
        // Simulate cache clearing
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        });

      case 'backup_database':
        // Simulate database backup
        return NextResponse.json({
          success: true,
          message: 'Database backup initiated',
          backupId: `backup_${Date.now()}`
        });

      case 'update_config':
        // Simulate configuration update
        return NextResponse.json({
          success: true,
          message: 'Configuration updated successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('System POST error:', error);
    return NextResponse.json(
      { error: 'System operation failed' },
      { status: 500 }
    );
  }
} 
