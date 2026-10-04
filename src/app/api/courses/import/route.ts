import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { CsvObject, pickValue } from '@/lib/csv';

function rowValue(row: CsvObject, ...aliases: string[]): string {
  return pickValue(row, aliases);
}

// POST /api/courses/import — import massif de cours depuis un document (PDF/Word/photo)
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

    const teachers = await db.user.findMany({
      where: { schoolId, role: 'TEACHER', deletedAt: null },
      select: { id: true, fullName: true, email: true },
    });
    const teacherByKey = new Map<string, string>();
    for (const teacher of teachers) {
      teacherByKey.set(teacher.fullName.trim().toLowerCase(), teacher.id);
      if (teacher.email) teacherByKey.set(teacher.email.trim().toLowerCase(), teacher.id);
    }

    const existing = await db.course.findMany({
      where: { schoolId, deletedAt: null },
      select: { classId: true, name: true },
    });
    const existingKeys = new Set(existing.map((c) => `${c.classId}|${c.name.trim().toLowerCase()}`));

    const created: {
      classId: string;
      teacherId: string;
      name: string;
      description: string;
      coefficient?: number;
      maxScore?: number;
    }[] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, index) => {
      const line = index + 2;
      const className = rowValue(row, 'classe', 'classe_nom', 'className', 'class', 'groupe');
      const courseName = rowValue(row, 'cours', 'matiere', 'subject', 'name', 'nom');
      const teacherRef = rowValue(row, 'professeur', 'prof', 'teacher', 'enseignant', 'email_prof', 'email');
      const description = rowValue(row, 'description', 'details');
      const coefficientRaw = rowValue(row, 'coefficient', 'coef');
      const maxScoreRaw = rowValue(row, 'note_max', 'maxScore', 'bareme', 'maximum');

      if (!className || !courseName) {
        errors.push(`Ligne ${line} : classe et cours obligatoires.`);
        return;
      }

      const classId = classByName.get(className.trim().toLowerCase());
      if (!classId) {
        errors.push(`Ligne ${line} : classe « ${className} » introuvable.`);
        return;
      }

      const key = `${classId}|${courseName.trim().toLowerCase()}`;
      if (existingKeys.has(key)) {
        skipped++;
        return;
      }

      if (!teacherRef) {
        errors.push(`Ligne ${line} : professeur obligatoire.`);
        return;
      }
      const teacherId = teacherByKey.get(teacherRef.trim().toLowerCase());
      if (!teacherId) {
        errors.push(`Ligne ${line} : professeur « ${teacherRef} » introuvable.`);
        return;
      }

      const coefficient = parseInt(coefficientRaw, 10);
      const maxScore = parseFloat(maxScoreRaw.replace(',', '.'));

      existingKeys.add(key);
      created.push({
        classId,
        teacherId,
        name: courseName.trim(),
        description,
        coefficient: Number.isFinite(coefficient) && coefficient > 0 ? Math.min(coefficient, 10) : undefined,
        maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : undefined,
      });
    });

    if (created.length > 0) {
      await db.$transaction(
        created.map((course) =>
          db.course.create({
            data: {
              schoolId,
              classId: course.classId,
              teacherId: course.teacherId,
              name: course.name,
              description: course.description || '',
              ...(course.coefficient !== undefined ? { coefficient: course.coefficient } : {}),
              ...(course.maxScore !== undefined ? { maxScore: course.maxScore } : {}),
            },
          })
        )
      );
    }

    return NextResponse.json({ created: created.length, skipped, errors }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/courses/import]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
