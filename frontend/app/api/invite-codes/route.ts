import { NextRequest, NextResponse } from 'next/server';
import { inviteCodeStore } from '@/lib/stores/inviteCodeStore';

/**
 * DEPRECATED: This API route is deprecated.
 * Please use the backend NestJS API directly via @/lib/api
 * 
 * This route is kept for backward compatibility but should not be used in new code.
 * The backend API is available at: /api/admin/invite-codes
 */

// 管理密钥（从环境变量读取，生产环境应该使用更安全的认证）
const ADMIN_KEY = process.env.ADMIN_KEY || 'your-admin-key-here';

/**
 * GET /api/invite-codes
 * 获取所有邀请码（需要管理员权限）
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // 简单认证（生产环境应该使用JWT）
  if (authHeader !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const codes = inviteCodeStore.getAll();

  return NextResponse.json({ codes });
}

/**
 * POST /api/invite-codes
 * 创建邀请码（需要管理员权限）
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    try {
      const inviteCode = inviteCodeStore.create(code, 'admin');
      
      return NextResponse.json({ 
        success: true,
        code: inviteCode.code,
        message: 'Invite code created successfully'
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to create invite code' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/invite-codes
 * 撤销邀请码（需要管理员权限）
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const success = inviteCodeStore.revoke(code);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Invite code not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invite code revoked successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

