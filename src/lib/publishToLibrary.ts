/**
 * publishToLibrary
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared client helper: publishes a course lesson, homework or document into the
 * digital library (Ressource) so students can find everything in one place.
 */

export type LibraryResourceType = 'LIEN' | 'VIDEO' | 'PDF' | 'FICHIER';

export interface PublishToLibraryInput {
  schoolId: string;
  createdById: string;
  title: string;
  description: string;
  matiere: string;
  niveau: string;
  author: string;
  url: string;
  fileUrl: string;
  type: LibraryResourceType;
  category: string;
  targetClassId: string;
}

export function lessonResourceType(fileUrl: string, fileName: string): LibraryResourceType {
  if (fileUrl?.toLowerCase().endsWith('.pdf')) return 'PDF';
  if (
    fileName === 'Vidéo intégrée' ||
    /youtube|youtu\.be|vimeo|dailymotion/.test(fileUrl || '')
  ) {
    return 'VIDEO';
  }
  if (fileName === 'Lien externe' || /^https?:\/\//.test(fileUrl || '')) return 'LIEN';
  return 'FICHIER';
}

export interface PublishResult {
  ok: boolean;
  error?: string;
  resource?: any;
}

export async function publishToLibrary(input: PublishToLibraryInput): Promise<PublishResult> {
  try {
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: input.schoolId,
        createdById: input.createdById,
        title: input.title,
        description: input.description,
        category: input.category || 'Général',
        matiere: input.matiere,
        niveau: input.niveau,
        author: input.author,
        url: input.url,
        fileUrl: input.fileUrl,
        type: input.type,
        visibility: 'CLASS',
        targetRole: 'ALL',
        targetClassId: input.targetClassId || '',
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.error || `Erreur HTTP ${res.status}` };
    }

    return { ok: true, resource: data.resource };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erreur réseau' };
  }
}
