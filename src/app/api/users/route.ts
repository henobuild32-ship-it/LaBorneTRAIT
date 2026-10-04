import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';
import { hashPassword } from '@/lib/password';
import {
  CARD_CREDIT_COOKIE,
  cardCreditCookieOptions,
  isCardCreditValueValid,
} from '@/lib/payment-callback';

function generateParentCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'P-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function syncStudentClassEnrollment(userId: string, schoolId: string, classId?: string, className?: string) {
  if (!classId && !className) {
    return null;
  }

  let assignedClassId = classId;

  if (!assignedClassId && className) {
    let existingClass = await db.schoolClass.findFirst({
      where: { schoolId, name: className },
    });

    if (!existingClass) {
      existingClass = await db.schoolClass.create({
        data: {
          schoolId,
          name: className,
          level: 'N/A',
        },
      });
    }

    assignedClassId = existingClass.id;
  }

  if (assignedClassId) {
    await db.enrolledClass.deleteMany({ where: { userId } });
    await db.enrolledClass.create({
      data: {
        userId,
        classId: assignedClassId,
      },
    });
  }

  return assignedClassId;
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const role = searchParams.get('role');
    const classId = searchParams.get('classId');
    const parentId = searchParams.get('parentId');
    const search = searchParams.get('search');
    const teacherId = searchParams.get('teacherId');

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    // Parent can only filter by their own parentId
    if (auth.role === 'PARENT' && parentId !== auth.userId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (role) {
      where.role = role;
    }

    if (classId) {
      where.classEnrollments = {
        some: { classId },
      };
    }

    // A teacher only sees students enrolled in their own courses's classes
    if (teacherId && auth.userId === teacherId && role === 'STUDENT') {
      const teacherClasses = await db.course.findMany({
        where: { teacherId: auth.userId, deletedAt: null },
        select: { classId: true },
        distinct: ['classId'],
      });
      const tClassIds = teacherClasses.map((c) => c.classId);
      if (tClassIds.length > 0) {
        where.classEnrollments = { some: { classId: { in: tClassIds } } };
      } else {
        // Aucune classe assignée
        where.id = 'none';
      }
    }

    // Security: filter children by parentId so parents only see their own children
    if (parentId) {
      where.parentId = parentId;
    }

    // Full-text search on fullName or email
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await db.user.findMany({
      where,
      include: {
        school: true,
        classEnrollments: {
          include: { class: true },
        },
        children: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const {
      schoolId,
      fullName,
      email,
      password,
      role,
      photoUrl,
      parentId,
      classId,
      className,
      isTitulaire,
      titulaireClassIds,
      postName,
      gender,
      birthDate,
      matricule,
      specialty,
      qualification,
      phone,
      parentPhone,
      parentPhone2,
      academicYear,
      section,
      bloodType,
      nationality,
      address,
      parentEmail,
      ine,
      tuteur,
      contactTuteur,
      allergies,
      assurance,
      cardIssuedDate,
      cardExpiryDate,
      useFreeCard,
      paymentAuthorized,
    } = body;

    if (!schoolId || !fullName || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, fullName, password, role' },
        { status: 400 }
      );
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN' || auth.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    const freeCardField = role === 'STUDENT' ? 'freeStudentCardUsed' : role === 'TEACHER' ? 'freeTeacherCardUsed' : null;
    // Paiement GeniusPay (Phase 3) : le client ne peut plus déclarer lui-même
    // avoir payé. Il faut un crédit signé, émis par /api/payments/.../success
    // après vérification du paiement, et consommé à la création.
    const paidCreditValue = request.cookies.get(CARD_CREDIT_COOKIE)?.value ?? null;
    const hasPaidCredit = isCardCreditValueValid(paidCreditValue, schoolId);

    if (paymentAuthorized === true) {
      if (!hasPaidCredit) {
        return NextResponse.json(
          { error: 'Paiement de la carte non confirmé. Refaites le paiement de 10 USD.' },
          { status: 402 }
        );
      }
      // Crédit consommé (cookie effacé) dans la réponse de création ci-dessous.
    } else if (useFreeCard !== true || !freeCardField) {
      return NextResponse.json({ error: 'Création gratuite disponible uniquement pour un élève ou un professeur.' }, { status: 400 });
    } else {
      const claimed = await db.user.updateMany({
        where: { id: auth.userId, schoolId, role: 'ADMIN', [freeCardField]: false },
        data: { [freeCardField]: true },
      });
      if (claimed.count !== 1) {
        return NextResponse.json({ error: `La carte gratuite ${role === 'STUDENT' ? 'élève' : 'professeur'} a déjà été utilisée.` }, { status: 409 });
      }
    }

    const existing = await db.user.findFirst({
      where: { schoolId, fullName, role },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A user with name "${fullName}" and role "${role}" already exists in this school` },
        { status: 409 }
      );
    }

    // Validation Zod V3 : gender obligatoire M/F
    const genderSchema = z.enum(['M', 'F'], { error: 'Le sexe (M ou F) est obligatoire.' });
    const genderVal = genderSchema.safeParse(gender);
    if (!genderVal.success) {
      return NextResponse.json(
        { error: genderVal.error.issues[0]?.message || 'Le sexe (M ou F) est obligatoire.' },
        { status: 400 }
      );
    }
    const g = genderVal.data;

    // dateOfBirth obligatoire pour STUDENT/TEACHER
    let birthDateVal = birthDate || '';
    if (role === 'STUDENT' || role === 'TEACHER') {
      if (!birthDateVal) {
        return NextResponse.json(
          { error: 'La date de naissance est obligatoire pour ce rôle.' },
          { status: 400 }
        );
      }
      const dob = new Date(birthDateVal);
      if (isNaN(dob.getTime())) {
        return NextResponse.json(
          { error: 'La date de naissance est invalide.' },
          { status: 400 }
        );
      }
      birthDateVal = dob.toISOString();
    }

    // STUDENT : matricule auto-généré MAT-YYYY-XXXX si absent
    let matriculeVal = matricule || '';
    if (role === 'STUDENT' && !matriculeVal) {
      matriculeVal = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      while (await db.user.findFirst({ where: { matricule: matriculeVal } })) {
        matriculeVal = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // TEACHER : specialty + phone obligatoires
    let specialtyVal = '';
    let phoneVal = phone || '';
    if (role === 'TEACHER') {
      specialtyVal = (specialty || '').trim();
      phoneVal = (phone || '').trim();
      if (!specialtyVal) {
        return NextResponse.json(
          { error: 'La spécialité est obligatoire pour un professeur.' },
          { status: 400 }
        );
      }
      if (!phoneVal) {
        return NextResponse.json(
          { error: 'Le numéro de téléphone est obligatoire pour un professeur.' },
          { status: 400 }
        );
      }
    }

    let parentCodeVal = await generateParentCode();
    while (await db.user.findUnique({ where: { parentCode: parentCodeVal } })) {
      parentCodeVal = generateParentCode();
    }

    const issued = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const user = await db.user.create({
      data: {
        schoolId,
        fullName,
        email: email || '',
        password: await hashPassword(password),
        role,
        photoUrl: photoUrl || '',
        postName: postName || '',
        gender: g,
        birthDate: birthDateVal,
        matricule: matriculeVal,
        specialty: specialtyVal,
        phone: phoneVal,
        parentPhone: parentPhone || '',
        parentPhone2: parentPhone2 || '',
        academicYear: academicYear || '',
        section: section || '',
        bloodType: bloodType || '',
        nationality: nationality || '',
        address: address || '',
        parentEmail: parentEmail || '',
        ine: ine || '',
        tuteur: tuteur || '',
        contactTuteur: contactTuteur || '',
        allergies: allergies || '',
        assurance: assurance || '',
        cardId: `${(fullName.trim().charAt(0) || 'X').toUpperCase()}${Date.now().toString().slice(-8)}`,
        cardIssuedDate: issued,
        cardExpiryDate: expiry,
        parentId: parentId || null,
        parentCode: parentCodeVal,
        isTitulaire: !!isTitulaire,
      },
      include: {
        school: true,
        classEnrollments: {
          include: { class: true },
        },
      },
    });

    if ((classId || className) && role === 'STUDENT') {
      await syncStudentClassEnrollment(user.id, schoolId, classId, className);
    }

    // Synchroniser le titulariat (SchoolClass.titulaireId)
    if (Array.isArray(titulaireClassIds) && titulaireClassIds.filter(Boolean).length > 0) {
      const classes = await db.schoolClass.findMany({
        where: { id: { in: titulaireClassIds.filter(Boolean) }, schoolId },
        select: { id: true },
      });
      const validIds = classes.map((c) => c.id);
      if (validIds.length > 0) {
        await db.schoolClass.updateMany({
          where: { id: { in: validIds } },
          data: { titulaireId: user.id },
        });
      }
    }

    const userWithEnrollments = await db.user.findUnique({
      where: { id: user.id },
      include: {
        school: true,
        classEnrollments: {
          include: { class: true },
        },
      },
    });

    const response = NextResponse.json({ user: userWithEnrollments }, { status: 201 });

    if (paymentAuthorized === true && hasPaidCredit) {
      // Consomme le crédit : le cookie est effacé (1 paiement = 1 carte).
      response.headers.set('Set-Cookie', `${CARD_CREDIT_COOKIE}=; ${cardCreditCookieOptions(0)}`);
      // Trace comptable : paiement de carte confirmé.
      try {
        await db.payment.create({
          data: {
            schoolId,
            studentId: user.id,
            amount: Number(process.env.STUDENT_CARD_PRICE_USD || 10),
            status: 'paid',
            method: 'geniuspay',
            month: 'carte-scolaire',
          },
        });
      } catch (paymentError) {
        console.error('[GeniusPay] Enregistrement du paiement de carte impossible:', paymentError);
      }
    }

    return response;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Toggle user active status or update user info
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const {
      userId,
      active,
      fullName,
      email,
      postName,
      gender,
      birthDate,
      matricule,
      specialty,
      qualification,
      phone,
      parentPhone,
      parentPhone2,
      academicYear,
      section,
      photoUrl,
      bloodType,
      nationality,
      address,
      parentEmail,
      cardIssuedDate,
      cardExpiryDate,
      ine,
      tuteur,
      contactTuteur,
      allergies,
      assurance,
      isTitulaire,
      titulaireClassIds,
      classId,
      className,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
    }

    // Admin uniquement, et la cible doit être dans la même école
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, schoolId: true } });
    if (!targetUser || targetUser.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Utilisateur introuvable dans votre établissement.' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (active !== undefined) updateData.active = active;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (postName !== undefined) updateData.postName = postName;
    if (gender !== undefined) {
      if (gender !== 'M' && gender !== 'F') {
        return NextResponse.json({ error: 'Le sexe doit être M ou F.' }, { status: 400 });
      }
      updateData.gender = gender;
    }
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    if (matricule !== undefined) updateData.matricule = matricule;
    if (specialty !== undefined) updateData.specialty = specialty;
    if (qualification !== undefined) updateData.qualification = qualification;
    if (phone !== undefined) updateData.phone = phone;
    if (parentPhone !== undefined) updateData.parentPhone = parentPhone;
    if (parentPhone2 !== undefined) updateData.parentPhone2 = parentPhone2;
    if (academicYear !== undefined) updateData.academicYear = academicYear;
    if (section !== undefined) updateData.section = section;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (bloodType !== undefined) updateData.bloodType = bloodType;
    if (nationality !== undefined) updateData.nationality = nationality;
    if (address !== undefined) updateData.address = address;
    if (parentEmail !== undefined) updateData.parentEmail = parentEmail;
    if (cardIssuedDate !== undefined) updateData.cardIssuedDate = cardIssuedDate;
    if (cardExpiryDate !== undefined) updateData.cardExpiryDate = cardExpiryDate;
    if (ine !== undefined) updateData.ine = ine;
    if (tuteur !== undefined) updateData.tuteur = tuteur;
    if (contactTuteur !== undefined) updateData.contactTuteur = contactTuteur;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (assurance !== undefined) updateData.assurance = assurance;
    if (isTitulaire !== undefined) updateData.isTitulaire = isTitulaire;

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        school: true,
        classEnrollments: { include: { class: true } },
        children: true,
      },
    });

    // Synchroniser le titulariat (SchoolClass.titulaireId)
    if (titulaireClassIds !== undefined) {
      const targetClasses = Array.isArray(titulaireClassIds) ? titulaireClassIds.filter(Boolean) : [];
      await db.schoolClass.updateMany({
        where: { titulaireId: userId },
        data: { titulaireId: null },
      });
      if (targetClasses.length > 0) {
        const classes = await db.schoolClass.findMany({
          where: { id: { in: targetClasses }, schoolId: user.schoolId },
          select: { id: true },
        });
        const validIds = classes.map((c) => c.id);
        if (validIds.length > 0) {
          await db.schoolClass.updateMany({
            where: { id: { in: validIds } },
            data: { titulaireId: userId },
          });
        }
      }
    }

    if (user.role === 'STUDENT' && (classId !== undefined || className !== undefined)) {
      await syncStudentClassEnrollment(user.id, user.schoolId, classId, className);
    }

    // Notify the user in real-time that their profile was updated by admin
    try { await notifyUser({
      schoolId: user.schoolId,
      userId: user.id,
      title: 'Profil Modifié 👤',
      message: 'Vos informations de profil ont été mises à jour par l\'administration.',
      type: 'PROFILE',
      priority: 'LOW',
      metadata: { userId: user.id },
    }); } catch (e) { console.error('[Users PATCH] Notification failed (non-blocking):', e); }

    return NextResponse.json({ user });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a user
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
    }

    // Admin uniquement, et la cible doit être dans la même école
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, schoolId: true } });
    if (!targetUser || targetUser.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Utilisateur introuvable dans votre établissement.' }, { status: 403 });
    }

    // Check if user has children (parent)
    const children = await db.user.findMany({ where: { parentId: userId } });
    if (children.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un utilisateur lié à d\'autres comptes.' },
        { status: 400 }
      );
    }

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
