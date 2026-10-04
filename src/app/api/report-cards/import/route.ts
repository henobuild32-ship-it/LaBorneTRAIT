import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { CsvObject, pickValue, toNumber } from '@/lib/csv';

function rowValue(row: CsvObject, ...aliases: string[]): string {
  return pickValue(row, aliases);
}

function normalizeTrimester(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/([123])/);
  return match ? match[1] : null;
}

function normalizeStatus(value: string): string {
  const text = value.trim().toLowerCase();
  if (['validated', 'validé', 'valide'].includes(text)) return 'validated';
  if (['draft', 'brouillon'].includes(text)) return 'draft';
  if (['pending_admin', 'attente'].includes(text)) return 'pending_admin';
  return 'published';
}

function mentionForAverage(average: number): string {
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  if (average >= 8) return 'Passable';
  return 'Insuffisant';
}

// POST /api/report-cards/import — import des bulletins par l'administration de l'école
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const { schoolId, rows, academicYear } = body as {
      schoolId?: string;
      rows?: CsvObject[];
      academicYear?: string;
    };

    if (!schoolId || schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs de cette école.' }, { status: 403 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
    }

    const school = await db.school.findUnique({ where: { id: schoolId }, select: { academicYear: true } });
    const year = academicYear?.trim() || school?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const classes = await db.schoolClass.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true },
    });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const students = await db.user.findMany({
      where: { schoolId, role: 'STUDENT', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        matricule: true,
        ine: true,
        gender: true,
        birthDate: true,
        classEnrollments: { select: { classId: true } },
      },
    });
    const byMatricule = new Map<string, (typeof students)[number]>();
    const byNameInClass = new Map<string, (typeof students)[number]>();
    for (const student of students) {
      if (student.matricule) byMatricule.set(student.matricule.trim().toLowerCase(), student);
      if (student.ine) byMatricule.set(student.ine.trim().toLowerCase(), student);
      for (const enrollment of student.classEnrollments) {
        byNameInClass.set(`${enrollment.classId}|${student.fullName.trim().toLowerCase()}`, student);
      }
      const key = student.fullName.trim().toLowerCase();
      if (!byNameInClass.has(`*|${key}`)) byNameInClass.set(`*|${key}`, student);
    }

    const existingReports = await db.reportCard.findMany({
      where: { schoolId, deletedAt: null },
      select: { classId: true, studentId: true, trimester: true, academicYear: true },
    });
    const existingKeys = new Set(
      existingReports.map((r) => `${r.classId}|${r.studentId}|${r.trimester}|${r.academicYear}`)
    );

    const toCreate: {
      data: Record<string, unknown>;
      key: string;
      name: string;
      className: string;
      average: number;
      rank: number;
      mention: string;
      trimester: string;
      reportNumber: string;
      studentId: string;
      classId: string;
      year: string;
    }[] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, index) => {
      const line = index + 2;
      const studentRef = rowValue(row, 'matricule', 'permanentNumber', 'ine', 'numero_etudiant', 'id');
      const studentName = rowValue(row, 'eleve', 'student', 'nom_eleve', 'nom', 'fullName');
      const className = rowValue(row, 'classe', 'className', 'class');
      const trimester = normalizeTrimester(rowValue(row, 'trimestre', 'trimester', 'term', 'periode'));
      const average = toNumber(rowValue(row, 'moyenne', 'average', 'moy', 'note_moyenne'));
      const rank = toNumber(rowValue(row, 'rang', 'rank', 'position'));
      const mention = rowValue(row, 'mention', 'appreciation_generale');
      const number = rowValue(row, 'numero', 'reportNumber', 'n_bulletin', 'reference');
      const status = rowValue(row, 'statut', 'status');
      const studentYear = rowValue(row, 'annee', 'academicYear', 'annee_scolaire') || year;

      if (!className) {
        errors.push(`Ligne ${line} : classe obligatoire.`);
        return;
      }
      const classId = classByName.get(className.trim().toLowerCase());
      if (!classId) {
        errors.push(`Ligne ${line} : classe « ${className} » introuvable.`);
        return;
      }

      if (!trimester) {
        errors.push(`Ligne ${line} : trimestre invalide (1, 2 ou 3).`);
        return;
      }
      if (average === null) {
        errors.push(`Ligne ${line} : moyenne obligatoire.`);
        return;
      }

      let student = studentRef ? byMatricule.get(studentRef.trim().toLowerCase()) : undefined;
      if (!student && studentName) {
        student = byNameInClass.get(`${classId}|${studentName.trim().toLowerCase()}`) ||
          byNameInClass.get(`*|${studentName.trim().toLowerCase()}`);
      }
      if (!student) {
        errors.push(`Ligne ${line} : élève introuvable${studentName ? ` (${studentName})` : studentRef ? ` (${studentRef})` : ''}.`);
        return;
      }

      const key = `${classId}|${student.id}|${trimester}|${studentYear}`;
      if (existingKeys.has(key)) {
        skipped++;
        return;
      }
      existingKeys.add(key);

      const finalRank = rank !== null && rank > 0 ? Math.round(rank) : 0;
      const finalMention = mention || mentionForAverage(average);
      const reportNumber =
        number ||
        `IMP-${schoolId.slice(0, 4).toUpperCase()}-T${trimester}-${Date.now()}-${index + 1}`;

      toCreate.push({
        data: {
          reportNumber,
          schoolId,
          classId,
          studentId: student.id,
          trimester,
          academicYear: studentYear,
          studentName: student.fullName,
          studentGender: String(student.gender),
          studentBirthDate: student.birthDate || '',
          permanentNumber: student.matricule || '',
          totalPointsObtained: average,
          totalPointsPossible: 20,
          overallPercentage: (average / 20) * 100,
          averageGrade: average,
          classRank: finalRank,
          mention: finalMention,
          status: normalizeStatus(status),
          gradesData: { imported: true, source: row, importedBy: auth.userId },
        },
        key,
        name: student.fullName,
        className,
        average,
        rank: finalRank,
        mention: finalMention,
        trimester,
        reportNumber,
        studentId: student.id,
        classId,
        year: studentYear,
      });
    });

    if (toCreate.length > 0) {
      await db.$transaction(
        toCreate.map((report) => db.reportCard.create({ data: report.data as never }))
      );
    }

    return NextResponse.json(
      {
        created: toCreate.length,
        skipped,
        errors,
        reports: toCreate.map((r) => ({
          reportNumber: r.reportNumber,
          studentName: r.name,
          className: r.className,
          trimester: r.trimester,
          average: r.average,
        })),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/report-cards/import]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
