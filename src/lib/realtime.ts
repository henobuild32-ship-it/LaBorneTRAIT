import { supabase } from '@/lib/supabase';

export function isRealtimeEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export type RealtimeTableEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface TableSubscriptionOptions {
  table: string;
  event?: RealtimeTableEvent;
  schema?: string;
  channelName?: string;
  onEvent: (payload: any) => void;
}

/**
 * Subscribes the browser to Supabase Realtime `postgres_changes` for a given table.
 * Mirrors the proven pattern used by `subscribeToNotifications` (no custom server needed).
 *
 * The client receives every row change for the table and must filter client-side
 * (multi-tenant safety / RLS), exactly like the notification stream.
 *
 * IMPORTANT (infra): for `postgres_changes` to fire, the table MUST be added to the
 * Supabase Realtime publication, e.g.:
 *   alter publication supabase_realtime add table "Message";
 *   alter publication supabase_realtime add table "Participant";
 * and RLS must allow the anon key to SELECT the table (or RLS must be disabled).
 *
 * Returns an unsubscribe/cleanup function. No-op during SSR or when Supabase is unset.
 */
export function subscribeToTable({
  table,
  event = '*',
  schema = 'public',
  channelName,
  onEvent,
}: TableSubscriptionOptions): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!isRealtimeEnabled()) return () => {};

  const name =
    channelName ||
    `rt-${table}-${Math.random().toString(36).slice(2, 10)}`;

  const channel = supabase
    .channel(name)
    .on('postgres_changes', { event, schema, table }, (payload: any) => {
      onEvent(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Connected to table "${table}" on channel ${name}`);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export { supabase };
