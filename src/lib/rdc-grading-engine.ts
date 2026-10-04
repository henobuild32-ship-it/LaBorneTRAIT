/**
 * rdc-grading-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Moteur universel de cotation, calculs et délibérations pour LaBorneTRAIT (RDC).
 * Conforme aux spécifications du Ministère de l'EPST :
 *
 * 1. Une note n'est pas un score sur 20 : la pondération est intrinsèque
 *    au maximum de points de chaque matière (10, 20, 30, 40, 50, 60, 100...).
 * 2. Distinction stricte entre Maximum de Points et Coefficients académiques.
 * 3. Gestion précise des 3 cycles :
 *    - Maternelle : Mode Qualitatif (Acquis, En cours, À renforcer) ou Numérique.
 *    - Éducation de Base (1ère-6ème primaire + 7ème & 8ème EB/CTEB).
 *    - Humanités (1ère à 4ème - S1 = TJ+Ex, S2 = TJ+Ex, Annuel = S1+S2).
 * 4. Calcul officiel du pourcentage global : (Σ Points Obtenus / Σ Points Maximum) * 100.
 * 5. Classement officiel avec ex-aequo (1, 1, 3...) affiché sous la forme "Place : 1 / 42".
 * 6. Décisions administratives configurables (PASSED, RETAKE_REQUIRED, FAILED...).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type RdcCycle = 'MATERNELLE' | 'EDUCATION_DE_BASE' | 'HUMANITES';

export type AdministrativeDecision =
  | 'PASSED'          // Passe / Admis
  | 'RETAKE_REQUIRED' // Repêchage / Ajourné (Session de rattrapage)
  | 'FAILED'          // Double / Échoue
  | 'PROMOTED'        // Promu avec réserve
  | 'REPEATING';      // Doublement confirmé

export type QualitativeGrade = 'ACQUIS' | 'EN_COURS' | 'A_RENFORCER' | 'NON_ACQUIS';

export interface SubjectRuleInput {
  courseId: string;
  courseName: string;
  maximumPoints?: number;       // Ex: 100
  dailyWorkMaximum?: number;    // Ex: 40 (TJ max S1/S2)
  examMaximum?: number;         // Ex: 60 (Exam max S1/S2)
  coefficient?: number | null;  // Coefficient explicite optionnel (1, 2, 3...)
  isQualitative?: boolean;
}

export interface StudentCourseEvaluationMarks {
  courseId: string;
  courseName: string;
  // Semestre 1 / Périodes 1 & 2
  tj1?: number | null;
  tj2?: number | null;
  exam1?: number | null;
  // Semestre 2 / Périodes 3 & 4
  tj3?: number | null;
  tj4?: number | null;
  exam2?: number | null;
  // Autres évaluations directes ou trimestrielles
  otherScores?: number[];
  // Mode qualitatif
  qualitativeAppreciation?: QualitativeGrade | string;
}

export interface GradingDecisionConfig {
  passPercentage?: number;        // Défaut: 50.0%
  retakeMinPercentage?: number;   // Défaut: 45.0%
  maxFailedCourses?: number;      // Défaut: 2 matières en dessous de 50%
  eliminationPercentage?: number | null; // Défaut: 35.0%
  maternelleMode?: 'QUALITATIF' | 'NUMERIQUE' | string;
}

export interface ComputedSubjectResult {
  courseId: string;
  courseName: string;
  maxTJ1: number;
  maxTJ2: number;
  maxExam1: number;
  maxTJ3: number;
  maxTJ4: number;
  maxExam2: number;
  // Scores
  tj1: number | null;
  tj2: number | null;
  exam1: number | null;
  tj3: number | null;
  tj4: number | null;
  exam2: number | null;
  // Agrégations Semestre 1
  totalTJ1: number;
  maxTJ_S1: number;
  totalS1: number;
  maxS1: number;
  percentageS1: number;
  // Agrégations Semestre 2
  totalTJ2: number;
  maxTJ_S2: number;
  totalS2: number;
  maxS2: number;
  percentageS2: number;
  // Total Annuel
  totalAnnual: number;
  maxAnnual: number;
  percentageAnnual: number;
  // Coefficient & Pondération
  coefficient: number;
  isPassed: boolean; // >= 50% de son maximum
  qualitativeAppreciation?: string;
}

export interface ComputedReportCardResult {
  studentId: string;
  studentName: string;
  cycle: RdcCycle;
  trimesterOrSemester: string; // '1' | '2' | 'ANNUAL' | 'P1'..
  subjects: ComputedSubjectResult[];
  // Totaux globaux (Pondération intrinsèque par maxima)
  totalPointsObtained: number;
  totalPointsPossible: number;
  overallPercentage: number;
  // Moyenne pondérée par coefficient explicite (si utilisé)
  weightedAveragePercentage: number;
  // Décision administrative
  decision: AdministrativeDecision;
  decisionLabel: string; // "PASSE" | "REPÊCHAGE (AJOURNÉ)" | "DOUBLE"
  failedCoursesCount: number;
  // Rang (calculé au niveau de la classe)
  rank?: number;
  totalStudentsInClass?: number;
  rankDisplay?: string; // Ex: "1 / 42" ou "1er ex-aequo / 42"
  mention: string;
}

/**
 * 1. Détecte le cycle éducatif congolais à partir des métadonnées de la classe.
 */
