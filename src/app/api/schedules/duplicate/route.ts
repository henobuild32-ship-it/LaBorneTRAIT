import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/schedules/duplicate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, sourceClassId, targetClassId } = body;

    if (!schoolId || !sourceClassId || !targetClassId) {
      return NextResponse.json(
        { error: 'schoolId, sourceClassId et targetClassId requis' },
        { status: 400 }
      );
    }

    if (sourceClassId === targetClassId) {
      return NextResponse.json(
        { error: 'La classe source et cible doivent être différentes' },
        { status: 400 }
      );
    }

    // Load source schedules
    const sourceSchedules = await db.courseSchedule.findMany({
      where: {
        schoolId,
        course: { classId: sourceClassId },
      },
      include: {
        course: true,
      },
    });

    if (sourceSchedules.length === 0) {
      return NextResponse.json(
        { error: 'Aucun horaire trouvé dans la classe source' },
        { status: 404 }
      );
    }

    // Load or list target courses to map by name
    const targetCourses = await db.course.findMany({
      where: { schoolId, classId: targetClassId },
    });

    const targetCoursesByName = new Map(
      targetCourses.map((c) => [c.name.toLowerCase().trim(), c])
    );

    const createdSchedules: any[] = [];

    // Duplicate logic in a transaction
    await db.$transaction(async (tx) => {
      for (const sched of sourceSchedules) {
        const courseNameKey = sched.course.name.toLowerCase().trim();
        let targetCourse = targetCoursesByName.get(courseNameKey);

        // If target course doesn't exist, create it dynamically copying teacher assignment
        if (!targetCourse) {
          targetCourse = await tx.course.create({
            data: {
              schoolId,
              classId: targetClassId,
              teacherId: sched.course.teacherId,
              name: sched.course.name,
              maxScore: sched.course.maxScore,
              coefficient: sched.course.coefficient,
              description: sched.course.description,
              status: sched.course.status,
            },
          });
          targetCoursesByName.set(courseNameKey, targetCourse);
        }

        // Create the duplicate schedule slot
        const newSched = await tx.courseSchedule.create({
          data: {
            schoolId,
            courseId: targetCourse.id,
            dayOfWeek: sched.dayOfWeek,
            startTime: sched.startTime,
            endTime: sched.endTime,
            room: sched.room,
            periodStart: sched.periodStart,
            periodEnd: sched.periodEnd,
            exceptions: sched.exceptions,
          },
        });
        createdSchedules.push(newSched);
      }
    });

    return NextResponse.json({
      success: true,
      message: `${createdSchedules.length} créneaux horaires dupliqués avec succès`,
      count: createdSchedules.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/schedules/duplicate]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
