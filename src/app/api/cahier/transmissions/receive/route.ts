import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function PATCH(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { transmissionId, titulaireId, action } = body; // action: 'RECEIVE' | 'REJECT'

    if (!transmissionId || !titulaireId || !action) {
      return NextResponse.json({ error: 'transmissionId, titulaireId et action requis' }, { status: 400 });
    }

    const transmission = await db.cotationTransmission.findUnique({
      where: { id: transmissionId },
      include: {
        evaluation: {
          include: {
            class: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
        teacher: { select: { id: true, fullName: true } },
        class: { select: { id: true, name: true } },
      },
    });

    if (!transmission) {
      return NextResponse.json({ error: 'Transmission introuvable' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est bien le titulaire
    if (transmission.titulaireId !== auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    if (action === 'RECEIVE') {
      await db.cotationTransmission.update({
        where: { id: transmissionId },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
      });

      // Notification au professeur expéditeur
      await db.notification.create({
        data: {
          schoolId: transmission.schoolId,
          userId: transmission.teacherId,
          senderId: titulaireId,
          title: 'Cotations reçues par le titulaire',
          message: `Le professeur titulaire a bien reçu vos cotations pour "${transmission.evaluation.title}" (${transmission.evaluation.course.name})`,
          type: 'COTATION_RECEIVED',
          targetRole: 'TEACHER',
          targetClassId: transmission.classId,
          metadata: JSON.stringify({ evaluationId: transmission.evaluationId, transmissionId }),
        },
      });
    } else if (action === 'REJECT') {
      await db.cotationTransmission.update({
        where: { id: transmissionId },
        data: { status: 'REJECTED' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}