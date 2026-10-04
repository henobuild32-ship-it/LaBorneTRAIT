import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { CsvObject, pickValue, toDayOfWeek, toTime } from '@/lib/csv';

function rowValue(row: CsvObject, ...aliases: string[]): string {
  return pickValue(row, aliases);
}

// POST /api/schedules/import — import massif de l'emploi du temps depuis un document (PDF/Word/photo)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const { schoolId, rows } = body as { schoolId?: string; rows?: CsvObject[] };

    if (!schoolId || schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs de cette école.' }, { status: 403 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
    }

    const classes = await db.schoolClass.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true },
    });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const courses = await db.course.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, classId: true, teacherId: true },
    });
    const courseByKey = new Map<string, (typeof courses)[number]>();
    for (const course of courses) {
      courseByKey.set(`${course.classId}|${course.name.trim().toLowerCase()}`, course);
    }

    const teachers = await db.user.findMany({
      where: { schoolId, role: 'TEACHER', deletedAt: null },
      select: { id: true, fullName: true, email: true },
    });
    const teacherByKey = new Map<string, string>();
    for (const teacher of teachers) {
      teacherByKey.set(teacher.fullName.trim().toLowerCase(), teacher.id);
      if (teacher.email) teacherByKey.set(teacher.email.trim().toLowerCase(), teacher.id);
    }

    const existingSchedules = await db.courseSchedule.findMany({
      where: { schoolId, deletedAt: null },
      select: { courseId: true, dayOfWeek: true, startTime: true },
    });
    const existingKeys = new Set(
      existingSchedules.map((s) => `${s.courseId}|${s.dayOfWeek}|${s.startTime}`)
    );

    const toCreate: { courseId: string; dayOfWeek: number; startTime: string; endTime: string; room: string }[] = [];
    const newCourses: { classId: string; teacherId: string; name: string }[] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, index) => {
      const line = index + 2;
      const className = rowValue(row, 'classe', 'className', 'class', 'groupe');
      const courseName = rowValue(row, 'cours', 'matiere', 'course', 'subject', 'name');
      const dayRaw = rowValue(row, 'jour', 'day', 'dayOfWeek', 'jourenee');
      const startRaw = rowValue(row, 'heure_debut', 'debut', 'start', 'startTime', 'debut_cours');
      const endRaw = rowValue(row, 'heure_fin', 'fin', 'end', 'endTime', 'fin_cours');
      const room = rowValue(row, 'salle', 'room', 'lieu');
      const teacherRef = rowValue(row, 'professeur', 'prof', 'teacher', 'enseignant', 'email');

      if (!className || !courseName) {
        errors.push(`Ligne ${line} : classe et cours obligatoires.`);
        return;
      }

      const classId = classByName.get(className.trim().toLowerCase());
      if (!classId) {
        errors.push(`Ligne ${line} : classe « ${className} » introuvable.`);
        return;
      }

      const dayOfWeek = dayRaw ? toDayOfWeek(dayRaw) : null;
      if (dayOfWeek === null) {
        errors.push(`Ligne ${line} : jour « ${dayRaw} » invalide (Lundi à Samedi).`);
        return;
      }

      const startTime = toTime(startRaw);
      const endTime = toTime(endRaw);
      if (!startTime || !endTime) {
        errors.push(`Ligne ${line} : horaires invalides (format HH:MM).`);
        return;
      }

      const courseKey = `${classId}|${courseName.trim().toLowerCase()}`;
      let course = courseByKey.get(courseKey);
      if (!course && teacherRef) {
        const teacherId = teacherByKey.get(teacherRef.trim().toLowerCase());
        if (!teacherId) {
          errors.push(`Ligne ${line} : professeur « ${teacherRef} » introuvable.`);
          return;
        }
        course = { id: `pending-${courseKey}`, classId, teacherId, name: courseName.trim() } as (typeof courses)[number];
        newCourses.push({ classId, teacherId, name: courseName.trim() });
        courseByKey.set(courseKey, course);
      }
      if (!course) {
        errors.push(`Ligne ${line} : cours « ${courseName} » introuvable en ${className} (ajoutez une colonne professeur pour le créer).`);
        return;
      }

      const key = `${course.id}|${dayOfWeek}|${startTime}`;
      if (existingKeys.has(key)) {
        skipped++;
        return;
      }
      existingKeys.add(key);

      toCreate.push({ courseId: course.id, dayOfWeek, startTime, endTime, room });
    });

    // Création des cours manquants (dans l'ordre), puis des créneaux
    const createdCourses = new Map<string, string>();
    for (const course of newCourses) {
      const created = await db.course.create({
        data: { schoolId, classId: course.classId, teacherId: course.teacherId, name: course.name },
      });
      createdCourses.set(`pending-${course.classId}|${course.name.trim().toLowerCase()}`, created.id);
    }

    const scheduleRows = toCreate.map((slot) => ({
      ...slot,
      courseId: createdCourses.get(slot.courseId) || slot.courseId,
    }));

    if (scheduleRows.length > 0) {
      await db.$transaction(
        scheduleRows.map((slot) =>
          db.courseSchedule.create({
            data: {
              schoolId,
              courseId: slot.courseId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room,
            },
          })
        )
      );
    }

    return NextResponse.json(
      { created: scheduleRows.length, coursesCreated: newCourses.length, skipped, errors },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/schedules/import]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
