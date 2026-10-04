import { NextRequest, NextResponse } from 'next/server';
import { bearerMatchesSystemSecret } from '@/lib/auth/system-secret';

/**
 * Endpoint temporaire pour diagnostiquer les variables d'environnement en production
 * À SUPPRIMER après validation du fix
 * 
 * GET /api/debug/env -> retourne l'état des variables critiques
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // En production, l'endpoint est totalement retiré (aucune fuite de diagnostic).
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  // Hors production : clé système dédiée requise (jamais de fallback JWT_SECRET).
  if (!bearerMatchesSystemSecret(request, [process.env.ADMIN_API_SECRET])) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  // Vérifier la source (optionnel - permet de restreindre l'accès)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    
    // Variables critiques
    deepseek: {
      hasKey: !!deepseekKey,
      keyLength: deepseekKey?.length || 0,
      keyPrefix: deepseekKey ? `${deepseekKey.slice(0, 5)}...${deepseekKey.slice(-5)}` : 'N/A',
      isValid: deepseekKey?.startsWith('sk-') || false,
    },
    
    database: {
      hasUrl: !!databaseUrl,
      urlLength: databaseUrl?.length || 0,
    },
    
    // Autres variables utiles
    supabase: {
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },

    // Contexte requête
    request: {
      origin,
      referer,
      method: request.method,
      url: request.url,
    },

    // Santé générale
    health: {
      allCriticalVarsPresent: !!deepseekKey && !!databaseUrl,
      readyToOperate: !!deepseekKey && !!databaseUrl,
    },
  };

  // Log pour le serveur Vercel
  console.log('[DEBUG ENV] Diagnostics:', diagnostics);

  return NextResponse.json(diagnostics, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * POST endpoint pour forcer un rechargement du diagnostic
 * Utile pour tester immédiatement après un redeploy
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  if (!bearerMatchesSystemSecret(request, [process.env.ADMIN_API_SECRET])) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  console.log('[DEBUG ENV] POST request - rechargement du diagnostic');
  
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  
  return NextResponse.json({
    message: 'Diagnostic rechargé',
    timestamp: new Date().toISOString(),
    deepseekAvailable: !!deepseekKey,
    deepseekKeyPrefix: deepseekKey ? `${deepseekKey.slice(0, 5)}...` : 'undefined',
  });
}
