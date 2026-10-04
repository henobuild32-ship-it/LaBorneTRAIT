import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const getDatabaseUrl = () => {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Supabase Transaction Pooler (port 6543 / pooler.supabase.com) : on force
  // pgbouncer=true pour désactiver les prepared statements (incompatibles
  // avec le mode transaction de PgBouncer).
  if ((url.includes('pooler.supabase.com') || url.includes(':6543')) && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pgbouncer=true`;
  }

  // En mode transaction, une seule connexion par lambda est recommandée
  // (sinon on sature le pool et Supabase refuse les connexions => ECONNREFUSED).
  if (url.includes('pgbouncer=true') && !url.includes('connection_limit=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connection_limit=1`;
  }

  return url;
};

const databaseUrl = getDatabaseUrl();

const createClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

  // Rend les erreurs de connexion BDD explicites à la place du vague
  // "Invalid `prisma.x.findUnique()` invocation".
  return client.$extends({
    query: {
      async $allOperations({ query, args }) {
        try {
          return await query(args);
        } catch (err: any) {
          const cause: string =
            err?.cause?.message || err?.cause?.code || err?.cause || '';
          const isConnError =
            /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ETIME|timeout|too many connections|remaining connection slots|terminating connection|password authentication failed/i.test(
              String(cause),
            );
          if (isConnError) {
            const detail = String(cause).slice(0, 160);
            throw new Error(
              `Connexion à la base de données refusée (${detail}). Vérifiez DATABASE_URL / DIRECT_URL dans Vercel.`,
              { cause: err },
            );
          }
          throw err;
        }
      },
    },
  });
};

export const db = (globalForPrisma.prisma ?? createClient()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db as unknown as PrismaClient;
