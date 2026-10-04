import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyUser } from '@/services/notifications/notificationEngine';

export const runtime = 'nodejs';

// POST /api/messages/reply — Reply to a message
export async function POST(request: NextRequest) {
  try {
    const { senderId, recipientId, content, schoolId, replyToId } = await request.json();
    if (!senderId || !recipientId || !content?.trim() || !schoolId || !replyToId) {
      return NextResponse.json(
        { error: 'senderId, recipientId, content, schoolId, replyToId requis' },
        { status: 400 }
      );
    }

    // Verify the original message exists
    const originalMessage = await db.message.findUnique({ where: { id: replyToId } });
    if (!originalMessage) {
      return NextResponse.json({ error: 'Message original non trouvé' }, { status: 404 });
    }

    const message = await db.message.create({
      data: {
        schoolId,
        senderId,
        recipientId,
        content: content.trim(),
        replyToId,
      },
      include: {
        sender: { select: { id: true, fullName: true, photoUrl: true, role: true } },
        recipient: { select: { id: true, fullName: true, photoUrl: true, role: true } },
        replyTo: {
          include: { sender: { select: { id: true, fullName: true } } },
        },
      },
    });

    // Notify recipient
    try {
      await notifyUser({
        schoolId,
        userId: recipientId,
        title: 'Nouvelle réponse',
        message: `Vous avez reçu une réponse de ${message.sender.fullName}`,
        type: 'MESSAGE',
      });
    } catch { /* non-blocking */ }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error replying to message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
