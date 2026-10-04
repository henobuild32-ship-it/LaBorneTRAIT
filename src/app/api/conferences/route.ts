import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { notifyUser } from '@/services/notifications/notificationEngine';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

const prisma = db;

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Seul un utilisateur de la même école peut lister les visioconférences
    if (auth.schoolId !== schoolId && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const conferences = await prisma.videoConference.findMany({
      where: { schoolId },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ],
    });

    return NextResponse.json({ conferences });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching conferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const data = await req.json();
    const { schoolId, title, description, date, time, targetRole, targetClassId, creatorId } = data;

    if (!schoolId || !title || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN' || auth.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    // Generate unique Jitsi Room URL
    const roomId = `LaBorneTRAIT-${schoolId.substring(0, 5)}-${randomUUID().substring(0, 8)}`;
    const roomUrl = `https://meet.jit.si/${roomId}`;

    const conference = await prisma.videoConference.create({
      data: {
        schoolId,
        title,
        description: description || '',
        date,
        time,
        roomUrl,
        targetRole: targetRole || 'ALL',
        targetClassId: targetClassId || '',
      },
    });

    // Create Notification using centralized real-time service
    let message = `Nouvelle visioconférence: "${title}" programmée le ${date} à ${time}. Lien pour rejoindre: ${roomUrl}`;
    
    try { await notifyUser({
      schoolId,
      senderId: creatorId || auth.userId,
      targetRole: targetRole || 'ALL',
      targetClassId: targetClassId || '',
      message,
      title: 'Nouvelle Visioconférence 🎥',
      type: 'CONFERENCE',
      priority: 'HIGH',
      metadata: { conferenceId: conference.id, roomUrl, date, time },
    }); } catch (e) { console.error('[Conferences] Notification failed (non-blocking):', e); }

    return NextResponse.json({ conference });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating conference:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.videoConference.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Conference not found' }, { status: 404 });
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN' || auth.schoolId !== existing.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    await prisma.videoConference.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting conference:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
