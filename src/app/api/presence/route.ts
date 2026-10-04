import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/presence — Update user presence (heartbeat)
export async function POST(request: NextRequest) {
  try {
    const { userId, isOnline } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    await db.userPresence.upsert({
      where: { userId },
      update: { isOnline: isOnline !== false, lastSeen: new Date(), updatedAt: new Date() },
      create: { userId, isOnline: isOnline !== false, lastSeen: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/presence?userIds=id1,id2,id3 — Get presence for multiple users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userIds = searchParams.get('userIds');

  if (!userIds) {
    return NextResponse.json({ error: 'userIds requis' }, { status: 400 });
  }

  const ids = userIds.split(',').filter(Boolean);
  const presences = await db.userPresence.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, isOnline: true, lastSeen: true },
  });

  // Map for easy lookup
  const presenceMap: Record<string, { isOnline: boolean; lastSeen: Date }> = {};
  for (const p of presences) {
    // Consider user offline if last seen > 2 minutes ago
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    presenceMap[p.userId] = {
      isOnline: p.isOnline && p.lastSeen > twoMinAgo,
      lastSeen: p.lastSeen,
    };
  }

  return NextResponse.json({ presences: presenceMap });
}
