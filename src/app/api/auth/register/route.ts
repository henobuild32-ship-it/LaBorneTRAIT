import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { setAuthCookies } from '@/lib/auth/session';

const registerSchema = z.object({
  gender: z.enum(['M', 'F'], { error: 'Le sexe est obligatoire (M ou F).' }),
  dateOfBirth: z.coerce.date({ error: 'La date de naissance est obligatoire.' }),
  classId: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  qualification: z.string().optional(),
});

function generateCode(prefix: string, length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueInviteCode(): Promise<string> {
  let code = generateCode('ECOLE', 6);
  while (await db.school.findUnique({ where: { inviteCode: code } })) {
    code = generateCode('ECOLE', 6);
  }
  return code;
}

async function generateUniqueParentCode(): Promise<string> {
  let code = generateCode('P', 6);
  while (await db.user.findUnique({ where: { parentCode: code } })) {
    code = generateCode('P', 6);
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, schoolName, fullName, email, password, inviteCode, role, classIds, parentCode, gender, dateOfBirth, specialty, phone, qualification } = body;

    // === MODE: create-school (Admin creates a school) ===
    if (mode === 'create-school') {
      if (!fullName || !schoolName || !email || !password) {
        return NextResponse.json(
          { error: 'Veuillez remplir tous les champs.' },
          { status: 400 }
        );
      }
      if (password.length < 4) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 4 caractères.' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingSchool = await db.school.findUnique({ where: { email: normalizedEmail } });
      if (existingSchool) {
        return NextResponse.json(
          { error: 'Une école avec cet email existe déjà.' },
          { status: 409 }
        );
      }

      const code = await generateUniqueInviteCode();

      const school = await db.school.create({
        data: {
          name: schoolName,
          email: normalizedEmail,
          password: await hashPassword(password),
          inviteCode: code,
        },
      });

      const parentCodeVal = await generateUniqueParentCode();

      const user = await db.user.create({
        data: {
          schoolId: school.id,
          fullName,
          email: normalizedEmail,
          password: await hashPassword(password),
          role: 'ADMIN',
          parentCode: parentCodeVal,
        },
        include: {
          school: true,
          classEnrollments: { include: { class: true } },
        },
      });

      const response = NextResponse.json({
        user: formatUser(user, school),
        inviteCode: code,
      }, { status: 201 });
      setAuthCookies(response, user, school);
      return response;
    }

    // === MODE: join-school (Non-admin joins an existing school) ===
    if (mode === 'join-school') {
      const cleanFullName = (fullName || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanInviteCode = (inviteCode || '').trim().toUpperCase();

      if ((!cleanFullName && !cleanEmail) || !password || !cleanInviteCode || !role) {
        return NextResponse.json(
          { error: 'Veuillez remplir tous les champs obligatoires et fournir un email ou un nom complet.' },
          { status: 400 }
        );
      }
      if (password.length < 4) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 4 caractères.' },
          { status: 400 }
        );
      }

      const g = gender as string | undefined;
      if (!g || (g !== 'M' && g !== 'F')) {
        return NextResponse.json(
          { error: 'Le sexe (M ou F) est obligatoire.' },
          { status: 400 }
        );
      }

      let birthDateValue = '';
      if (role === 'STUDENT' || role === 'TEACHER') {
        if (!dateOfBirth) {
          return NextResponse.json(
            { error: 'La date de naissance est obligatoire pour ce rôle.' },
            { status: 400 }
          );
        }
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          return NextResponse.json(
            { error: 'La date de naissance est invalide.' },
            { status: 400 }
          );
        }
        birthDateValue = dob.toISOString();
      }

      // STUDENT: classId obligatoire + matricule auto-généré
      let matriculeValue = '';
      if (role === 'STUDENT') {
        const classIdVal = (classIds && Array.isArray(classIds) ? classIds[0] : null) as string | undefined;
        if (!classIdVal) {
          return NextResponse.json(
            { error: 'La classe est obligatoire pour un élève.' },
            { status: 400 }
          );
        }
        matriculeValue = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        while (await db.user.findFirst({ where: { matricule: matriculeValue } })) {
          matriculeValue = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }

      // TEACHER: specialty + phone obligatoires
      let specialtyValue = '';
      let phoneValue = '';
      if (role === 'TEACHER') {
        specialtyValue = (specialty || '').trim();
        phoneValue = (phone || '').trim();
        if (!specialtyValue) {
          return NextResponse.json(
            { error: 'La spécialité est obligatoire pour un professeur.' },
            { status: 400 }
          );
        }
        if (!phoneValue) {
          return NextResponse.json(
            { error: 'Le numéro de téléphone est obligatoire pour un professeur.' },
            { status: 400 }
          );
        }
      }

      // Find school by invite code
      const school = await db.school.findUnique({ where: { inviteCode: cleanInviteCode } });
      if (!school) {
        return NextResponse.json(
          { error: 'Code école invalide. Vérifiez le code fourni par votre administrateur.' },
          { status: 404 }
        );
      }

      // Check if user already exists (case-insensitive name comparison)
      const existingUsers = await db.user.findMany({
        where: { schoolId: school.id, role },
      });
      const nameExists = cleanFullName
        ? existingUsers.some(
            (u) => u.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()
          )
        : false;
      if (nameExists) {
        return NextResponse.json(
          { error: 'Un utilisateur avec ce nom et ce rôle existe déjà dans cette école.' },
          { status: 409 }
        );
      }

      if (cleanEmail) {
        const existingEmail = await db.user.findFirst({
          where: { schoolId: school.id, email: cleanEmail },
        });
        if (existingEmail) {
          return NextResponse.json(
            { error: 'Un utilisateur avec cet email existe déjà dans cette école.' },
            { status: 409 }
          );
        }
      }

      const parentCodeVal = await generateUniqueParentCode();

      // Build user data (use cleaned fullName)
      const userData: Record<string, unknown> = {
        schoolId: school.id,
        fullName: cleanFullName,
        password: await hashPassword(password),
        role,
        parentCode: parentCodeVal,
        email: cleanEmail || '',
        gender: g,
      };
      if (birthDateValue) userData.birthDate = birthDateValue;
      if (matriculeValue) userData.matricule = matriculeValue;
      if (specialtyValue) userData.specialty = specialtyValue;
      if (phoneValue) userData.phone = phoneValue;
      if (qualification) userData.qualification = (qualification as string) || '';

      // Role-specific logic
      let linkedStudent: { id: string; fullName: string } | null = null;
      if (role === 'PARENT') {
        if (!parentCode) {
          return NextResponse.json(
            { error: 'Le code parent est obligatoire pour créer un compte parent.' },
            { status: 400 }
          );
        }
        // Find the student by parent code
        const student = await db.user.findUnique({ where: { parentCode } });
        if (!student || student.schoolId !== school.id || student.role !== 'STUDENT') {
          return NextResponse.json(
            { error: 'Code parent invalide. Veuillez vérifier avec votre enfant.' },
            { status: 404 }
          );
        }
        linkedStudent = { id: student.id, fullName: student.fullName };
      }

      const user = await db.user.create({
        data: userData as never,
        include: {
          school: true,
          classEnrollments: { include: { class: true } },
        },
      });

      // If student, auto-enroll in selected class
      if (role === 'STUDENT' && classIds && classIds.length > 0) {
        for (const classId of classIds) {
          const schoolClass = await db.schoolClass.findFirst({
            where: { id: classId, schoolId: school.id },
          });
          if (schoolClass) {
            await db.enrolledClass.create({
              data: { userId: user.id, classId: schoolClass.id },
            });
          }
        }
      }

      // If teacher, enroll in selected classes (same as students)
      if (role === 'TEACHER' && classIds && classIds.length > 0) {
        for (const classId of classIds) {
          const schoolClass = await db.schoolClass.findFirst({
            where: { id: classId, schoolId: school.id },
          });
          if (schoolClass) {
            await db.enrolledClass.create({
              data: { userId: user.id, classId: schoolClass.id },
            });
          }
        }
      }

      // If parent, link student to this parent
      if (linkedStudent) {
        await db.user.update({
          where: { id: linkedStudent.id },
          data: { parentId: user.id },
        });
      }

      // Refresh user with enrollments
      const finalUser = await db.user.findUnique({
        where: { id: user.id },
        include: {
          school: true,
          classEnrollments: { include: { class: true } },
          children: true,
        },
      });

      const finalUserData = finalUser || user;
      const response = NextResponse.json({
        user: finalUser ? formatUser(finalUser, school) : formatUser(user, school),
      }, { status: 201 });
      setAuthCookies(response, finalUserData, school);
      return response;
    }

    return NextResponse.json(
      { error: 'Mode d\'inscription invalide.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatUser(user: {
  id: string;
  schoolId: string;
  fullName: string;
  email: string;
  role: string;
  photoUrl: string;
  parentId?: string | null;
  parentCode?: string;
  active?: boolean;
  school: { id: string; name: string; email: string; currency: string; inviteCode?: string };
  classEnrollments?: { id: string; userId: string; classId: string; class: { id: string; schoolId: string; name: string; level: string; fees: number } }[];
  children?: { id: string; fullName: string; role: string }[];
}, school: { id: string; name: string; email: string; currency: string; inviteCode?: string }) {
  return {
    id: user.id,
    schoolId: user.schoolId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    photoUrl: user.photoUrl,
    parentId: user.parentId,
    parentCode: user.parentCode,
    active: user.active,
    school: {
      id: school.id,
      name: school.name,
      email: school.email,
      currency: school.currency,
      inviteCode: school.inviteCode,
    },
    classEnrollments: user.classEnrollments?.map((e) => ({
      id: e.id,
      userId: e.userId,
      classId: e.classId,
      class: e.class,
    })) || [],
    children: user.children || [],
  };
}
