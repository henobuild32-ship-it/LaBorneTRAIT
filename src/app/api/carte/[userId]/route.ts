import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { matricule: userId },
          { cardId: userId },
        ],
      },
      include: {
        school: true,
        classEnrollments: { include: { class: true } },
        parent: { select: { id: true, fullName: true, phone: true, email: true, parentCode: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const enrollment = user.classEnrollments?.[0];
    const className = enrollment?.class?.name || '';
    const niveau = enrollment?.class?.level || '';

    const token = request.cookies.get('gradeup_token')?.value;
    let claims: { sub: string; schoolId: string; role: string } | null = null;
    if (token) {
      try {
        const { verifyAccessToken } = await import('@/lib/auth/jwt');
        claims = verifyAccessToken(token);
      } catch {
        claims = null;
      }
    }

    const isAuthorizedForSensitive = Boolean(
      claims && (
        claims.sub === user.id ||
        claims.sub === user.parentId ||
        (claims.schoolId === user.schoolId && (claims.role === 'ADMIN' || claims.role === 'TEACHER'))
      )
    );

    const cardData = {
      id: user.id,
      fullName: user.fullName,
      postName: user.postName,
      email: isAuthorizedForSensitive ? user.email : null,
      phone: isAuthorizedForSensitive ? user.phone : null,
      gender: user.gender === 'M' ? 'Masculin' : 'Féminin',
      birthDate: isAuthorizedForSensitive ? user.birthDate : null,
      photoUrl: user.photoUrl || null,
      role: user.role,
      roleLabel: user.role === 'TEACHER' ? 'Enseignant' : 'Élève',
      matricule: user.matricule || user.cardId || '',
      ine: user.ine || user.cardId || user.id.slice(-8),
      className,
      niveau,
      section: user.section,
      courseName: user.section,
      bloodType: isAuthorizedForSensitive ? user.bloodType || null : null,
      nationality: isAuthorizedForSensitive ? user.nationality || null : null,
      address: isAuthorizedForSensitive ? user.address || null : null,
      parentEmail: isAuthorizedForSensitive ? user.parentEmail || null : null,
      tuteur: isAuthorizedForSensitive ? (user.tuteur || user.parent?.fullName || null) : null,
      contactTuteur: isAuthorizedForSensitive ? (user.contactTuteur || user.parent?.phone || null) : null,
      allergies: isAuthorizedForSensitive ? user.allergies || null : null,
      assurance: isAuthorizedForSensitive ? user.assurance || null : null,
      academicYear: user.academicYear || '',
      cardId: user.cardId || null,
      cardIssuedDate: user.cardIssuedDate || null,
      cardExpiryDate: user.cardExpiryDate || null,
      school: {
        id: user.school.id,
        name: user.school.name,
        logoUrl: user.school.logoUrl || null,
        color: user.school.color || '#2563eb',
        email: user.school.email,
        province: user.school.province,
        city: user.school.city,
        commune: user.school.commune,
        schoolCode: user.school.schoolCode,
        academicYear: user.school.academicYear || user.academicYear || '',
      },
    };

    return NextResponse.json({ card: cardData });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
