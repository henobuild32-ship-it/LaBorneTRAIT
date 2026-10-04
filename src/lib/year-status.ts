import { db } from '@/lib/db';

/**
 * Renvoie le statut de l'année scolaire active pour une école.
 * Statuts possibles : OPEN | LOCKED | CLOSED (défaut: OPEN si aucune ligne).
 */
export async function getSchoolYearStatus(schoolId: string): Promise<string> {
  try {
    const year = await db.schoolYear.findFirst({
      where: { schoolId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return year?.status || 'OPEN';
  } catch {
    return 'OPEN';
  }
}

/**
 * Vérifie que l'année scolaire de l'école n'est pas verrouillée.
 * À appeler au début des écritures sensibles (notes, présences, etc.).
 * Lève une erreur explicite si l'année est LOCKED ou CLOSED.
 */
export async function assertYearOpen(schoolId: string): Promise<void> {
  const status = await getSchoolYearStatus(schoolId);
  if (status === 'LOCKED' || status === 'CLOSED') {
    throw new Error(
      "L'année scolaire est verrouillée. Les saisies de notes et de présences sont suspendues jusqu'à la réouverture."
    );
  }
}
