import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

// Rate limiting: max 10 validations par minute par IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'PARENT') {
      return NextResponse.json({ valid: false, error: 'Accès non autorisé' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ valid: false, error: 'Trop de tentatives. Réessayez dans une minute.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('parentCode')?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ valid: false });
    }

    const student = await db.user.findFirst({ where: { parentCode: code, role: 'STUDENT', active: true }, include: { school: { select: { name: true } } } });

    if (student) {
      return NextResponse.json({ valid: true, studentName: student.fullName, schoolName: student.school.name });
    }

    return NextResponse.json({ valid: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ valid: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ valid: false, error: 'Erreur serveur' }, { status: 500 });
  }
}
