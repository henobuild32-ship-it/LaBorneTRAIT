import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/upload/message — Upload a file for messaging
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const senderId = (formData.get('senderId') as string) || auth.userId;
    const recipientId = formData.get('recipientId') as string;
    const schoolId = (formData.get('schoolId') as string) || auth.schoolId;

    if (!file || !senderId || !recipientId || !schoolId) {
      return NextResponse.json(
        { error: 'file, senderId, recipientId, schoolId requis' },
        { status: 400 }
      );
    }

    // L'expéditeur ne peut envoyer que depuis son propre compte
    if (auth.userId !== senderId) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 25 Mo)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `messages/${randomUUID()}.${ext}`;

    const { url } = await uploadFile(buffer, path, file.type);

    // Create message with attachment
    const message = await db.message.create({
      data: {
        schoolId,
        senderId,
        recipientId,
        content: file.name,
        messageType: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file',
        attachmentUrl: url,
        attachmentName: file.name,
        attachmentType: file.type,
      },
      include: {
        sender: { select: { id: true, fullName: true, photoUrl: true, role: true } },
        recipient: { select: { id: true, fullName: true, photoUrl: true, role: true } },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error uploading message file:', error);
    return NextResponse.json({ error: "Impossible d'envoyer le fichier. Vérifiez votre connexion puis réessayez." }, { status: 500 });
  }
}
