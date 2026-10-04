import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const userId = searchParams.get('userId');

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    if (auth.role === 'PARENT' && userId) {
      const student = await db.user.findUnique({
        where: { id: userId },
        select: { parentId: true, schoolId: true },
      });
      if (!student || student.parentId !== auth.userId || student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Vous ne pouvez consulter que la présence de vos enfants' }, { status: 403 });
      }
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);

    if (userId) {
      const presence = await db.presence.findFirst({
        where: {
          schoolId,
          userId,
          date: { gte: today, lt: tomorrow },
        },
        include: {
          user: { select: { fullName: true, role: true, photoUrl: true } },
        },
      });

      return NextResponse.json({ presence });
    }

    const presences = await db.presence.findMany({
      where: {
        schoolId,
        date: { gte: today, lt: tomorrow },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            photoUrl: true,
            classEnrollments: {
              select: { class: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { heureArrivee: 'asc' },
    });

    const [totalStudents, totalTeachers] = await Promise.all([
      db.user.count({ where: { schoolId, role: 'STUDENT', active: true } }),
      db.user.count({ where: { schoolId, role: 'TEACHER', active: true } }),
    ]);

    const presents = presences.filter((p) => p.statut === 'PRESENT').length;
    const retards = presences.filter((p) => p.statut === 'RETARD').length;
    const justifies = presences.filter((p) => p.statut === 'JUSTIFIE').length;
    const total = totalStudents + totalTeachers;
    const absents = Math.max(0, total - presences.length);
    const tauxPresence = total > 0 ? Math.round(((presents + retards + justifies) / total) * 100) : 0;

    return NextResponse.json({
      presences,
      stats: {
        total,
        totalStudents,
        totalTeachers,
        presents,
        retards,
        justifies,
        absents,
        tauxPresence,
        date: today.toISOString(),
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
