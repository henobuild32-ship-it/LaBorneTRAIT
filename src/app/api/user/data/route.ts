import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

// DELETE /api/user/data?userId=xxx
// Supprime toutes les conversations, messages et documents IA de l'utilisateur.

export async function DELETE(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    // Un utilisateur ne peut supprimer que ses propres données, sauf un ADMIN de son établissement
    if (auth.userId !== userId && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    if (auth.role === 'ADMIN' && auth.userId !== userId) {
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { schoolId: true },
      });
      if (!targetUser || targetUser.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Utilisateur hors de votre établissement' }, { status: 403 });
      }
    }

    // La suppression en cascade (AiMessage, AiDocument) est gérée par Prisma (onDelete: Cascade)
    await db.aiConversation.deleteMany({ where: { userId } });

    return NextResponse.json({
      success: true,
      message: 'Toutes vos conversations et données Teno ont été supprimées.',
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
