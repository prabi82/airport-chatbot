import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { requireAuth, hasPermission } from '@/lib/auth-middleware';

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    
    if (!auth.admin) {
      return auth.response || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only super_admin can update users
    if (auth.admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can update users' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { email, password, name, role, permissions, isActive } = body;

    const user = await adminService.updateUser(id, {
      email,
      password,
      name,
      role,
      permissions,
      isActive
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found or update failed' },
        { status: 404 }
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
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    
    if (!auth.admin) {
      return auth.response || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only super_admin can delete users
    if (auth.admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can delete users' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (auth.admin.id === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const success = await adminService.deleteUser(id);

    if (!success) {
      return NextResponse.json(
        { error: 'User not found or delete failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

