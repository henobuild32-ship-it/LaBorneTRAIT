import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join, normalize } from 'path';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { uploadFile } from '@/lib/storage';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const MAX_SIZE = 12 * 1024 * 1024; // 12 Mo
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
];

/**
 * GET /api/cahier/photos?schoolId=&classId=&courseId=&period=
 * Liste les photos numérisées du cahier de cotation (prise de vue ou import).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const sp = req.nextUrl.searchParams;
    const schoolId = sp.get('schoolId') || auth.schoolId;
    if (schoolId !== auth.schoolId && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const classId = sp.get('classId') || undefined;
    const courseId = sp.get('courseId') || undefined;
    const period = sp.get('period') || undefined;

    const photos = await db.cahierPhoto.findMany({
      where: {
        schoolId,
        classId,
        courseId,
        period,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 60,
    });

    return NextResponse.json(
      { photos },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/cahier/photos]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/cahier/photos  (multipart/form-data)
 * Champs : photo (fichier), classId, courseId?, period?, page?
 */
export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Réservé aux professeurs de secondaire' },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('photo');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Aucune image reçue' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Image trop volumineuse (12 Mo maximum)' },
        { status: 413 },
      );
    }

    const mime = (file.type || '').toLowerCase();
    if (mime && !ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: 'Format non pris en charge (JPEG, PNG, WebP, HEIC…)' },
        { status: 415 },
      );
    }

    const classId = String(formData.get('classId') || '');
    const courseId = String(formData.get('courseId') || '') || undefined;
    const period = String(formData.get('period') || 'P1');
    const page = Number(formData.get('page') || 0);

    if (!classId) {
      return NextResponse.json({ error: 'Classe manquante' }, { status: 400 });
    }

    const schoolClass = await db.schoolClass.findFirst({
      where: { id: classId, schoolId: auth.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!schoolClass) {
      return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 });
    }
    if (courseId) {
      const course = await db.course.findFirst({
        where: { id: courseId, schoolId: auth.schoolId, deletedAt: null },
        select: { id: true },
      });
      if (!course) {
        return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const stamp = Date.now();
    const fileName = `cahier/${auth.schoolId}/${classId}_${courseId || 'nocours'}_${period}_${stamp}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { url } = await uploadFile(buffer, fileName, mime || 'image/jpeg');

    const count = await db.cahierPhoto.count({
      where: { schoolId: auth.schoolId, classId, courseId: courseId ?? null, period, deletedAt: null },
    });

    const photo = await db.cahierPhoto.create({
      data: {
        schoolId: auth.schoolId,
        classId,
        courseId: courseId ?? null,
        period,
        page: Number.isFinite(page) && page > 0 ? page : count + 1,
        url,
        fileName: file.name || fileName,
        mimeType: mime || 'image/jpeg',
        size: file.size,
        uploadedById: auth.userId,
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /api/cahier/photos]', err);
    return NextResponse.json({ error: "Échec de l'envoi de la photo" }, { status: 500 });
  }
}

/**
 * DELETE /api/cahier/photos?id=
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });
    }

    const photo = await db.cahierPhoto.findFirst({
      where: { id, schoolId: auth.schoolId },
    });
    if (!photo) {
      return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && photo.uploadedById !== auth.userId) {
      return NextResponse.json(
        { error: 'Seul le professeur qui a envoyé la photo peut la supprimer' },
        { status: 403 },
      );
    }

    await db.cahierPhoto.update({
      where: { id: photo.id },
      data: { deletedAt: new Date() },
    });

    // Suppression physique si le fichier est stocké localement (pas de stockage distant).
    if (photo.url.startsWith('/uploads/')) {
      try {
        const target = normalize(join(process.cwd(), 'public', photo.url));
        if (target.startsWith(normalize(join(process.cwd(), 'public')))) {
          await unlink(target);
        }
      } catch {
        // fichier déjà absent : on garde la suppression logique
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[DELETE /api/cahier/photos]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
