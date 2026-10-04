/**
 * POST /api/grades/sync-report
 * ─────────────────────────────────────────────────────────────────────────────
 * Manually trigger a bulk sync of all ReportCards for a given class + trimester
 * (or a single student if studentId is provided).
 *
 * Body: { schoolId, classId, trimester, studentId? }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { syncStudentReport, type SyncResult } from '@/lib/grade-sync';

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { schoolId, classId, trimester, studentId } = body;

    if (!schoolId || !trimester) {
      return NextResponse.json(
        { error: 'schoolId and trimester are required' },
        { status: 400 }
      );
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }
    if (auth.role === 'STUDENT' || auth.role === 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    if (auth.role === 'TEACHER') {
      if (!classId) {
        return NextResponse.json({ error: 'Sélectionnez une de vos classes pour synchroniser les bulletins.' }, { status: 400 });
      }
      const course = await db.course.findFirst({
        where: { schoolId, classId, teacherId: auth.userId, deletedAt: null },
        select: { id: true },
      });
      if (!course) {
        return NextResponse.json({ error: 'Cette classe ne vous est pas attribuée.' }, { status: 403 });
      }
    }

    // Determine which students to sync
    let studentIds: string[] = [];

    if (studentId) {
      // Single student
      studentIds = [studentId];
    } else if (classId) {
      // All students enrolled in a class
      const enrollments = await db.enrolledClass.findMany({
        where: { classId },
        select: { userId: true },
      });
      studentIds = enrollments.map((e) => e.userId);
    } else {
      // All students in the school that have grades for this trimester
      const grades = await db.grade.findMany({
        where: { schoolId, trimester },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      studentIds = grades.map((g) => g.studentId);
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'No students found to sync', synced: 0 });
    }

    // Run all syncs in parallel (up to 20 at a time to avoid DB overload)
    const results: PromiseSettledResult<SyncResult | null>[] = [];
    const chunkSize = 20;

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map((sid) => syncStudentReport(schoolId, sid, trimester))
      );
      results.push(...chunkResults);
    }

    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<SyncResult | null> =>
        r.status === 'fulfilled' && r.value !== null
    ).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      message: `Synchronisation terminée : ${succeeded} bulletins mis à jour, ${failed} échecs.`,
      synced: succeeded,
      failed,
      total: studentIds.length,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/grades/sync-report?schoolId=...&studentId=...&trimester=...
 * Returns the current auto-synced report card for a student, if one exists.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const studentId = searchParams.get('studentId');
    const trimester = searchParams.get('trimester');
    const classId = searchParams.get('classId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      schoolId,
      status: { in: ['auto_draft', 'draft', 'pending_admin', 'validated', 'published'] },
    };

    if (studentId) where.studentId = studentId;
    if (trimester) where.trimester = trimester;
    if (classId) where.classId = classId;
    if (auth.role === 'STUDENT') {
      where.studentId = auth.userId;
    } else if (auth.role === 'PARENT') {
      const children = await db.user.findMany({
        where: { schoolId, parentId: auth.userId },
        select: { id: true },
      });
      where.studentId = { in: children.map((child) => child.id) };
    } else if (auth.role === 'TEACHER') {
      const courses = await db.course.findMany({
        where: { schoolId, teacherId: auth.userId, deletedAt: null },
        select: { classId: true },
        distinct: ['classId'],
      });
      const classIds = courses.map((course) => course.classId);
      where.classId = classId && classIds.includes(classId) ? classId : { in: classIds };
    }

    const reportCards = await db.reportCard.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, photoUrl: true, gender: true } },
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: [{ trimester: 'asc' }, { studentName: 'asc' }],
    });

    return NextResponse.json({ reportCards });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
