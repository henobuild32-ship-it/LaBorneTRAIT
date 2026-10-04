import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/logout:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
