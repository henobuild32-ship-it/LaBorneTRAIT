import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const homeworkId = searchParams.get('homeworkId');
    const schoolId = searchParams.get('schoolId');

    if (!homeworkId || !schoolId) {
      return NextResponse.json({ error: 'homeworkId et schoolId requis' }, { status: 400 });
    }

    const submissions = await db.submission.findMany({
      where: { homeworkId, schoolId },
      include: {
        student: { select: { id: true, fullName: true, photoUrl: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ submissions });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { homeworkId, schoolId, studentId, fileUrl, fileName, content } = body;

    if (!homeworkId || !schoolId || !studentId) {
      return NextResponse.json({ error: 'Champs requis manquants: homeworkId, schoolId, studentId' }, { status: 400 });
    }

    const homework = await db.homework.findUnique({
      where: { id: homeworkId },
      include: {
        teacher: { select: { id: true } },
      },
    });

    if (!homework) {
      return NextResponse.json({ error: 'Devoir introuvable' }, { status: 404 });
    }

    const submission = await db.submission.upsert({
      where: {
        homeworkId_studentId: { homeworkId, studentId },
      },
      update: {
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        content: content || '',
        submittedAt: new Date(),
        status: 'submitted',
      },
      create: {
        homeworkId,
        studentId,
        schoolId,
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        content: content || '',
        status: 'submitted',
      },
      include: {
        student: { select: { id: true, fullName: true } },
      },
    });

    // Notify teacher
    if (homework.teacherId) {
      const { notifyUser } = await import('@/services/notifications/notificationEngine');
      notifyUser({
        schoolId,
        userId: homework.teacherId,
        senderId: studentId,
        title: `📥 Devoir rendu : ${homework.title}`,
        message: `${submission.student.fullName} a rendu son travail.`,
        type: 'HOMEWORK_SUBMISSION',
        priority: 'NORMAL',
        metadata: { submissionId: submission.id, homeworkId },
      }).catch((e) => console.error('[Submission] Notification trigger error:', e));
    }

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
