import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyUser } from '@/services/notifications/notificationEngine';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.role !== 'ADMIN' && auth.role !== 'TEACHER') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const schoolId = auth.schoolId;
    const classId = searchParams.get('classId');
    const teacherId = auth.role === 'TEACHER' ? auth.userId : searchParams.get('teacherId');
    const scope = searchParams.get('scope'); // 'global' pour le récapitulatif consolidé

    if (!schoolId) return NextResponse.json({ error: 'École introuvable' }, { status: 400 });

    const classes = await db.schoolClass.findMany({
      where: { schoolId },
      include: {
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Analyse détaillée d'une classe précise
    if (classId) {
      const whereEnroll: Record<string, unknown> = { classId };
      if (teacherId) {
        const courses = await db.course.findMany({
          where: { schoolId, teacherId },
          select: { classId: true },
        });
        const teacherClassIds = [...new Set(courses.map((c) => c.classId))];
        if (!teacherClassIds.includes(classId)) {
          return NextResponse.json({ students: [], analysis: null });
        }
      }

      const enrolledStudents = await db.enrolledClass.findMany({
        where: { classId },
        include: { user: { include: { attendanceStudent: true } } },
      });

      const allGrades = await db.grade.findMany({
        where: { studentId: { in: enrolledStudents.map((e) => e.userId) }, schoolId },
        include: { course: { select: { name: true } } },
      });

      const students = enrolledStudents.map((enrolled) => {
        const student = enrolled.user;
        const grades = allGrades.filter((g) => g.studentId === student.id);
        const subjectAverages = new Map<string, { total: number; count: number; maxScore: number }>();
        grades.forEach((g) => {
          const name = g.course.name;
          const existing = subjectAverages.get(name) || { total: 0, count: 0, maxScore: g.maxScore };
          existing.total += g.score;
          existing.count += 1;
          if (g.maxScore > existing.maxScore) existing.maxScore = g.maxScore;
          subjectAverages.set(name, existing);
        });

        const subjectResults: { name: string; average: number; maxScore: number }[] = [];
        let totalScore = 0;
        let totalMax = 0;
        subjectAverages.forEach((val, name) => {
          const avg = val.count > 0 ? val.total / val.count : 0;
          totalScore += avg;
          totalMax += val.maxScore;
          subjectResults.push({ name, average: avg, maxScore: val.maxScore });
        });

        const overallAverage = totalMax > 0 ? (totalScore / totalMax) * 20 : 0;

        const absences = student.attendanceStudent.filter((a) => a.status === 'absent');
        const justifiedAbsences = absences.filter((a) => a.reason && a.reason.length > 0);
        const unjustifiedAbsences = absences.filter((a) => !a.reason || a.reason.length === 0);

        const autoDecision = computeAutoDecision(overallAverage, unjustifiedAbsences.length);

        return {
          studentId: student.id,
          fullName: student.fullName,
          matricule: student.matricule,
          overallAverage: Math.round(overallAverage * 100) / 100,
          subjectResults,
          totalAbsences: absences.length,
          justifiedAbsences: justifiedAbsences.length,
          unjustifiedAbsences: unjustifiedAbsences.length,
          autoDecision,
          hasGrades: grades.length > 0,
          hasReportCard: false,
        };
      });

      return NextResponse.json({ analysis: { classId, studentCount: students.length }, students });
    }

    // Analyse par classe
    const classAnalysis = await Promise.all(
      classes.map(async (cls) => {
        const enrollments = await db.enrolledClass.findMany({
          where: { classId: cls.id },
          include: { user: { select: { id: true } } },
        });
        const studentIds = enrollments.map((e) => e.user.id);

        const allGrades = await db.grade.findMany({
          where: { schoolId, studentId: { in: studentIds } },
        });

        let passages = 0;
        let redoublements = 0;
        let finsCursus = 0;
        let enAttente = 0;
        let sansNotes = 0;

        studentIds.forEach((sid) => {
          const sg = allGrades.filter((g) => g.studentId === sid);
          if (sg.length === 0) {
            sansNotes++;
            enAttente++;
            return;
          }
          const sumScore = sg.reduce((s, g) => s + g.score, 0);
          const sumMax = sg.reduce((s, g) => s + g.maxScore, 0);
          const avg20 = sumMax > 0 ? (sumScore / sumMax) * 20 : 0;
          if (avg20 >= 10) passages++;
          else if (avg20 < 9) redoublements++;
          else enAttente++;
        });

        return {
          classId: cls.id,
          className: cls.name,
          totalStudents: studentIds.length,
          passages,
          redoublements,
          finsCursus,
          enAttente,
          sansNotes,
        };
      })
    );

    // Récapitulatif consolidé + diagnostics + transitions planifiées (scope global)
    if (scope === 'global') {
      const recap = await buildSchoolWideRecap(schoolId);
      const diagnostics = await buildDiagnostics(schoolId);
      return NextResponse.json({ classes: classAnalysis, recap, diagnostics });
    }

    return NextResponse.json({ classes: classAnalysis });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildSchoolWideRecap(schoolId: string) {
  const classes = await db.schoolClass.findMany({
    where: { schoolId },
    include: { enrollments: { include: { user: { select: { id: true, fullName: true } } } } },
  });

  const studentIds = classes.flatMap((c) => c.enrollments.map((e) => e.userId));
  const allGrades = await db.grade.findMany({
    where: { schoolId, studentId: { in: studentIds } },
  });
  const existingDecisions = await db.deliberationDecision.findMany({
    where: { schoolId, academicYear: getCurrentAcademicYear() },
  });

  const byClass: Record<string, { className: string; total: number; promoted: number; redoubling: number; leaving: number }> = {};
  const plannedTransitions: {
    studentId: string; fullName: string; currentClass: string;
    decision: string; targetClass: string | null;
  }[] = [];

  let total = 0;
  let promoted = 0;
  let redoubling = 0;
  let leaving = 0;

  for (const cls of classes) {
    byClass[cls.id] = { className: cls.name, total: 0, promoted: 0, redoubling: 0, leaving: 0 };
    for (const enroll of cls.enrollments) {
      const sid = enroll.userId;
      total++;
      byClass[cls.id].total++;

      const decision = resolveDecision(existingDecisions, sid, cls.id, allGrades, sid);
      const norm = normalizeDecision(decision);

      if (norm === 'promoted') {
        promoted++;
        byClass[cls.id].promoted++;
        const next = getNextLevel(cls.level, cls.name);
        plannedTransitions.push({
          studentId: sid,
          fullName: enroll.user.fullName,
          currentClass: cls.name,
          decision,
          targetClass: next ? next.name : null,
        });
      } else if (norm === 'redoubling') {
        redoubling++;
        byClass[cls.id].redoubling++;
        plannedTransitions.push({
          studentId: sid, fullName: enroll.user.fullName, currentClass: cls.name,
          decision, targetClass: cls.name,
        });
      } else if (norm === 'leaving') {
        leaving++;
        byClass[cls.id].leaving++;
        plannedTransitions.push({
          studentId: sid, fullName: enroll.user.fullName, currentClass: cls.name,
          decision, targetClass: null,
        });
      } else {
        // en_deliberation / provisoire -> maintien en attendant délibération
        byClass[cls.id].redoubling++;
        redoubling++;
        plannedTransitions.push({
          studentId: sid, fullName: enroll.user.fullName, currentClass: cls.name,
          decision, targetClass: cls.name,
        });
      }
    }
  }

  return { total, promoted, redoubling, leaving, byClass };
}

async function buildDiagnostics(schoolId: string) {
  const classes = await db.schoolClass.findMany({
    where: { schoolId },
    include: { enrollments: { include: { user: { select: { id: true } } } } },
  });
  const studentIds = classes.flatMap((c) => c.enrollments.map((e) => e.userId));
  const grades = await db.grade.findMany({ where: { schoolId, studentId: { in: studentIds } } });
  const reportCards = await db.reportCard.findMany({ where: { schoolId } });

  const studentsWithoutGrades = studentIds.filter(
    (sid) => !grades.some((g) => g.studentId === sid)
  ).length;

  const unvalidatedBulletins = reportCards.filter((rc) => rc.status !== 'validated').length;

  const classesIncomplete: string[] = [];
  for (const cls of classes) {
    const sids = cls.enrollments.map((e) => e.userId);
    const withGrades = sids.filter((sid) => grades.some((g) => g.studentId === sid)).length;
    if (sids.length > 0 && withGrades < sids.length) classesIncomplete.push(cls.name);
  }

  const anomalies: string[] = [];
  if (studentsWithoutGrades > 0)
    anomalies.push(`${studentsWithoutGrades} élève(s) sans aucune note enregistrée.`);
  if (unvalidatedBulletins > 0)
    anomalies.push(`${unvalidatedBulletins} bulletin(s) non validé(s).`);
  if (classesIncomplete.length > 0)
    anomalies.push(`Classes avec évaluations incomplètes : ${classesIncomplete.join(', ')}.`);

  return {
    studentsWithoutGrades,
    unvalidatedBulletins,
    classesIncomplete,
    anomalies,
    canClose: anomalies.length === 0,
  };
}

function getCurrentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
}

function computeAutoDecision(overallAverage: number, unjustifiedAbsences: number): string {
  if (overallAverage >= 10 && unjustifiedAbsences <= 10) return 'passage';
  if (overallAverage < 9) return 'redoublement';
  return 'en_deliberation';
}

// Résout la décision réelle : délibération enregistrée en priorité, sinon auto.
function resolveDecision(
  decisions: { studentId: string; classId: string; decision: string }[],
  studentId: string,
  classId: string,
  grades: { studentId: string; score: number; maxScore: number }[],
  _sid: string
): string {
  const recorded = decisions.find((d) => d.studentId === studentId && d.classId === classId);
  if (recorded) return recorded.decision;
  const sg = grades.filter((g) => g.studentId === studentId);
  if (sg.length === 0) return 'en_deliberation';
  const sumScore = sg.reduce((s, g) => s + g.score, 0);
  const sumMax = sg.reduce((s, g) => s + g.maxScore, 0);
  const avg20 = sumMax > 0 ? (sumScore / sumMax) * 20 : 0;
  return computeAutoDecision(avg20, 0);
}

function normalizeDecision(decision: string): 'promoted' | 'redoubling' | 'leaving' | 'pending' {
  if (decision === 'passage' || decision === 'admis_apres_deliberation') return 'promoted';
  if (decision === 'redoublement' || decision === 'non_admis') return 'redoubling';
  if (decision === 'transfert' || decision === 'abandon' || decision === 'fin_cursus') return 'leaving';
  return 'pending';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    const body = await request.json();
    const { action, classId, decisions, newAcademicYear } = body;
    const schoolId = auth.schoolId;
    const adminId = auth.userId;

    if (!action || !schoolId || !adminId) {
      return NextResponse.json({ error: 'Missing fields: action, schoolId, adminId' }, { status: 400 });
    }

    if (action === 'lock-year') {
      // Verrouille réellement l'année scolaire active de l'école
      const now = new Date();
      const year = await db.schoolYear.findFirst({
        where: { schoolId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });
      if (year) {
        await db.schoolYear.update({
          where: { id: year.id },
          data: { status: 'LOCKED', closedAt: now },
        });
      } else {
        // Aucune année enregistrée : on en crée une verrouillée par sécurité
        const school = await db.school.findUnique({
          where: { id: schoolId },
          select: { academicYear: true },
        });
        await db.schoolYear.create({
          data: {
            schoolId,
            year: school?.academicYear || new Date().getFullYear().toString(),
            status: 'LOCKED',
            closedAt: now,
          },
        });
      }
      await db.notification.create({
        data: {
          schoolId,
          title: 'Année scolaire verrouillée',
          message: `L'année scolaire a été verrouillée par l'administration. Les saisies de notes et de présences sont suspendues.`,
          type: 'SYSTEM',
          senderId: adminId,
        },
      });
      return NextResponse.json({ success: true, message: 'Année verrouillée' });
    }

    if (action === 'generate-classes' && decisions && newAcademicYear && classId) {
      const currentClass = await db.schoolClass.findUnique({ where: { id: classId } });
      if (!currentClass) {
        return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 });
      }

      for (const decision of decisions) {
        const studentId = decision.studentId;
        const status = decision.status;
        const comment = decision.comment || '';

        await db.deliberationDecision.create({
          data: {
            schoolId,
            studentId,
            classId,
            academicYear: currentClass.createdAt.getFullYear().toString() + ' - ' + newAcademicYear,
            decision: status,
            validatedBy: adminId,
            comment,
          },
        });

        await applyTransition(schoolId, adminId, studentId, classId, currentClass, status, newAcademicYear, comment);
      }

      await db.notification.create({
        data: {
          schoolId,
          title: 'Classes générées pour la nouvelle année',
          message: `Les classes pour l'année ${newAcademicYear} ont été créées.`,
          type: 'SYSTEM',
          senderId: adminId,
        },
      });

      return NextResponse.json({ success: true, message: 'Classes générées avec succès' });
    }

    // Clôture + transition SCHOOL-WIDE (atomique)
    if (action === 'close-year') {
      const targetYear = newAcademicYear || getNextAcademicYear();
      const result = await executeSchoolWideTransition(schoolId, adminId, targetYear);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function executeSchoolWideTransition(schoolId: string, adminId: string, newYear: string) {
  const classes = await db.schoolClass.findMany({
    where: { schoolId },
    include: { enrollments: { include: { user: { select: { id: true, fullName: true, parentId: true } } } } },
  });

  const studentIds = classes.flatMap((c) => c.enrollments.map((e) => e.userId));
  const allGrades = await db.grade.findMany({ where: { schoolId, studentId: { in: studentIds } } });
  const existingDecisions = await db.deliberationDecision.findMany({
    where: { schoolId, academicYear: getCurrentAcademicYear() },
  });

  const tx: any[] = [];
  let promoted = 0;
  let redoubling = 0;
  let leaving = 0;
  const notified: { userId: string; parentId?: string | null; fullName: string; label: string }[] = [];

  for (const cls of classes) {
    for (const enroll of cls.enrollments) {
      const sid = enroll.userId;
      const decision = resolveDecision(existingDecisions, sid, cls.id, allGrades, sid);
      const norm = normalizeDecision(decision);

      if (norm === 'promoted') {
        const next = getNextLevel(cls.level, cls.name);
        if (!next) {
          // Fin de cursus -> sortie
          tx.push(db.user.update({ where: { id: sid }, data: { academicYear: newYear, active: false } }));
          leaving++;
          notified.push({ userId: sid, parentId: enroll.user.parentId, fullName: enroll.user.fullName, label: 'Fin de cursus (diplômé)' });
          continue;
        }
        let nextClass = await db.schoolClass.findFirst({ where: { schoolId, name: next.name, level: next.level } });
        if (!nextClass) {
          nextClass = await db.schoolClass.create({ data: { schoolId, name: next.name, level: next.level, fees: cls.fees } });
        }
        tx.push(db.enrolledClass.deleteMany({ where: { userId: sid, classId: cls.id } }));
        tx.push(db.enrolledClass.upsert({
          where: { userId_classId: { userId: sid, classId: nextClass.id } },
          create: { userId: sid, classId: nextClass.id },
          update: {},
        }));
        tx.push(db.user.update({ where: { id: sid }, data: { academicYear: newYear } }));
        promoted++;
        notified.push({ userId: sid, parentId: enroll.user.parentId, fullName: enroll.user.fullName, label: `Admis(e) en ${next.name}` });
      } else if (norm === 'redoubling') {
        tx.push(db.user.update({ where: { id: sid }, data: { academicYear: newYear } }));
        redoubling++;
        notified.push({ userId: sid, parentId: enroll.user.parentId, fullName: enroll.user.fullName, label: 'Non admis(e) - redoublement' });
      } else if (norm === 'leaving') {
        tx.push(db.user.update({ where: { id: sid }, data: { academicYear: newYear, active: false } }));
        leaving++;
        notified.push({ userId: sid, parentId: enroll.user.parentId, fullName: enroll.user.fullName, label: 'Sortie de l\'établissement' });
      } else {
        // en délibération -> maintien en attendant décision définitive
        tx.push(db.user.update({ where: { id: sid }, data: { academicYear: newYear } }));
        redoubling++;
        notified.push({ userId: sid, parentId: enroll.user.parentId, fullName: enroll.user.fullName, label: 'Maintien (délibération en attente)' });
      }
    }
  }

  // Historise la clôture + ouvre la nouvelle année
  tx.push(db.schoolYear.upsert({
    where: { schoolId_year: { schoolId, year: getCurrentAcademicYear() } },
    create: { schoolId, year: getCurrentAcademicYear(), status: 'CLOSED', closedById: adminId, closedAt: new Date(), transitionData: { newYear, promoted, redoubling, leaving } },
    update: { status: 'CLOSED', closedById: adminId, closedAt: new Date(), transitionData: { newYear, promoted, redoubling, leaving } },
  }));
  tx.push(db.schoolYear.upsert({
    where: { schoolId_year: { schoolId, year: newYear } },
    create: { schoolId, year: newYear, status: 'OPEN' },
    update: { status: 'OPEN' },
  }));

  await db.$transaction(tx);

  // Notifications temps réel (déjà diffusées via Supabase Realtime)
  for (const n of notified) {
    try { await notifyUser({
      schoolId,
      userId: n.userId,
      title: 'Résultat de fin d\'année',
      message: `Votre situation pour ${newYear} : ${n.label}.`,
      type: 'SYSTEM',
      priority: 'HIGH',
    }); } catch (e) { console.error('[EndOfYear] Student notification failed (non-blocking):', e); }
    if (n.parentId) {
      try { await notifyUser({
        schoolId,
        userId: n.parentId,
        title: `Résultat : ${n.fullName}`,
        message: `Situation de fin d'année de ${n.fullName} (${newYear}) : ${n.label}.`,
        type: 'SYSTEM',
        priority: 'HIGH',
      }); } catch (e) { console.error('[EndOfYear] Parent notification failed (non-blocking):', e); }
    }
  }

  return { newYear, promoted, redoubling, leaving };
}

async function applyTransition(
  schoolId: string,
  adminId: string,
  studentId: string,
  classId: string,
  currentClass: { level: string; name: string; fees: number },
  status: string,
  newAcademicYear: string,
  comment: string
) {
  const norm = normalizeDecision(status);
  if (norm === 'promoted') {
    const next = getNextLevel(currentClass.level, currentClass.name);
    if (next) {
      let nextClass = await db.schoolClass.findFirst({ where: { schoolId, name: next.name, level: next.level } });
      if (!nextClass) nextClass = await db.schoolClass.create({ data: { schoolId, name: next.name, level: next.level, fees: currentClass.fees } });
      await db.enrolledClass.deleteMany({ where: { userId: studentId, classId } });
      await db.enrolledClass.upsert({
        where: { userId_classId: { userId: studentId, classId: nextClass.id } },
        create: { userId: studentId, classId: nextClass.id },
        update: {},
      });
    }
    await db.user.update({ where: { id: studentId }, data: { academicYear: newAcademicYear } });
  } else if (norm === 'leaving') {
    await db.user.update({ where: { id: studentId }, data: { academicYear: newAcademicYear, active: false } });
  } else {
    // redoubling / pending -> maintien
    await db.user.update({ where: { id: studentId }, data: { academicYear: newAcademicYear } });
  }

  const labelMap: Record<string, string> = {
    passage: 'Admis(e) en classe supérieure',
    admis_apres_deliberation: 'Admis(e) après délibération',
    redoublement: 'Non admis(e) - redoublement',
    non_admis: 'Non admis(e)',
    en_deliberation: 'En délibération (décision provisoire)',
    transfert: 'Transfert vers un autre établissement',
    abandon: 'Abandon scolaire',
    fin_cursus: 'Fin de cursus',
  };
  const statusLabel = labelMap[status] || status;

  await db.notification.create({
    data: {
      schoolId,
      userId: studentId,
      senderId: adminId,
      title: 'Résultat de fin d\'année',
      message: `Votre décision pour ${newAcademicYear} est : ${statusLabel}. ${comment ? `Note : ${comment}` : ''}`,
      type: 'SYSTEM',
      priority: 'HIGH',
    },
  });

  const childUser = await db.user.findUnique({ where: { id: studentId }, select: { parentId: true, fullName: true } });
  if (childUser?.parentId) {
    await db.notification.create({
      data: {
        schoolId,
        userId: childUser.parentId,
        senderId: adminId,
        title: `Résultat de fin d'année : ${childUser.fullName}`,
        message: `La décision pour votre enfant ${childUser.fullName} est : ${statusLabel}. ${comment ? `Note : ${comment}` : ''}`,
        type: 'SYSTEM',
        priority: 'HIGH',
      },
    });
  }
}

function getNextLevel(level: string, name: string): { name: string; level: string } | null {
  const levels = ['Maternelle', 'Primaire', 'Secondaire'];
  const currentIdx = levels.indexOf(level);
  if (currentIdx === -1 || currentIdx >= levels.length - 1) return null;
  if (level === 'Primaire') {
    const currentNum = parseInt(name.replace(/[^0-9]/g, '')) || 1;
    const nextNum = currentNum + 1;
    if (nextNum > 6) return { name: '1ère', level: 'Secondaire' };
    return { name: `${nextNum}ème`, level: 'Primaire' };
  }
  if (level === 'Secondaire') {
    const currentNum = parseInt(name.replace(/[^0-9]/g, '')) || 1;
    const nextNum = currentNum + 1;
    if (nextNum > 6) return null;
    const names: Record<number, string> = { 1: '7ème', 2: '8ème', 3: '1ère', 4: '2ème', 5: '3ème', 6: '4ème' };
    return { name: names[nextNum] || `${nextNum}ème`, level: 'Secondaire' };
  }
  return { name: '1ère', level: 'Primaire' };
}

function getNextAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y + 1}-${y + 2}`;
}
