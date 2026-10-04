import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await db.videoConference.findUnique({
      where: { id },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        recordings: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const { title, description, isLocked, status } = data;

    const existing = await db.videoConference.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof title === 'string') updateData.title = title;
    if (typeof description === 'string') updateData.description = description;
    if (typeof isLocked === 'boolean') updateData.isLocked = isLocked;
    if (typeof status === 'string') {
      updateData.status = status;
      if (status === 'live' && !existing.startedAt) updateData.startedAt = new Date();
      if (status === 'ended') updateData.endedAt = new Date();
    }

    const meeting = await db.videoConference.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Error updating meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.videoConference.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
