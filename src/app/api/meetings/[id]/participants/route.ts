import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

async function assertHost(meetingId: string, userId: string) {
  if (!userId) return false;
  const p = await db.participant.findFirst({
    where: { meetingId, userId, status: 'approved', role: { in: ['HOST', 'COHOST'] } },
  });
  return !!p;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const participants = await db.participant.findMany({
      where: { meetingId: id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, fullName, userRole } = body;

    const meeting = await db.videoConference.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 });
    }
    if (meeting.isLocked) {
      return NextResponse.json({ error: 'La salle est verrouillée.', status: 'locked' }, { status: 423 });
    }
    if (meeting.status === 'ended') {
      return NextResponse.json({ error: 'La réunion est terminée.' }, { status: 410 });
    }

    const existing = await db.participant.findFirst({ where: { meetingId: id, userId } });
    if (existing) {
      if (existing.status === 'removed' || existing.status === 'rejected') {
        const updated = await db.participant.update({
          where: { id: existing.id },
          data: { status: 'pending', leftAt: null },
        });
        return NextResponse.json({ participant: updated });
      }
      return NextResponse.json({ participant: existing });
    }

    const participant = await db.participant.create({
      data: {
        meetingId: id,
        schoolId: meeting.schoolId,
        userId,
        fullName: fullName || 'Participant',
        role: 'PARTICIPANT',
        status: 'pending',
      },
    });

    return NextResponse.json({ participant });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, participantId, hostUserId } = body;

    if (!(await assertHost(id, hostUserId))) {
      return NextResponse.json({ error: 'Action réservée à l\'organisateur.' }, { status: 403 });
    }

    const participant = await db.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.meetingId !== id) {
      return NextResponse.json({ error: 'Participant introuvable.' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    switch (action) {
      case 'approve':
        updateData = { status: 'approved', joinedAt: participant.joinedAt ?? new Date() };
        break;
      case 'reject':
        updateData = { status: 'rejected' };
        break;
      case 'remove':
        updateData = { status: 'removed', leftAt: new Date() };
        break;
      case 'promote':
        updateData = { isCoHost: !participant.isCoHost, role: !participant.isCoHost ? 'COHOST' : 'PARTICIPANT' };
        break;
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }

    const updated = await db.participant.update({
      where: { id: participantId },
      data: updateData,
    });

    return NextResponse.json({ participant: updated });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
