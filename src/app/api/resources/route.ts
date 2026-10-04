import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateGLMCompletion } from '@/lib/ai/glm-completion';

export const runtime = 'nodejs';

async function isVisibleToUser(
  r: { visibility: string; targetRole: string; targetClassId: string },
  userId: string,
  userRole: string
): Promise<boolean> {
  if (r.visibility === 'PUBLIC') return true;
  if (r.visibility === 'ROLE') return r.targetRole === 'ALL' || r.targetRole === userRole;
  if (r.visibility === 'CLASS') {
    if (!r.targetClassId) return true;
    const enr = await db.enrolledClass.findFirst({ where: { userId, classId: r.targetClassId } });
    return !!enr;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('role') || 'ALL';
    const matiere = searchParams.get('matiere');
    const niveau = searchParams.get('niveau');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const q = searchParams.get('q')?.trim();
    const favoritesOnly = searchParams.get('favorites') === '1';
    const publishedOnly = searchParams.get('publishedOnly') === '1';
    const includeDrafts = searchParams.get('includeDrafts') === '1';

    if (!schoolId) return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });

    const where: any = { schoolId };
    if (matiere) where.matiere = matiere;
    if (niveau) where.niveau = niveau;
    if (category) where.category = category;
    if (type) where.type = type;
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
    // Par défaut seules les ressources publiées sont renvoyées (définition : isPublished=true)
    if (!includeDrafts && !publishedOnly) {
      where.isPublished = true;
    } else if (publishedOnly) {
      where.isPublished = true;
    }

    let resources = await db.ressource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const result: any[] = [];
    for (const r of resources) {
      const visible = !userId || (await isVisibleToUser(r, userId, userRole));
      if (!visible) continue;
      result.push({ ...r, isFavorite: false });
    }

    // Catégories / matières disponibles pour les filtres
    const facets = await db.ressource.findMany({
      where: { schoolId },
      select: { matiere: true, niveau: true, category: true, type: true },
    });

    return NextResponse.json({ resources: result, facets });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      schoolId, createdById, title, description, category, matiere, niveau,
      author, url, fileUrl, type, visibility, targetRole, targetClassId, isPublished
    } = body;

    if (!schoolId || !title) {
      return NextResponse.json({ error: 'schoolId et title requis.' }, { status: 400 });
    }

    // Description automatique via Teno (GLM) si non fournie
    let finalDescription = description || '';
    if (!finalDescription.trim() && (title || url)) {
      const system = "Tu es le bibliothécaire de LaBorneTRAIT. Rédige une courte description (2 phrases max, en français) et utile d'une ressource pédagogique, à partir de son titre et éventuellement de son lien. Sois factuel.";
      const userContent = `Titre : ${title}\nType : ${type || 'LIEN'}\nMatière : ${matiere || 'N/A'}\nNiveau : ${niveau || 'N/A'}\nLien : ${url || 'N/A'}`;
      finalDescription = await generateGLMCompletion(system, userContent, { temperature: 0.4, maxTokens: 250 }) || '';
    }

    const resource = await db.ressource.create({
      data: {
        schoolId,
        createdById: createdById || '',
        title,
        description: finalDescription,
        category: category || 'Général',
        matiere: matiere || '',
        niveau: niveau || '',
        author: author || '',
        url: url || '',
        fileUrl: fileUrl || '',
        type: type || 'LIEN',
        visibility: visibility || 'PUBLIC',
        targetRole: targetRole || 'ALL',
        targetClassId: targetClassId || '',
        isPublished: typeof isPublished === 'boolean' ? isPublished : true,
      },
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
