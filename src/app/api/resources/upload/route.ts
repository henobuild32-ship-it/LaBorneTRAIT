import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { uploadFile } from '@/lib/storage';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'application/json': '.json',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const allowed = ['TEACHER', 'ADMIN', 'STUDENT', 'PARENT'];
    if (!allowed.includes(auth.role)) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 });
    if (!ALLOWED[file.type]) return NextResponse.json({ error: 'Type non supporté.' }, { status: 415 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop volumineux (25 Mo).' }, { status: 413 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = ALLOWED[file.type];
    const { url } = await uploadFile(buffer, `${randomUUID()}${ext}`, file.type);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Resource upload error:', error);
    return NextResponse.json({ error: "Impossible d'enregistrer le fichier. Vérifiez votre connexion puis réessayez." }, { status: 500 });
  }
}