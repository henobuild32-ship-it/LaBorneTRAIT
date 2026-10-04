import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { uploadFile } from '@/lib/storage';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('photo') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `profiles/${auth.userId}_${Date.now()}.${ext}`;

    const { url } = await uploadFile(buffer, filename, file.type);

    await db.user.update({
      where: { id: auth.userId },
      data: { photoUrl: url },
    });

    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[upload/photo] erreur:', err);
    return NextResponse.json({ error: 'Erreur upload' }, { status: 500 });
  }
}