export function detectCycle(classInfo?: { name?: string; level?: string; cycle?: string } | null): RdcCycle {
  if (!classInfo) return 'EDUCATION_DE_BASE';
  const name = (classInfo.name || '').toLowerCase();
  const level = (classInfo.level || '').toLowerCase();
  const cycle = (classInfo.cycle || '').toLowerCase();

  // Maternelle
  if (
    cycle === 'maternelle' ||
    level === 'maternelle' ||
    name.includes('maternelle') ||
    name.includes('creche') ||
    name.includes('garderie') ||
    name.includes('petite section') ||
    name.includes('moyenne section') ||
    name.includes('grande section')
  ) {
    return 'MATERNELLE';
  }

  // Humanités (Secondaire supérieur / cycle long)
  if (
    cycle === 'humanites' ||
    level === 'humanites' ||
    name.includes('humanit') ||
    name.includes('scientifique') ||
    name.includes('commerciale') ||
    name.includes('pedagogique') ||
    name.includes('technique') ||
    name.includes('litteraire') ||
    name.includes('nutrition') ||
    name.includes('mecanique') ||
    name.includes('electricite') ||
    name.includes('electronique')
  ) {
    return 'HUMANITES';
  }

  // Éducation de Base (1ère à 6ème primaire + 7e et 8e EB/CTEB)
  return 'EDUCATION_DE_BASE';
}

/**
 * 2. Calcule les résultats détaillés d'une matière selon ses règles (maxima TJ, examen, total).
 */
export function computeSubjectDetail(
  marks: StudentCourseEvaluationMarks,
  rule?: SubjectRuleInput | null
): ComputedSubjectResult {
  const maxTotal = rule?.maximumPoints && rule.maximumPoints > 0 ? rule.maximumPoints : 100;
  
  // Par défaut en RDC : TJ = 40% du total semestriel, Examen = 60% du total semestriel.
  const defaultMaxTJ_S = rule?.dailyWorkMaximum !== undefined ? rule.dailyWorkMaximum : Math.round(maxTotal * 0.4);
  const defaultMaxExam_S = rule?.examMaximum !== undefined ? rule.examMaximum : Math.round(maxTotal * 0.6);

  const maxTJ1 = Math.round(defaultMaxTJ_S / 2);
  const maxTJ2 = defaultMaxTJ_S - maxTJ1;
  const maxExam1 = defaultMaxExam_S;

  const maxTJ3 = maxTJ1;
  const maxTJ4 = maxTJ2;
  const maxExam2 = maxExam1;

  const tj1 = marks.tj1 !== undefined && marks.tj1 !== null ? Number(marks.tj1) : null;
  const tj2 = marks.tj2 !== undefined && marks.tj2 !== null ? Number(marks.tj2) : null;
  const exam1 = marks.exam1 !== undefined && marks.exam1 !== null ? Number(marks.exam1) : null;

  const tj3 = marks.tj3 !== undefined && marks.tj3 !== null ? Number(marks.tj3) : null;
  const tj4 = marks.tj4 !== undefined && marks.tj4 !== null ? Number(marks.tj4) : null;
  const exam2 = marks.exam2 !== undefined && marks.exam2 !== null ? Number(marks.exam2) : null;

  // Semestre 1
  const totalTJ1 = (tj1 || 0) + (tj2 || 0);
  const totalS1 = totalTJ1 + (exam1 || 0);
  const maxS1 = defaultMaxTJ_S + defaultMaxExam_S;
  const percentageS1 = maxS1 > 0 ? Math.round((totalS1 / maxS1) * 10000) / 100 : 0;

  // Semestre 2
  const totalTJ2 = (tj3 || 0) + (tj4 || 0);
  const totalS2 = totalTJ2 + (exam2 || 0);
  const maxS2 = defaultMaxTJ_S + defaultMaxExam_S;
  const percentageS2 = maxS2 > 0 ? Math.round((totalS2 / maxS2) * 10000) / 100 : 0;

  // Total Annuel
  const totalAnnual = totalS1 + totalS2;
  const maxAnnual = maxS1 + maxS2;
  const percentageAnnual = maxAnnual > 0 ? Math.round((totalAnnual / maxAnnual) * 10000) / 100 : 0;

  const coefficient = rule?.coefficient && rule.coefficient > 0 ? rule.coefficient : 1;
  const isPassed = percentageAnnual >= 50.0;

  return {
    courseId: marks.courseId,
    courseName: marks.courseName || rule?.courseName || 'Matière',
    maxTJ1,
    maxTJ2,
    maxExam1,
    maxTJ3,
    maxTJ4,
    maxExam2,
    tj1,
    tj2,
    exam1,
    tj3,
    tj4,
    exam2,
    totalTJ1,
    maxTJ_S1: defaultMaxTJ_S,
    totalS1,
    maxS1,
    percentageS1,
    totalTJ2,
    maxTJ_S2: defaultMaxTJ_S,
    totalS2,
    maxS2,
    percentageS2,
    totalAnnual,
    maxAnnual,
    percentageAnnual,
    coefficient,
    isPassed,
    qualitativeAppreciation: typeof marks.qualitativeAppreciation === 'string' ? marks.qualitativeAppreciation : undefined,
  };
}

