import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET    /api/ai/search-history?userId=xxx&search=xxx – liste l'historique de recherche
// POST   /api/ai/search-history                        – enregistre une recherche
// DELETE /api/ai/search-history?id=xxx&userId=xxx      – supprime une recherche
// DELETE /api/ai/search-history?deleteAll=true&userId= – vide l'historique

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const search = searchParams.get('search');
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 });

  const where: Record<string, unknown> = { userId };
  if (search) where.query = { contains: search, mode: 'insensitive' };

  const history = await db.aiSearchHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, schoolId, query, resultSummary } = await request.json();
    if (!userId || !query?.trim()) {
      return NextResponse.json({ error: 'userId et query requis' }, { status: 400 });
    }
    const entry = await db.aiSearchHistory.create({
      data: {
        userId,
        schoolId: schoolId || '',
        query: query.trim().slice(0, 1000),
        resultSummary: (resultSummary || '').slice(0, 5000),
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating search history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('userId');
  const deleteAll = searchParams.get('deleteAll');

  if (deleteAll === 'true' && userId) {
    await db.aiSearchHistory.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true, deleted: 'all' });
  }

  if (!id || !userId) return NextResponse.json({ error: 'id et userId requis' }, { status: 400 });

  await db.aiSearchHistory.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
