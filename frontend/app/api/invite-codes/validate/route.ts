import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/client';

/**
 * DEPRECATED: This API route is deprecated.
 * Please use the backend NestJS API directly via @/lib/api
 * 
 * This route proxies to the backend API for backward compatibility.
 * The backend API is available at: /api/invite-codes/validate
 */

/**
 * POST /api/invite-codes/validate
 * 验证邀请码是否有效（公开接口）
 * Proxies to backend API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code format' },
        { status: 400 }
      );
    }

    // Proxy to backend API
    const response = await fetch(`${API_BASE_URL}/invite-codes/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to backend:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate invite code' },
      { status: 500 }
    );
  }
}