/**
 * 3. Détermine la mention selon le pourcentage global (normes congolaises).
 */
export function getRdcMention(percentage: number): string {
  if (percentage >= 80) return 'Très Grande Distinction (TGD)';
  if (percentage >= 70) return 'Grande Distinction (GD)';
  if (percentage >= 60) return 'Distinction (D)';
  if (percentage >= 50) return 'Satisfaction (S)';
  return 'Ajourné / Insuffisant';
}

/**
 * 4. Détermine la décision administrative (Passage / Repêchage / Doublement)
 * selon les règles configurées (aucune valeur codée en dur).
 */
export function evaluateAdministrativeDecision(
  overallPercentage: number,
  subjects: ComputedSubjectResult[],
  config?: GradingDecisionConfig | null
): { decision: AdministrativeDecision; decisionLabel: string; failedCount: number } {
  const passThreshold = config?.passPercentage ?? 50.0;
  const retakeThreshold = config?.retakeMinPercentage ?? 45.0;
  const maxFailedAllowed = config?.maxFailedCourses ?? 2;
  const eliminationThreshold = config?.eliminationPercentage ?? 35.0;

  // Nombre d'échecs (matières sous 50%)
  const failedSubjects = subjects.filter((s) => s.percentageAnnual < 50.0);
  const failedCount = failedSubjects.length;

  // Vérification de note éliminatoire éventuelle
  const hasEliminatoryGrade = subjects.some((s) => s.percentageAnnual < eliminationThreshold);

  if (overallPercentage >= passThreshold && failedCount === 0) {
    return {
      decision: 'PASSED',
      decisionLabel: 'PASSE',
      failedCount,
    };
  }

  if (overallPercentage >= passThreshold && failedCount <= maxFailedAllowed && !hasEliminatoryGrade) {
    return {
      decision: 'PASSED',
      decisionLabel: 'PASSE (DÉLIBÉRÉ)',
      failedCount,
    };
  }

  // Conditions de repêchage (Ajournement)
  if (overallPercentage >= retakeThreshold && failedCount <= maxFailedAllowed && !hasEliminatoryGrade) {
    return {
      decision: 'RETAKE_REQUIRED',
      decisionLabel: 'REPÊCHAGE (AJOURNÉ)',
      failedCount,
    };
  }

  return {
    decision: 'FAILED',
    decisionLabel: 'DOUBLE',
    failedCount,
  };
}

/**
 * 5. Calcule l'intégralité du bulletin pour un élève.
 */
