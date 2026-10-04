import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/messages/[id] — Get a single message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const message = await db.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, fullName: true, photoUrl: true, role: true } },
        recipient: { select: { id: true, fullName: true, photoUrl: true, role: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, fullName: true } },
          },
        },
        reactions: {
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/messages/[id] — Edit a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { content, userId } = body;

    if (!content?.trim() || !userId) {
      return NextResponse.json({ error: 'content et userId requis' }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 });
    }
    if (existing.senderId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const message = await db.message.update({
      where: { id },
      data: { content: content.trim(), editedAt: new Date() },
      include: {
        sender: { select: { id: true, fullName: true, photoUrl: true, role: true } },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/messages/[id] — Delete a message (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 });
    }
    if (existing.senderId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    await db.message.update({
      where: { id },
      data: { deletedAt: new Date(), content: 'Message supprimé' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
