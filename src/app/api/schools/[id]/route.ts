import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const school = await db.school.findUnique({
      where: { id }
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Retourner les infos sans le mot de passe
    const { password, ...schoolInfo } = school;
    return NextResponse.json(schoolInfo);
  } catch (error) {
    console.error('Error fetching school:', error);
    return NextResponse.json({ error: 'Failed to fetch school' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Éviter de mettre à jour le mot de passe via cette route
    const { password, ...updateData } = body;

    const school = await db.school.update({
      where: { id },
      data: updateData
    });

    const { password: _, ...schoolInfo } = school;
    return NextResponse.json(schoolInfo);
  } catch (error) {
    console.error('Error updating school:', error);
    return NextResponse.json({ error: 'Failed to update school' }, { status: 500 });
  }
}
