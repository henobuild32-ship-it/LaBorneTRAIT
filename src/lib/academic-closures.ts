import { db } from '@/lib/db';

export type ClosureScope = 'DAY' | 'WEEK' | 'MONTH' | 'TRIMESTER' | 'SEMESTER' | 'YEAR';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calendarWeek(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - start.getTime()) / 86400000) + 1) / 7);
}

export function closureKey(scope: ClosureScope, date: Date, trimester: string): string {
  const year = date.getUTCFullYear();
  if (scope === 'DAY') return isoDate(date);
  if (scope === 'WEEK') return `${year}-W${String(calendarWeek(date)).padStart(2, '0')}`;
  if (scope === 'MONTH') return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  if (scope === 'YEAR') return String(year);
  if (scope === 'SEMESTER') return trimester.startsWith('P') || trimester === 'EX1' ? '1' : '2';
  return trimester;
}

export async function assertGradePeriodOpen(params: {
  schoolId: string;
  schoolYearId?: string | null;
  date: Date;
  trimester: string;
}): Promise<void> {
  const { schoolId, date, trimester } = params;
  const year = params.schoolYearId || (await db.schoolYear.findFirst({
    where: { schoolId, status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  }))?.id;
  if (!year) return;

  const scopes: ClosureScope[] = ['DAY', 'WEEK', 'MONTH', 'TRIMESTER', 'SEMESTER', 'YEAR'];
  const closures = await db.academicClosure.findMany({
    where: { schoolId, schoolYearId: year, scope: { in: scopes } },
    select: { scope: true, key: true },
  });
  const blocked = closures.find((item) => item.key === closureKey(item.scope as ClosureScope, date, trimester));
  if (blocked) {
    const labels: Record<string, string> = { DAY: 'jour', WEEK: 'semaine', MONTH: 'mois', TRIMESTER: 'trimestre', SEMESTER: 'semestre', YEAR: 'année' };
    throw new Error(`Cette note est bloquée : la période (${labels[blocked.scope] || blocked.scope}) est clôturée.`);
  }
}

export { calendarWeek };