export function computeStudentBulletin(params: {
  studentId: string;
  studentName: string;
  cycle: RdcCycle;
  trimesterOrSemester: string; // '1' | '2' | 'ANNUAL'
  evaluations: StudentCourseEvaluationMarks[];
  rulesByCourseId: Record<string, SubjectRuleInput>;
  decisionConfig?: GradingDecisionConfig | null;
}): ComputedReportCardResult {
  const {
    studentId,
    studentName,
    cycle,
    trimesterOrSemester,
    evaluations,
    rulesByCourseId,
    decisionConfig,
  } = params;

  const subjects = evaluations.map((ev) => computeSubjectDetail(ev, rulesByCourseId[ev.courseId]));

  // Calcul du total général :
  // SOMME DES POINTS OBTENUS / SOMME DES POINTS MAXIMUMS * 100
  let totalPointsObtained = 0;
  let totalPointsPossible = 0;

  let weightedPercentageSum = 0;
  let totalCoefficients = 0;

  for (const s of subjects) {
    let obtained = s.totalAnnual;
    let possible = s.maxAnnual;

    if (trimesterOrSemester === '1') {
      obtained = s.totalS1;
      possible = s.maxS1;
    } else if (trimesterOrSemester === '2') {
      obtained = s.totalS2;
      possible = s.maxS2;
    }

    totalPointsObtained += obtained;
    totalPointsPossible += possible;

    const subjectPct = possible > 0 ? (obtained / possible) * 100 : 0;
    weightedPercentageSum += subjectPct * s.coefficient;
    totalCoefficients += s.coefficient;
  }

  const overallPercentage =
    totalPointsPossible > 0
      ? Math.round((totalPointsObtained / totalPointsPossible) * 10000) / 100
      : 0;

  const weightedAveragePercentage =
    totalCoefficients > 0
      ? Math.round((weightedPercentageSum / totalCoefficients) * 100) / 100
      : overallPercentage;

  const mention = getRdcMention(overallPercentage);

  const { decision, decisionLabel, failedCount } = evaluateAdministrativeDecision(
    overallPercentage,
    subjects,
    decisionConfig
  );

  return {
    studentId,
    studentName,
    cycle,
    trimesterOrSemester,
    subjects,
    totalPointsObtained: Math.round(totalPointsObtained * 10) / 10,
    totalPointsPossible: Math.round(totalPointsPossible * 10) / 10,
    overallPercentage,
    weightedAveragePercentage,
    decision,
    decisionLabel,
    failedCoursesCount: failedCount,
    mention,
  };
}

/**
 * 6. Classement officiel de la classe avec gestion exacte des ex-aequo.
 * (Competition ranking : si 2 élèves ont 85.40%, les deux sont 1er, le suivant est 3ème).
 * Format d'affichage : "1 / 42" ou "1er ex-aequo / 42".
 */
export function computeClassCompetitionRankings(
  bulletins: ComputedReportCardResult[]
): ComputedReportCardResult[] {
  const totalStudents = bulletins.length;
  if (totalStudents === 0) return [];

  // Trier les élèves par pourcentage global décroissant
  const sorted = [...bulletins].sort((a, b) => b.overallPercentage - a.overallPercentage);

  let currentRank = 1;
  const rankedBulletins: ComputedReportCardResult[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    // Vérifier égalité avec l'élément précédent
    if (i > 0 && current.overallPercentage === sorted[i - 1].overallPercentage) {
      // Même rang que le précédent
      const prevRank = rankedBulletins[i - 1].rank || 1;
      const suffix = prevRank === 1 ? 'er' : 'e';
      const rankDisplay = `${prevRank}${suffix} ex-aequo / ${totalStudents}`;

      rankedBulletins.push({
        ...current,
        rank: prevRank,
        totalStudentsInClass: totalStudents,
        rankDisplay,
      });

      // Mettre à jour l'affichage du précédent s'il n'avait pas encore la mention ex-aequo
      if (rankedBulletins[i - 1].rankDisplay && !rankedBulletins[i - 1].rankDisplay?.includes('ex-aequo')) {
        rankedBulletins[i - 1].rankDisplay = `${prevRank}${suffix} ex-aequo / ${totalStudents}`;
      }
    } else {
      currentRank = i + 1;
      const suffix = currentRank === 1 ? 'er' : 'e';
      const rankDisplay = `${currentRank}${suffix} / ${totalStudents}`;

      rankedBulletins.push({
        ...current,
        rank: currentRank,
        totalStudentsInClass: totalStudents,
        rankDisplay,
      });
    }
  }

  return rankedBulletins;
}
