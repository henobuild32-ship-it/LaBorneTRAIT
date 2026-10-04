import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_SIZE = 8 * 1024 * 1024;

// POST /api/announcements/parse-pdf - extraction du texte d'un PDF de communiqué (administration)
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Fichier PDF requis.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Seuls les fichiers PDF sont acceptés.' }, { status: 415 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (8 Mo maximum).' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    let text = '';
    let pages = 0;
    try {
      const result = await parser.getText();
      pages = result.total;
      text = (result.text || '')
        .replace(/^[ \t]*--[ \t]*\d+[ \t]+of[ \t]+\d+[ \t]*--[ \t]*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } finally {
      await parser.destroy();
    }

    if (!text) {
      return NextResponse.json(
        { error: 'Aucun texte extractible dans ce PDF (document peut-être scanné).' },
        { status: 422 }
      );
    }

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const title = (lines[0] || 'Communiqué importé').slice(0, 160);
    const body = (lines.length > 1 ? lines.slice(1).join('\n') : text).trim();

    return NextResponse.json({
      title,
      message: body,
      pages,
      fileName: file.name,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /api/announcements/parse-pdf]', err);
    return NextResponse.json(
      { error: 'Impossible de lire ce PDF. Vérifiez le fichier puis réessayez.' },
      { status: 500 }
    );
  }
}
