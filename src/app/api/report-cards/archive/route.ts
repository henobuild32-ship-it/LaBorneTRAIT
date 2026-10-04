import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId || schoolId === 'undefined' || schoolId === 'null') {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const reportCards = await db.reportCard.findMany({
      where: { schoolId },
      include: {
        class: {
          select: { name: true }
        },
        student: {
          select: { fullName: true, photoUrl: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ reportCards });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to fetch archive' }, { status: 500 });
  }
}
