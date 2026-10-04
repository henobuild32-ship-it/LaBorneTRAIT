import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

type SyncOperation = {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
};

function isAllowedPath(pathname: string): boolean {
  return pathname === '/api/grades'
    || pathname === '/api/attendance/batch'
    || pathname === '/api/homework'
    || /^\/api\/notifications\/[^/]+$/.test(pathname);
}

export async function POST(request: NextRequest) {
  try {
    authenticateRequest(request);
    const operation = (await request.json()) as SyncOperation;
    const target = new URL(operation.url, request.url);

    const allowedMethod = /^\/api\/notifications\/[^/]+$/.test(target.pathname)
      ? operation.method === 'PUT'
      : operation.method === 'POST';
    if (!isAllowedPath(target.pathname) || !allowedMethod) {
      return NextResponse.json({ error: 'Opération offline non autorisée' }, { status: 400 });
    }

    const headers = new Headers(operation.headers);
    headers.set('cookie', request.headers.get('cookie') || '');
    headers.set('content-type', 'application/json');

    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: operation.body,
      cache: 'no-store',
    });
    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur de synchronisation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}