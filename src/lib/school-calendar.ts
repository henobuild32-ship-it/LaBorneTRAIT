import { db } from '@/lib/db';

export const CYCLE_MATERNELLE = 'Maternelle';
export const CYCLE_PRIMAIRE = 'Primaire';
export const CYCLE_EB = 'EB';
export const CYCLE_HUMANITES = 'Humanites';

export const CYCLES = [CYCLE_MATERNELLE, CYCLE_PRIMAIRE, CYCLE_EB, CYCLE_HUMANITES];

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function monthName(month: number): string {
  return MONTH_NAMES[(month - 1 + 12) % 12] || '';
}

export function schoolYearLabelForDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 9) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

/**
 * Calendrier scolaire par défaut (année scolaire ouverte à l'instant T).
 * Règles RDC :
 *  - Primaire : T1=Sept-Nov, T2=Déc-Fév, T3=Mar-Mai (périodes P1-P3)
 *  - Maternelle : 3 trimestres = 3 mois (P1-P3)
 *  - EB/Humanités : S1=P1+P2 (Sept-Fév), S2=P3+P4 (Mar-Juin), ExS1 après P2, ExS2 après P4
 *  - Été (Juin-Juillet) rattaché à la dernière période, Août hors programme (préparation)
 */
const DEFAULT_CALENDAR: Record<string, { trimester: number; semester: number; period: string }[]> = {
  Maternelle: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
  ],
  Primaire: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
  ],
  EB: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
  ],
  Humanites: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
  ],
};

/**
 * Résout le mapping mois -> trimestre/semestre/période pour un cycle.
 * Priorité 1 : table CalendrierScolaire (configurable par le Super Admin).
 * Priorité 2 : calendrier par défaut.
 */
export async function resolvePeriodForMonth(
  schoolId: string,
  schoolYearId: string,
  month: number,
  cycle: string
): Promise<{ trimester: number | null; semester: number | null; period: string }> {
  try {
    const row = await db.calendrierScolaire.findFirst({
      where: {
        schoolId,
        schoolYearId,
        month,
        cycle: { in: ['ALL', cycle] },
      },
      orderBy: { cycle: 'asc' },
      select: { trimester: true, semester: true, period: true },
    });
    if (row) {
      return { trimester: row.trimester, semester: row.semester, period: row.period };
    }
  } catch {
    // fallback silencieux
  }
  const table = DEFAULT_CALENDAR[cycle] || DEFAULT_CALENDAR[CYCLE_PRIMAIRE];
  const slot = table[(month - 1 + 12) % 12] || { trimester: null, semester: null, period: 'P1' };
  return slot;
}

export type CyclePeriod = 'P1' | 'P2' | 'P3' | 'P4' | 'ExT1' | 'ExT2' | 'ExT3' | 'ExS1' | 'ExS2';

/**
 * Périodes d'évaluation (examens) par cycle.
 * - Maternelle : ExT1/ExT2/ExT3
 * - Primaire : ExT1/ExT2/ExT3
 * - EB/Humanités : ExS1/ExS2
 */
export function examPeriodsForCycle(cycle: string): CyclePeriod[] {
  if (cycle === CYCLE_EB || cycle === CYCLE_HUMANITES) return ['ExS1', 'ExS2'];
  return ['ExT1', 'ExT2', 'ExT3'];
}

/**
 * Périodes d'encodage (hors examens) par cycle.
 */
export function normalPeriodsForCycle(cycle: string): string[] {
  if (cycle === CYCLE_EB || cycle === CYCLE_HUMANITES) return ['P1', 'P2', 'P3', 'P4'];
  return ['P1', 'P2', 'P3'];
}

/**
 * Convertit un label d'évaluation en type d'évaluation standard.
 */
export function normalizeTypeEvaluation(raw: string | undefined | null, maxScore: number): string {
  const r = (raw || '').trim().toLowerCase();
  if (r.includes('examen')) return 'Examen';
  if (r.includes('devoir')) return 'Devoir';
  if (r.includes('interro')) return 'Interrogation';
  if (maxScore >= 40) return 'Examen';
  return 'Interrogation';
}

/**
 * Calcule la moyenne d'un semestre pour EB/Humanités :
 * Moyenne P1+P2 (40%) + Examen S1 (60%).
 */
export function computeSemesterAverage(
  regularAverage: number | null,
  examAverage: number | null
): number | null {
  if (regularAverage === null && examAverage === null) return null;
  const reg = regularAverage ?? 0;
  const ex = examAverage ?? 0;
  return (reg * 0.4) + (ex * 0.6);
}
