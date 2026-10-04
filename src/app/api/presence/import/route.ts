import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { CsvObject, pickValue, toIsoDate, toTime } from '@/lib/csv';

export const runtime = 'nodejs';

function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeStatut(value: string): { statut: string | null; error?: string } {
  const raw = deaccent(value);
  if (!raw) return { statut: 'PRESENT' };
  if (raw.startsWith('pres')) return { statut: 'PRESENT' };
  if (raw.startsWith('abs')) return { statut: 'ABSENT' };
  if (raw.startsWith('retard') || raw === 'ret') return { statut: 'RETARD' };
  if (raw.startsWith('just')) return { statut: 'JUSTIFIE' };
  return { statut: null, error: `statut inconnu « ${value} » (attendu : Présent, Absent, Retard ou Justifié)` };
}

interface StudentRef {
  id: string;
  fullName: string;
  matricule: string | null;
}

// POST /api/presence/import - import de présences en masse (administration)
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, rows } = body as { schoolId?: string; rows?: CsvObject[] };

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne à importer.' }, { status: 400 });
    }

    const students = await db.user.findMany({
      where: { schoolId, role: 'STUDENT', deletedAt: null },
      select: { id: true, fullName: true, matricule: true },
    });

    const byMatricule = new Map<string, StudentRef>();
    const byName = new Map<string, StudentRef[]>();
    for (const student of students) {
      const matriculeKey = deaccent(student.matricule || '');
      if (matriculeKey) byMatricule.set(matriculeKey, student);
      const nameKey = deaccent(student.fullName);
      const list = byName.get(nameKey) || [];
      list.push(student);
      byName.set(nameKey, list);
    }

    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const line = index + 1;

      const dateRaw = pickValue(row, ['Date', 'Jour']);
      const isoDate = dateRaw ? toIsoDate(dateRaw) : null;
      if (!isoDate) {
        errors.push(`Ligne ${line} : date invalide « ${dateRaw || 'vide'} ».`);
        continue;
      }

      const studentRaw = pickValue(row, ['Élève', 'Eleve', 'Elève', 'Nom', 'Étudiant', 'Matricule', 'Apprenant']);
      if (!studentRaw) {
        errors.push(`Ligne ${line} : élève manquant (nom complet ou matricule).`);
        continue;
      }

      let student: StudentRef | undefined = byMatricule.get(deaccent(studentRaw));
      if (!student) {
        const candidates = byName.get(deaccent(studentRaw)) || [];
        if (candidates.length > 1) {
          errors.push(`Ligne ${line} : plusieurs élèves nommés « ${studentRaw} », utilisez le matricule.`);
          continue;
        }
        student = candidates[0];
      }
      if (!student) {
        errors.push(`Ligne ${line} : élève « ${studentRaw} » introuvable dans l'école.`);
        continue;
      }

      const statutResult = normalizeStatut(pickValue(row, ['Statut', 'Présence', 'Presence', 'État', 'Etat']));
      if (!statutResult.statut) {
        errors.push(`Ligne ${line} : ${statutResult.error}.`);
        continue;
      }

      const date = new Date(`${isoDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        errors.push(`Ligne ${line} : date invalide « ${dateRaw} ».`);
        continue;
      }
      const timeRaw = pickValue(row, ['Heure', 'Heure arrivée', 'Heure arrivee', 'Arrivée', 'Arrivee', 'Heure d arrivee']);
      const time = timeRaw ? toTime(timeRaw) : null;
      if (timeRaw && !time) {
        errors.push(`Ligne ${line} : heure invalide « ${timeRaw} » (format attendu HH:MM).`);
        continue;
      }
      const heureArrivee = time ? new Date(`${isoDate}T${time}:00`) : date;
      const justification = pickValue(row, ['Justification', 'Motif', 'Remarque']) || null;

      try {
        const existing = await db.presence.findUnique({
          where: { userId_date: { userId: student.id, date } },
          select: { id: true },
        });
        if (existing) {
          await db.presence.update({
            where: { id: existing.id },
            data: { statut: statutResult.statut, heureArrivee, justification, validePar: auth.userId },
          });
          updated += 1;
        } else {
          await db.presence.create({
            data: {
              schoolId,
              userId: student.id,
              date,
              heureArrivee,
              statut: statutResult.statut,
              justification,
              validePar: auth.userId,
            },
          });
          created += 1;
        }
      } catch (entryError) {
        errors.push(
          `Ligne ${line} : échec de l'enregistrement (${entryError instanceof Error ? entryError.message : 'erreur'}).`
        );
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /api/presence/import]', err);
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
