import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/resources/[id]/favorite  -> ajoute un favori (body: userId)
// DELETE /api/resources/[id]/favorite?userId=xxx -> retire le favori

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId requis.' }, { status: 400 });

    const resource = await db.ressource.findUnique({ where: { id } });
    if (!resource) return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 });

    await db.favori.upsert({
      where: { userId_resourceType_resourceId: { userId, resourceType: 'RESSOURCE', resourceId: id } },
      create: { userId, resourceType: 'RESSOURCE', resourceId: id },
      update: {},
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId requis.' }, { status: 400 });

    await db.favori.deleteMany({ where: { userId, resourceType: 'RESSOURCE', resourceId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
