import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setAuthCookies, serializeUser } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/password';

// ====== Rate limiting (brute-force) : max 5 ECHECS / 15 min par IP+identifiant ======
// Clé = ip:identifier pour éviter de bloquer tout un réseau scolaire sur la même IP
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAt: number }>();

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/** Vérifie si l'IP+identifiant est bloqué (ne modifie PAS le compteur). */
function isRateLimited(request: NextRequest, identifier: string): boolean {
  const ip = getClientIp(request);
  const key = `${ip}:${identifier.toLowerCase()}`;
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) return false;
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

/** Enregistre un ECHEC de connexion (incrémente le compteur). */
function recordFailure(request: NextRequest, identifier: string): void {
  const ip = getClientIp(request);
  const key = `${ip}:${identifier.toLowerCase()}`;
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

/** Réinitialise le compteur après un succès. */
function resetRateLimit(request: NextRequest, identifier: string): void {
  const ip = getClientIp(request);
  const key = `${ip}:${identifier.toLowerCase()}`;
  loginAttempts.delete(key);
}

// Nettoyage périodique des entrées expirées (évite une croissance illimitée en mémoire)
function pruneExpiredAttempts(): void {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}
pruneExpiredAttempts();
setInterval(pruneExpiredAttempts, LOGIN_WINDOW_MS).unref?.();


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode, fullName, password, email, isAdminLogin } = body;

    // Identifiant principal pour le rate limiting (email ou fullName)
    const identifier = (email || fullName || 'unknown').trim();

    // Bloque les attaques par force brute (seulement les echecs comptent)
    if (isRateLimited(request, identifier)) {
      return NextResponse.json(
        { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
        { status: 429 }
      );
    }

    let user;
    let school;

    // ====== ADMIN LOGIN : par email de l'école + mot de passe ======
    if (isAdminLogin) {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Veuillez remplir votre email et mot de passe.' },
          { status: 400 }
        );
      }

      // Chercher l'école par son email
      const normalizedSchoolEmail = email.trim().toLowerCase();
      school = await db.school.findFirst({
        where: { email: { equals: normalizedSchoolEmail, mode: 'insensitive' } },
      });
      if (!school) {
        // Fallback : chercher un utilisateur ADMIN par email directement
        const adminUser = await db.user.findFirst({
          where: {
            email: { equals: normalizedSchoolEmail, mode: 'insensitive' },
            role: 'ADMIN',
          },
          include: {
            school: true,
            classEnrollments: { include: { class: true } },
            children: true,
          },
        });
        if (adminUser && (await verifyPassword(password, adminUser.password))) {
          user = adminUser;
          school = adminUser.school;
        } else {
          recordFailure(request, identifier);
          return NextResponse.json(
            { error: 'Aucun compte administrateur trouvé avec cet email.' },
            { status: 404 }
          );
        }
      } else {
        // Vérifier le mot de passe de l'école OU du compte admin
        let passwordMatch = false;

        // 1) Essayer le mot de passe de l'école
        if (school.password) {
          passwordMatch = await verifyPassword(password, school.password);
        }

        // 2) Si ça ne marche pas, trouver l'admin et vérifier son mot de passe
        if (!passwordMatch) {
          const adminCandidate = await db.user.findFirst({
            where: { schoolId: school.id, role: 'ADMIN' },
          });
          if (adminCandidate) {
            passwordMatch = await verifyPassword(password, adminCandidate.password);
          }
        }

        if (!passwordMatch) {
          recordFailure(request, identifier);
          return NextResponse.json(
            { error: 'Mot de passe incorrect.' },
            { status: 401 }
          );
        }

        // Trouver l'admin de cette école
        user = await db.user.findFirst({
          where: {
            schoolId: school.id,
            role: 'ADMIN',
          },
          include: {
            school: true,
            classEnrollments: { include: { class: true } },
            children: true,
          },
        });

        if (!user) {
          recordFailure(request, identifier);
          return NextResponse.json(
            { error: 'Compte administrateur introuvable pour cette école.' },
            { status: 404 }
          );
        }
      }

    // ====== USER LOGIN : par code école + nom + mot de passe ======
    } else {
      if (!inviteCode || !password || (!email && !fullName)) {
        return NextResponse.json(
          { error: 'Veuillez remplir le code école, le mot de passe et au moins votre email ou votre nom complet.' },
          { status: 400 }
        );
      }

      // Trouver l'école par code d'invitation
      school = await db.school.findUnique({ where: { inviteCode: inviteCode.trim().toUpperCase() } });
      if (!school) {
        recordFailure(request, identifier);
        return NextResponse.json(
          { error: 'Code école invalide. Vérifiez le code fourni par votre administrateur.' },
          { status: 404 }
        );
      }

      // Chercher un utilisateur par email si fourni
      if (email && email.trim()) {
        const normalizedEmail = email.trim().toLowerCase();
        const candidate = await db.user.findFirst({
          where: { schoolId: school.id, email: { equals: normalizedEmail, mode: 'insensitive' } },
          include: {
            school: true,
            classEnrollments: { include: { class: true } },
            children: true,
          },
        });
        if (candidate && (await verifyPassword(password, candidate.password))) {
          user = candidate;
        } else if (candidate && !await verifyPassword(password, candidate.password)) {
          // Email trouvé mais mauvais mot de passe
          recordFailure(request, identifier);
          return NextResponse.json(
            { error: 'Mot de passe incorrect.' },
            { status: 401 }
          );
        }
      }

      // Si l'email n'a pas permis de trouver l'utilisateur, on tente avec le nom complet
      if (!user && fullName && fullName.trim()) {
        const allUsers = await db.user.findMany({
          where: {
            schoolId: school.id,
            active: true,
          },
          include: {
            school: true,
            classEnrollments: { include: { class: true } },
            children: true,
          },
        });

        const normalizedInput = fullName.trim().toLowerCase();
        const candidates = allUsers.filter(
          (u) => u.fullName.trim().toLowerCase() === normalizedInput
        );

        for (const candidate of candidates) {
          if (await verifyPassword(password, candidate.password)) {
            user = candidate;
            break;
          }
        }

        if (!user && candidates.length > 0) {
          // Utilisateur trouvé mais mauvais mot de passe
          recordFailure(request, identifier);
          return NextResponse.json(
            { error: 'Mot de passe incorrect.' },
            { status: 401 }
          );
        }
      }

      if (!user) {
        recordFailure(request, identifier);
        return NextResponse.json(
          { error: 'Identifiant introuvable. Vérifiez votre nom, email et code école.' },
          { status: 401 }
        );
      }
    }

    // Vérifier que le compte est actif
    if (!user.active) {
      return NextResponse.json(
        { error: 'Votre compte a été désactivé. Contactez l\'administrateur.' },
        { status: 403 }
      );
    }

    // Vérifier le statut d'abonnement de l'école
    // L'admin peut toujours se connecter même si abonnement expiré
    if (user.role !== 'ADMIN') {
      const status = school!.subscriptionStatus;
      const expiry = school!.subscriptionExpiry;
      if (status === 'suspended') {
        return NextResponse.json(
          { error: 'L\'accès à cet établissement est actuellement suspendu. Contactez votre administrateur.' },
          { status: 403 }
        );
      }
      // Seulement bloquer si EXPLICITEMENT 'expired', ignorer la date expirée pour les utilisateurs normaux
      if (status === 'expired') {
        return NextResponse.json(
          { error: 'L\'abonnement de cet établissement a expiré. Contactez votre administrateur.' },
          { status: 403 }
        );
      }
    }

    // Connexion reussie : effacer les echecs precedents pour cet identifiant
    resetRateLimit(request, identifier);

    const resolvedSchool = (user as any).school || school!;
    const response = NextResponse.json({
      user: serializeUser(user, resolvedSchool),
    });
    setAuthCookies(response, user, resolvedSchool);
    return response;
  } catch (error: unknown) {
    console.error('[LOGIN ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 });
  }
}

