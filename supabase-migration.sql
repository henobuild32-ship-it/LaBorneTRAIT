-- Script SQL à exécuter dans l'éditeur SQL de Supabase
-- Ajoute toutes les colonnes manquantes pour les cartes d'identité

-- ============================================================
-- 1. Table School : ajout couleur personnalisée + année scolaire
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'color') THEN
    ALTER TABLE "School" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#2563eb';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'academicYear') THEN
    ALTER TABLE "School" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 2. Table User : toutes les colonnes pour la carte d'identité
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'bloodType') THEN
    ALTER TABLE "User" ADD COLUMN "bloodType" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'nationality') THEN
    ALTER TABLE "User" ADD COLUMN "nationality" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'address') THEN
    ALTER TABLE "User" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentEmail') THEN
    ALTER TABLE "User" ADD COLUMN "parentEmail" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'cardIssuedDate') THEN
    ALTER TABLE "User" ADD COLUMN "cardIssuedDate" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'cardExpiryDate') THEN
    ALTER TABLE "User" ADD COLUMN "cardExpiryDate" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'ine') THEN
    ALTER TABLE "User" ADD COLUMN "ine" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'tuteur') THEN
    ALTER TABLE "User" ADD COLUMN "tuteur" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'contactTuteur') THEN
    ALTER TABLE "User" ADD COLUMN "contactTuteur" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'allergies') THEN
    ALTER TABLE "User" ADD COLUMN "allergies" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'assurance') THEN
    ALTER TABLE "User" ADD COLUMN "assurance" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 3. Synchronisation : marquer le schema Prisma comme à jour
--    (Crée ou met à jour la table _prisma_migrations)
-- ============================================================
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT
  gen_random_uuid()::text,
  '',
  NOW(),
  'add_card_fields_manual',
  '',
  NULL,
  NOW(),
  0
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = 'add_card_fields_manual');
