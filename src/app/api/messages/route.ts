import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyUser } from '@/services/notifications/notificationEngine';

// GET: List conversations for current user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const schoolId = searchParams.get('schoolId');

    if (!userId || !schoolId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Get all messages involving this user in this school
    const messages = await db.message.findMany({
      where: {
        schoolId,
        AND: [
          {
            OR: [
              { senderId: userId },
              { recipientId: userId },
            ],
          },
        ],
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
        recipient: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build unique conversation partners with last message and unread count
    const partnerMap = new Map<string, {
      partnerId: string;
      partnerName: string;
      partnerRole: string;
      lastMessage: string;
      lastMessageAt: string;
      unreadCount: number;
    }>();

    for (const msg of messages) {
      const isSender = msg.senderId === userId;
      const partner = isSender ? msg.recipient : msg.sender;

      if (!partner) continue;

      const key = partner.id;

      if (!partnerMap.has(key)) {
        partnerMap.set(key, {
          partnerId: partner.id,
          partnerName: partner.fullName,
          partnerRole: partner.role,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt.toISOString(),
          unreadCount: 0,
        });
      }

      const entry = partnerMap.get(key)!;

      // Count unread (messages where user is recipient and not read)
      if (!isSender && !msg.read) {
        entry.unreadCount += 1;
      }
    }

    const conversations = Array.from(partnerMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST: Send a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, schoolId } = body;

    if (!senderId || !recipientId || !content || !schoolId) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
    }

    if (content.trim().length === 0) {
      return NextResponse.json({ error: 'Le message ne peut pas être vide' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Le message est trop long (max 5000 caractères)' }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        schoolId,
        senderId,
        recipientId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
        recipient: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Send a real-time message notification to the recipient
    const senderName = message.sender?.fullName || 'Un utilisateur';
    const preview = content.trim().substring(0, 80) + (content.trim().length > 80 ? '...' : '');
    
    try { await notifyUser({
      schoolId,
      userId: recipientId,
      senderId,
      title: `Nouveau message de ${senderName} 💬`,
      message: preview,
      type: 'MESSAGE',
      priority: 'NORMAL',
      metadata: { messageId: message.id, senderName },
    }); } catch (e) { console.error('[Messages] Notification failed (non-blocking):', e); }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
