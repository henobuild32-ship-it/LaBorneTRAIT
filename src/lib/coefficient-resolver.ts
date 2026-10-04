import { db } from '@/lib/db';

export interface CoefficientResolution {
  byCourse: Record<string, number>;
  effectiveCoefficients: Record<string, number>;
}

/**
 * Résout les coefficients effectifs pour une classe donnée.
 *
 * Priorité :
 *  1. Table `Coefficient` (configurée par l'admin) pour schoolId + classId + schoolYearId actif.
 *  2. `course.coefficient` comme valeur par défaut.
 *
 * @returns { byCourse: Map courseId -> coefficient effectif, effectiveCoefficients: alias }
 */
export async function resolveClassCoefficients(
  schoolId: string,
  classId: string,
  courses: Array<{ id: string; coefficient: number }>
): Promise<CoefficientResolution> {
  const map: Record<string, number> = {};

  for (const c of courses) {
    map[c.id] = c.coefficient > 0 ? c.coefficient : 1;
  }

  try {
    // Trouve l'année scolaire active
    const activeYear = await db.schoolYear.findFirst({
      where: { schoolId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const rows = await db.coefficient.findMany({
      where: {
        schoolId,
        classId,
        ...(activeYear ? { schoolYearId: activeYear.id } : {}),
        isActive: true,
      },
      select: { courseId: true, coefficient: true },
    });

    for (const row of rows) {
      if (row.coefficient > 0) {
        map[row.courseId] = row.coefficient;
      }
    }
  } catch {
    // silencieux — on garde le fallback course.coefficient
  }

  return { byCourse: map, effectiveCoefficients: map };
}

/**
 * Version célibataire pour un cours unique.
 */
export async function resolveCourseCoefficient(
  schoolId: string,
  classId: string,
  courseId: string,
  fallback = 1
): Promise<number> {
  try {
    const effective = await resolveClassCoefficients(schoolId, classId, [
      { id: courseId, coefficient: fallback },
    ]);
    return effective.byCourse[courseId] ?? fallback;
  } catch {
    return fallback;
  }
}