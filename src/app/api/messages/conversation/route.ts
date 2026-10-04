import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Get messages between two users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId1 = searchParams.get('userId1');
    const userId2 = searchParams.get('userId2');
    const schoolId = searchParams.get('schoolId');

    if (!userId1 || !userId2 || !schoolId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Mark received messages as read
    await db.message.updateMany({
      where: {
        schoolId,
        senderId: userId2,
        recipientId: userId1,
        read: false,
      },
      data: {
        read: true,
      },
    });

    // Get all messages between the two users
    const messages = await db.message.findMany({
      where: {
        schoolId,
        AND: [
          {
            OR: [
              { AND: [{ senderId: userId1 }, { recipientId: userId2 }] },
              { AND: [{ senderId: userId2 }, { recipientId: userId1 }] },
            ],
          },
        ],
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, photoUrl: true },
        },
        recipient: {
          select: { id: true, fullName: true, role: true, photoUrl: true },
        },
        replyTo: {
          include: {
            sender: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
