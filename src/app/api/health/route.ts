import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const startedAt = performance.now();
  const databaseStartedAt = performance.now();

  try {
    await db.$queryRaw`SELECT 1`;
    const databaseDuration = performance.now() - databaseStartedAt;
    const totalDuration = performance.now() - startedAt;

    return NextResponse.json(
      {
        status: 'ok',
        responseTimeMs: Math.round(totalDuration),
        databaseTimeMs: Math.round(databaseDuration),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Server-Timing': `db;dur=${databaseDuration.toFixed(1)}, app;dur=${totalDuration.toFixed(1)}`,
        },
      }
    );
  } catch {
    const totalDuration = performance.now() - startedAt;
    return NextResponse.json(
      { status: 'unavailable', responseTimeMs: Math.round(totalDuration) },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Server-Timing': `app;dur=${totalDuration.toFixed(1)}`,
        },
      }
    );
  }
}
