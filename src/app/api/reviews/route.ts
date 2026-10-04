import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

const MAX_REVIEWS_PER_DAY = 1;

export async function GET() {
  const reviews = await db.publicReview.findMany({
    where: { approved: true },
    select: { id: true, author: true, school: true, message: true, rating: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  return NextResponse.json({ reviews }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { author?: string; school?: string; message?: string; rating?: number; visitorId?: string };
  const author = body.author?.trim() || '';
  const school = body.school?.trim() || '';
  const message = body.message?.trim() || '';
  const rating = Number(body.rating);
  const visitorId = body.visitorId?.trim() || '';

  if (author.length < 2 || author.length > 80 || message.length < 20 || message.length > 800) {
    return NextResponse.json(
      { error: 'Indiquez votre nom (2 à 80 caractères) et un avis de 20 à 800 caractères.' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'La note doit être comprise entre 1 et 5.' }, { status: 400 });
  }
  if (!/^[a-f0-9-]{36}$/i.test(visitorId)) {
    return NextResponse.json({ error: 'Identifiant de formulaire invalide.' }, { status: 400 });
  }

  const visitorKey = createHash('sha256').update(visitorId).digest('hex');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReviews = await db.publicReview.count({
    where: { visitorId: visitorKey, createdAt: { gte: since } },
  });
  if (recentReviews >= MAX_REVIEWS_PER_DAY) {
    return NextResponse.json({ error: 'Vous avez déjà partagé un avis aujourd’hui. Merci !' }, { status: 429 });
  }

  const review = await db.publicReview.create({
    data: { author, school, message, rating, visitorId: visitorKey },
    select: { id: true, author: true, school: true, message: true, rating: true, createdAt: true },
  });
  return NextResponse.json({ review }, { status: 201 });
}
