import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

const ALLOWED_FIELDS = ['name', 'maxScore', 'coefficient', 'description', 'status', 'weight', 'points', 'schoolId', 'classId', 'teacherId'] as const;

function pickCourseData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

export async function GET(request: NextRequest) {
  try {
    // Lecture : utilisateur authentifié, scope école
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const courses = await db.course.findMany({
      where: {
        classId: classId || undefined,
        schoolId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ courses });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Écrire : ADMIN uniquement, scope école
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut créer un cours.' }, { status: 403 });
    }

    const body = await request.json();
    const data = pickCourseData(body);

    // schoolId imposé par l'école de l'admin, jamais par le client
    data.schoolId = auth.schoolId;
    if (!data.classId || !data.name) {
      return NextResponse.json({ error: 'classId et name sont requis' }, { status: 400 });
    }
    // teacherId requis par le schéma : on prend l'admin connecté par défaut
    if (!data.teacherId) {
      data.teacherId = auth.userId;
    }

    const course = await db.course.create({
      data: data as any,
    });
    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating course:', error);
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}