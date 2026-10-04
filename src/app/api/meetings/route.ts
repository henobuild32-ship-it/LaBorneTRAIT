import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { notifyUser } from '@/services/notifications/notificationEngine';

export const runtime = 'nodejs';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeStr(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function isMeetingVisibleToUser(
  meeting: { targetRole: string; targetClassId: string },
  userId: string,
  userRole: string
): Promise<boolean> {
  if (meeting.targetRole !== 'ALL' && meeting.targetRole !== userRole) return false;
  if (meeting.targetClassId) {
    const enrollment = await db.enrolledClass.findFirst({
      where: { userId, classId: meeting.targetClassId },
    });
    if (!enrollment) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('role') || 'ALL';
    const scope = searchParams.get('scope') || 'upcoming'; // upcoming | live | past | all

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const meetings = await db.videoConference.findMany({
      where: { schoolId },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        recordings: { orderBy: { createdAt: 'desc' } },
      },
    });

    const filtered: any[] = [];
    for (const m of meetings) {
      const visible = !userId || (await isMeetingVisibleToUser(m, userId, userRole));
      if (!visible) continue;

      if (scope === 'live') {
        if (m.status !== 'live') continue;
      } else if (scope === 'past') {
        if (m.status !== 'ended') continue;
      } else if (scope === 'upcoming') {
        if (m.status === 'ended') continue;
      }

      filtered.push(m);
    }

    return NextResponse.json({ meetings: filtered });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const {
      schoolId,
      title,
      description,
      date,
      time,
      targetRole,
      targetClassId,
      type,
      creatorId,
      creatorName,
    } = data;

    if (!schoolId || !title) {
      return NextResponse.json({ error: 'schoolId et title sont requis.' }, { status: 400 });
    }

    const isInstant = type === 'instant';
    const meetingDate = isInstant ? todayStr() : date;
    const meetingTime = isInstant ? nowTimeStr() : time;

    if (!isInstant && (!meetingDate || !meetingTime)) {
      return NextResponse.json({ error: 'date et time sont requis pour une réunion programmée.' }, { status: 400 });
    }

    const roomId = `LaBorneTRAIT-${schoolId.substring(0, 5)}-${randomUUID().substring(0, 8)}`;
    const roomUrl = `https://meet.jit.si/${roomId}`;

    const meeting = await db.videoConference.create({
      data: {
        schoolId,
        title,
        description: description || '',
        date: meetingDate,
        time: meetingTime,
        roomUrl,
        targetRole: targetRole || 'ALL',
        targetClassId: targetClassId || '',
        type: isInstant ? 'instant' : 'scheduled',
        status: isInstant ? 'live' : 'scheduled',
        isLocked: false,
        creatorId: creatorId || '',
        startedAt: isInstant ? new Date() : null,
      },
    });

    if (creatorId) {
      await db.participant.create({
        data: {
          meetingId: meeting.id,
          schoolId,
          userId: creatorId,
          fullName: creatorName || 'Organisateur',
          role: 'HOST',
          status: 'approved',
          isCoHost: false,
          joinedAt: isInstant ? new Date() : null,
        },
      });
    }

    if (!isInstant) {
      try { await notifyUser({
        schoolId,
        senderId: creatorId || 'admin',
        targetRole: targetRole || 'ALL',
        targetClassId: targetClassId || '',
        message: `Nouvelle visioconférence : "${title}" le ${meetingDate} à ${meetingTime}.`,
        title: 'Nouvelle Visioconférence 🎥',
        type: 'CONFERENCE',
        priority: 'HIGH',
        metadata: { conferenceId: meeting.id, roomUrl, date: meetingDate, time: meetingTime },
      }); } catch (e) { console.error('[Meetings] Notification failed (non-blocking):', e); }
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
