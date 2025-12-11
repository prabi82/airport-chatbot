import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { requireAuth, hasPermission } from '@/lib/auth-middleware';

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    
    if (!auth.admin) {
      return auth.response || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only super_admin can view all users
    if (!hasPermission(auth.admin, 'user_management') && auth.admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const users = await adminService.getAllUsers();
    
    // Users already don't have password (it's excluded in getAllUsers)
    // Just return the users as-is
    return NextResponse.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    
    if (!auth.admin) {
      return auth.response || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only super_admin can create users
    if (auth.admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can create users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, name, role, permissions } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await adminService.createUser({
      email,
      password,
      name,
      role: role || 'admin',
      permissions: permissions || []
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user. Email may already exist.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

