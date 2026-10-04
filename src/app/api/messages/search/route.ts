import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/messages/search?userId=xxx&schoolId=xxx&q=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const schoolId = searchParams.get('schoolId');
  const q = searchParams.get('q');

  if (!userId || !q?.trim()) {
    return NextResponse.json({ error: 'userId et q requis' }, { status: 400 });
  }

  const searchTerm = q.trim();

  const messages = await db.message.findMany({
    where: {
      schoolId: schoolId || undefined,
      content: { contains: searchTerm, mode: 'insensitive' },
      deletedAt: null,
      OR: [
        { senderId: userId },
        { recipientId: userId },
      ],
    },
    include: {
      sender: { select: { id: true, fullName: true, photoUrl: true } },
      recipient: { select: { id: true, fullName: true, photoUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ messages });
}
