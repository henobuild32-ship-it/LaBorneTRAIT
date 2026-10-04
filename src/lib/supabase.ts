import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Client Supabase volontairement neutre quand aucun service n'est configuré :
 * l'application tourne intégralement en local (PostgreSQL, storage sur disque,
 * temps réel via SSE/polling) sans jamais tenter d'appel réseau externe.
 */
function createNoopClient(): SupabaseClient {
  const channel = () => {
    const handle: Record<string, unknown> = {};
    const chain = {
      on: () => handle as never,
      subscribe: () => handle as never,
      send: async () => 'ok' as const,
    };
    return Object.assign(handle, chain);
  };

  const unavailable = (method: string) => {
    throw new Error(`[Supabase] "${method}" indisponible : aucun service Supabase n'est configuré (mode local).`);
  };

  return {
    channel,
    removeChannel: async () => 'ok' as const,
    removeAllChannels: async () => [],
    from: () => unavailable('from'),
    rpc: () => unavailable('rpc'),
    storage: () => unavailable('storage'),
    auth: () => unavailable('auth'),
  } as unknown as SupabaseClient;
}

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.info('[Supabase] Service non configuré : fonctionnement 100 % local.');
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createNoopClient();
