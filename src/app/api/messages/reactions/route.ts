import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/messages/reactions — Toggle a reaction on a message
export async function POST(request: NextRequest) {
  try {
    const { messageId, userId, emoji } = await request.json();
    if (!messageId || !userId || !emoji) {
      return NextResponse.json({ error: 'messageId, userId, emoji requis' }, { status: 400 });
    }

    // Check if reaction already exists
    const existing = await db.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      // Remove reaction (toggle off)
      await db.messageReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: 'removed', emoji });
    } else {
      // Add reaction (toggle on)
      await db.messageReaction.create({
        data: { messageId, userId, emoji },
      });
      return NextResponse.json({ action: 'added', emoji }, { status: 201 });
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/messages/reactions?messageId=xxx — Get reactions for a message
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');
  if (!messageId) {
    return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
  }

  const reactions = await db.messageReaction.findMany({
    where: { messageId },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by emoji
  const grouped: Record<string, { count: number; users: string[]; hasOwn: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { count: 0, users: [], hasOwn: false };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user.fullName);
  }

  return NextResponse.json({ reactions: grouped });
}

// DELETE /api/messages/reactions?id=xxx&userId=xxx — Remove a specific reaction
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('userId');
  if (!id || !userId) {
    return NextResponse.json({ error: 'id et userId requis' }, { status: 400 });
  }

  await db.messageReaction.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
