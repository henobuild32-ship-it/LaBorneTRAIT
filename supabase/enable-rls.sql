-- ============================================================
-- GradeUp — Activation de Row Level Security (RLS) sur toutes
-- les tables du schéma public.
--
-- Contexte important :
--   * L'application utilise PRISMA qui se connecte avec le rôle
--     `postgres` (propriétaire des tables). Postgres/contourne
--     RLS pour le propriétaire des tables -> le backend continue
--     de fonctionner normalement après ce script.
--   * Supabase Realtime s'abonne côté navigateur avec la clé ANON.
--     RLS bloque donc les changements temps réel SAUF si une
--     policy SELECT existe pour le rôle `anon`/`authenticated`.
--     On l'ajoute uniquement sur les 5 tables diffusées.
--   * Le rôle `service_role` (côté serveur Supabase) contourne
--     déjà RLS par défaut.
--
-- Ce script est IDEMPOTENT : il peut être exécuté plusieurs fois.
-- ============================================================


-- 1) Activer RLS sur TOUTES les tables du schéma public
--    (couvre les 29 tables signalées par l'advisor + les tables
--     de jointure implicites créées par Prisma).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;


-- 2) Policies de LECTURE pour le Realtime (clé anon/authenticated)
--    Nécessaires pour que les abonnements postgres_changes
--    (Message, Participant, CourseSchedule, Notification, SchoolYear)
--    continuent de recevoir les événements.
DO $$
DECLARE
  rt_lower text[] := ARRAY['message', 'participant', 'courseschedule', 'notification', 'schoolyear'];
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND lower(tablename) = ANY(rt_lower)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'realtime_select_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)',
      'realtime_select_' || t, t
    );
  END LOOP;
END $$;


-- 3) (Optionnel mais explicite) Le rôle service_role garde un accès
--    complet sur les tables temps réel côté serveur. Redondant car
--    service_role contourne déjà RLS, mais documente l'intention.
DO $$
DECLARE
  rt_lower text[] := ARRAY['message', 'participant', 'courseschedule', 'notification', 'schoolyear'];
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND lower(tablename) = ANY(rt_lower)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'service_role_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || t, t
    );
  END LOOP;
END $$;
