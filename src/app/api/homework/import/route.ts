import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { CsvObject, pickValue, toIsoDate } from '@/lib/csv';
import { notifyUser } from '@/services/notifications/notificationEngine';

function rowValue(row: CsvObject, ...aliases: string[]): string {
  return pickValue(row, aliases);
}

// POST /api/homework/import — import massif de devoirs depuis un document (PDF/Word/photo)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const { schoolId, rows } = body as { schoolId?: string; rows?: CsvObject[] };

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    if (auth.role !== 'ADMIN' && auth.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Action réservée aux enseignants et administrateurs.' }, { status: 403 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
    }

    const courses = await db.course.findMany({
      where: { schoolId, deletedAt: null, ...(auth.role === 'TEACHER' ? { teacherId: auth.userId } : {}) },
      select: {
        id: true,
        name: true,
        teacherId: true,
        classId: true,
        class: { select: { name: true } },
      },
    });

    const courseByKey = new Map<string, (typeof courses)[number]>();
    for (const course of courses) {
      courseByKey.set(course.name.trim().toLowerCase(), course);
      courseByKey.set(`${course.class.name.trim().toLowerCase()}|${course.name.trim().toLowerCase()}`, course);
    }

    const created: {
      course: (typeof courses)[number];
      title: string;
      description: string;
      dueDate: string;
      gradingType: string;
    }[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const line = index + 2;
      const courseRef = rowValue(row, 'cours', 'matiere', 'subject', 'course', 'name');
      const className = rowValue(row, 'classe', 'className', 'class');
      const title = rowValue(row, 'titre', 'title', 'libelle', 'intitule');
      const dateRaw = rowValue(row, 'date', 'date_limite', 'dueDate', 'echeance', 'rendre_le');
      const description = rowValue(row, 'description', 'consigne', 'details');
      const gradingType = rowValue(row, 'note', 'gradingType', 'type_note').toLowerCase();

      if (!courseRef || !title) {
        errors.push(`Ligne ${line} : cours et titre obligatoires.`);
        return;
      }

      const key = className
        ? `${className.trim().toLowerCase()}|${courseRef.trim().toLowerCase()}`
        : courseRef.trim().toLowerCase();
      const course = courseByKey.get(key) || courseByKey.get(courseRef.trim().toLowerCase());
      if (!course) {
        errors.push(`Ligne ${line} : cours « ${courseRef} » introuvable${className ? ` en ${className}` : ''}.`);
        return;
      }

      const dueDate = dateRaw ? toIsoDate(dateRaw) : null;
      if (dateRaw && !dueDate) {
        errors.push(`Ligne ${line} : date « ${dateRaw} » invalide (JJ/MM/AAAA ou AAAA-MM-JJ).`);
        return;
      }

      created.push({
        course,
        dueDate: dueDate || '',
        title,
        description,
        gradingType: ['manual', 'auto', 'none'].includes(gradingType) ? gradingType : 'manual',
      });
    });

    if (created.length > 0) {
      await db.$transaction(
        created.map((item) =>
          db.homework.create({
            data: {
              schoolId,
              courseId: item.course.id,
              teacherId: item.course.teacherId,
              title: item.title,
              description: item.description || '',
              dueDate: item.dueDate,
              gradingType: item.gradingType,
              isPublished: true,
            },
          })
        )
      );
    }

    // Une notification par classe concernée (éviter le spam)
    const classNotifications = new Map<string, { classId: string; name: string; count: number; courseId: string }>();
    for (const item of created) {
      const existingNotif = classNotifications.get(item.course.classId);
      if (existingNotif) {
        existingNotif.count++;
      } else {
        classNotifications.set(item.course.classId, {
          classId: item.course.classId,
          name: item.course.class.name,
          count: 1,
          courseId: item.course.id,
        });
      }
    }
    await Promise.all(
      Array.from(classNotifications.values()).map((target) =>
        notifyUser({
          schoolId,
          targetRole: 'STUDENT',
          targetClassId: target.classId,
          senderId: auth.userId,
          title: `📝 ${target.count} devoir${target.count > 1 ? 's' : ''} importé${target.count > 1 ? 's' : ''} — ${target.name}`,
          message: `${target.count} devoir${target.count > 1 ? 's ont' : ' a'} été ajouté${target.count > 1 ? 's' : ''} à votre classe ${target.name}.`,
          type: 'HOMEWORK',
          priority: 'HIGH',
          metadata: { courseId: target.courseId, imported: true },
        })
      )
    );

    return NextResponse.json({ created: created.length, errors }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/homework/import]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
