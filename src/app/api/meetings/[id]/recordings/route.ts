import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { createdById, url, note, durationSeconds } = body;

    const meeting = await db.videoConference.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 });
    }

    const isHost = await db.participant.findFirst({
      where: { meetingId: id, userId: createdById, status: 'approved', role: { in: ['HOST', 'COHOST'] } },
    });
    if (!isHost) {
      return NextResponse.json({ error: 'Action réservée à l\'organisateur.' }, { status: 403 });
    }

    const recording = await db.recording.create({
      data: {
        meetingId: id,
        schoolId: meeting.schoolId,
        createdById: createdById || '',
        url: url || '',
        note: note || '',
        durationSeconds: Number(durationSeconds) || 0,
      },
    });

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('Error creating recording:', error);
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
    const recordingId = searchParams.get('recordingId');
    if (!recordingId) {
      return NextResponse.json({ error: 'recordingId requis.' }, { status: 400 });
    }
    await db.recording.deleteMany({ where: { id: recordingId, meetingId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
