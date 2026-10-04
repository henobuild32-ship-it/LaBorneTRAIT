import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { uploadFile } from '@/lib/storage';
import { generateGLMCompletion } from '@/lib/ai/glm-completion';

export const runtime = 'nodejs';

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    }

    // Extraction OCR pour les images
    if (mimeType.startsWith('image/')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = require('tesseract.js');
      const result = await Tesseract.recognize(buffer, 'fra');
      return result.data.text || '';
    }

    return '';
  } catch (error) {
    console.error('Erreur extraction texte:', error);
    return '';
  }
}

async function generateSummary(
  text: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const isImage = mimeType.startsWith('image/');

  const promptSystem = isImage
    ? "Tu es Teno, l'assistante IA de LaBorneTRAIT. Décris et explique cette image en français en te basant sur le texte extrait par OCR. Maximum 3 paragraphes."
    : "Tu es Teno, l'assistante IA de LaBorneTRAIT. Résume le document ci-dessous en français de manière claire, concise et utile pour un élève ou un professeur. Maximum 3 paragraphes.";

  const userContent = isImage
    ? `Image : "${fileName}"\nTexte OCR extrait : ${text.slice(0, 4000)}`
    : `Document : "${fileName}"\n\n${text.slice(0, 8000)}`;

  const summary = await generateGLMCompletion(promptSystem, userContent, {
    temperature: 0.5,
    maxTokens: 600,
  });

  if (!summary) {
    return 'Le document a été analysé mais le service IA n\'a pas pu générer de résumé.';
  }

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !conversationId || !userId) {
      return NextResponse.json(
        { error: 'Fichier, conversationId et userId sont requis.' },
        { status: 400 }
      );
    }

    // Vérification du type MIME
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: `Type de fichier non supporté : ${file.type}. Acceptés : PDF, DOCX, TXT, JPEG, PNG, WEBP.` },
        { status: 415 }
      );
    }

    // Vérification de la taille (20 Mo max)
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier dépasse la taille maximale autorisée (20 Mo).' },
        { status: 413 }
      );
    }

    // Vérification de la conversation
    const conversation = await db.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    // Sauvegarde du fichier (cloud storage si configuré, sinon FS local)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = ALLOWED_TYPES[file.type];
    const storedName = `${randomUUID()}${ext}`;
    const { url: fileUrl } = await uploadFile(buffer, storedName, file.type);

    // Extraction du texte / OCR
    const extractedText = await extractText(buffer, file.type);

    // Résumé / Description par l'IA (GLM)
    const summary = await generateSummary(extractedText, file.name, file.type);

    // Sauvegarde en base
    const document = await db.aiDocument.create({
      data: {
        conversationId,
        name: file.name,
        mimeType: file.type,
        url: fileUrl,
        size: file.size,
        extractedText: extractedText.slice(0, 50000),
        summary,
      },
    });

    // Compter les documents dans la conversation pour savoir si on peut les comparer
    const docCount = await db.aiDocument.count({
      where: { conversationId },
    });

    let assistantMessageContent = `📄 **Document reçu : ${file.name}**\n\n${summary || 'Le document a été analysé et est maintenant disponible dans cette conversation.'}`;
    
    if (docCount > 1) {
      assistantMessageContent += `\n\n💡 *Vous avez maintenant ${docCount} documents chargés. Vous pouvez me demander de les comparer ou d'effectuer une synthèse croisée !*`;
    }

    // Enregistrer le message de notification de l'assistant
    await db.aiMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: assistantMessageContent,
      },
    });

    // Titrer la conversation si nécessaire
    if (conversation.title === 'Nouvelle conversation') {
      await db.aiConversation.update({
        where: { id: conversationId },
        data: { title: `📎 ${file.name.slice(0, 40)}` },
      });
    }

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        size: document.size,
        summary: document.summary,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    console.error('Upload error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
