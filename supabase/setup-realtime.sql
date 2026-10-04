-- ============================================================
-- GradeUp — Activation de Supabase Realtime
-- Exécuter ce script dans l'SQL Editor de Supabase (ou via
-- `psql` / `supabase db` ) pour publier les tables utilisées
-- par le temps réel de l'application.
--
-- Tables concernées (côté client) :
--   Message        → messagerie instantanée (chat-page)
--   Participant    → présence en réunion (meeting-room)
--   CourseSchedule → emplois du temps live (admin-schedules, weekly)
--   Notification   → notifications temps réel (SSE + Realtime)
--   SchoolYear     → diffusion de la clôture (broadcast year-closed)
-- ============================================================

-- 1) Créer la publication si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2) Ajouter les tables temps réel EXISTANTES à la publication et activer
--    REPLICA IDENTITY FULL. Les noms réels sont lus depuis pg_tables pour
--    gérer l'absence de certaines tables ou un casing différent.
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
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- Note : les événements de type `broadcast` (ex. year-closed) ne nécessitent
-- pas de table ; ils passent par le canal Supabase Realtime (client).
-- Côté client, `src/lib/realtime.ts` s'abonne via postgres_changes + broadcast.
