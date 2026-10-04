import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAcademicYear } from '@/lib/grade-sync';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

// GET: Lister les règles de cotation par école et optionnellement par classe
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const { searchParams } = new URL(req.url);
    const schoolId = auth.schoolId;
    const classId = searchParams.get('classId');
    const academicYear = searchParams.get('academicYear') || getCurrentAcademicYear();

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });
    }

    const whereClause: any = {
      schoolId,
      academicYear,
    };
    if (classId) whereClause.classId = classId;

    const rules = await db.subjectRule.findMany({
      where: whereClause,
      include: {
        course: { select: { id: true, name: true, maxScore: true } },
        class: { select: { id: true, name: true, cycle: true, level: true, section: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { course: { name: 'asc' } }],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/subject-rules] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// POST: Créer ou mettre à jour (upsert) les règles d'une ou plusieurs matières
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const body = await req.json();
    const {
      classId,
      courseId,
      academicYear = getCurrentAcademicYear(),
      semester = null,
      maximumPoints = 100,
      coefficient = null,
      dailyWorkMaximum = 40,
      examMaximum = 60,
      isQualitative = false,
      batchRules, // Optionnel : mise à jour groupée pour toute une classe
    } = body;
    const schoolId = auth.schoolId;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès réservé à l’administration.' }, { status: 403 });
    }
    if (!Array.isArray(batchRules)) {
      const values = [maximumPoints, dailyWorkMaximum, examMaximum].map(Number);
      if (values.some(value => !Number.isFinite(value) || value <= 0) || (coefficient != null && (!Number.isFinite(Number(coefficient)) || Number(coefficient) <= 0))) {
        return NextResponse.json({ error: 'Maximum ou coefficient invalide.' }, { status: 400 });
      }
    }

    // Gestion du traitement par lot (ex: configuration de toute une classe en une seule requête)
    if (Array.isArray(batchRules) && batchRules.length > 0 && classId) {
      const results: any[] = [];
      for (const item of batchRules) {
        if (!item.courseId) continue;
        const upserted = await db.subjectRule.upsert({
          where: {
            schoolId_classId_courseId_academicYear_semester: {
              schoolId,
              classId,
              courseId: item.courseId,
              academicYear: item.academicYear || academicYear,
              semester: item.semester !== undefined ? item.semester : null,
            },
          },
          update: {
            maximumPoints: Number(item.maximumPoints) || 100,
            dailyWorkMaximum: Number(item.dailyWorkMaximum) || 40,
            examMaximum: Number(item.examMaximum) || 60,
            coefficient: item.coefficient ? Number(item.coefficient) : null,
            isQualitative: Boolean(item.isQualitative),
            isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          },
          create: {
            schoolId,
            classId,
            courseId: item.courseId,
            academicYear: item.academicYear || academicYear,
            semester: item.semester !== undefined ? item.semester : null,
            maximumPoints: Number(item.maximumPoints) || 100,
            dailyWorkMaximum: Number(item.dailyWorkMaximum) || 40,
            examMaximum: Number(item.examMaximum) || 60,
            coefficient: item.coefficient ? Number(item.coefficient) : null,
            isQualitative: Boolean(item.isQualitative),
            isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          },
        });
        results.push(upserted);
      }
      return NextResponse.json({ success: true, count: results.length, rules: results });
    }

    if (!classId || !courseId) {
      return NextResponse.json({ error: 'classId et courseId requis' }, { status: 400 });
    }

    const rule = await db.subjectRule.upsert({
      where: {
        schoolId_classId_courseId_academicYear_semester: {
          schoolId,
          classId,
          courseId,
          academicYear,
          semester,
        },
      },
      update: {
        maximumPoints: Number(maximumPoints) || 100,
        dailyWorkMaximum: Number(dailyWorkMaximum) || 40,
        examMaximum: Number(examMaximum) || 60,
        coefficient: coefficient ? Number(coefficient) : null,
        isQualitative: Boolean(isQualitative),
        isActive: true,
      },
      create: {
        schoolId,
        classId,
        courseId,
        academicYear,
        semester,
        maximumPoints: Number(maximumPoints) || 100,
        dailyWorkMaximum: Number(dailyWorkMaximum) || 40,
        examMaximum: Number(examMaximum) || 60,
        coefficient: coefficient ? Number(coefficient) : null,
        isQualitative: Boolean(isQualitative),
        isActive: true,
      },
      include: {
        course: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/subject-rules] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE: Supprimer une règle
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await db.subjectRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/subject-rules] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
