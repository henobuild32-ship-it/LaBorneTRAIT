import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resource = await db.ressource.findUnique({ where: { id } });
    if (!resource) return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 });
    return NextResponse.json({ resource });
  } catch (error) {
    console.error('Error fetching resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, category, matiere, niveau, author, url, fileUrl, type, visibility, targetRole, targetClassId, isPublished } = body;

    const existing = await db.ressource.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof title === 'string') data.title = title;
    if (typeof description === 'string') data.description = description;
    if (typeof category === 'string') data.category = category;
    if (typeof matiere === 'string') data.matiere = matiere;
    if (typeof niveau === 'string') data.niveau = niveau;
    if (typeof author === 'string') data.author = author;
    if (typeof url === 'string') data.url = url;
    if (typeof fileUrl === 'string') data.fileUrl = fileUrl;
    if (typeof type === 'string') data.type = type;
    if (typeof visibility === 'string') data.visibility = visibility;
    if (typeof targetRole === 'string') data.targetRole = targetRole;
    if (typeof targetClassId === 'string') data.targetClassId = targetClassId;
    if (typeof isPublished === 'boolean') data.isPublished = isPublished;

    const resource = await db.ressource.update({ where: { id }, data });
    return NextResponse.json({ resource });
  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.ressource.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
