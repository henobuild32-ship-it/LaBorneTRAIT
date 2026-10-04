-- ═══════════════════════════════════════════════════════════════
-- SCRIPT SUPABASE FINAL — Synchronisation complète du schéma
-- À exécuter DANS L'ORDRE dans l'éditeur SQL de Supabase
-- ═══════════════════════════════════════════════════════════════

-- ============================================================
-- PARTIE 1 : Ajouter toutes les colonnes manquantes à School
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '--- School ---';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'color') THEN
    ALTER TABLE "School" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#2563eb';
    RAISE NOTICE '  + color';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'academicYear') THEN
    ALTER TABLE "School" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + academicYear';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'deletedAt') THEN
    ALTER TABLE "School" ADD COLUMN "deletedAt" TIMESTAMPTZ;
    RAISE NOTICE '  + deletedAt';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'latitude') THEN
    ALTER TABLE "School" ADD COLUMN "latitude" DOUBLE PRECISION;
    RAISE NOTICE '  + latitude';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'longitude') THEN
    ALTER TABLE "School" ADD COLUMN "longitude" DOUBLE PRECISION;
    RAISE NOTICE '  + longitude';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'schoolCode') THEN
    ALTER TABLE "School" ADD COLUMN "schoolCode" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + schoolCode';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'School' AND column_name = 'subscriptionExpiry') THEN
    ALTER TABLE "School" ADD COLUMN "subscriptionExpiry" TIMESTAMPTZ;
    RAISE NOTICE '  + subscriptionExpiry';
  END IF;
END $$;

-- ============================================================
-- PARTIE 2 : Ajouter toutes les colonnes manquantes à "User"
-- (User est un mot réservé PostgreSQL, doit être entre guillemets)
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '--- User ---';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'photoUrl') THEN
    ALTER TABLE "User" ADD COLUMN "photoUrl" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + photoUrl';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentCode') THEN
    ALTER TABLE "User" ADD COLUMN "parentCode" TEXT UNIQUE;
    RAISE NOTICE '  + parentCode';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentId') THEN
    ALTER TABLE "User" ADD COLUMN "parentId" TEXT;
    RAISE NOTICE '  + parentId';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentPhone') THEN
    ALTER TABLE "User" ADD COLUMN "parentPhone" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + parentPhone';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentPhone2') THEN
    ALTER TABLE "User" ADD COLUMN "parentPhone2" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + parentPhone2';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'cardId') THEN
    ALTER TABLE "User" ADD COLUMN "cardId" TEXT UNIQUE;
    RAISE NOTICE '  + cardId';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'postName') THEN
    ALTER TABLE "User" ADD COLUMN "postName" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + postName';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'birthDate') THEN
    ALTER TABLE "User" ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + birthDate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'matricule') THEN
    ALTER TABLE "User" ADD COLUMN "matricule" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + matricule';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'section') THEN
    ALTER TABLE "User" ADD COLUMN "section" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + section';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'academicYear') THEN
    ALTER TABLE "User" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + academicYear';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'bloodType') THEN
    ALTER TABLE "User" ADD COLUMN "bloodType" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + bloodType';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'nationality') THEN
    ALTER TABLE "User" ADD COLUMN "nationality" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + nationality';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'address') THEN
    ALTER TABLE "User" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + address';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'parentEmail') THEN
    ALTER TABLE "User" ADD COLUMN "parentEmail" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + parentEmail';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'cardIssuedDate') THEN
    ALTER TABLE "User" ADD COLUMN "cardIssuedDate" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + cardIssuedDate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'cardExpiryDate') THEN
    ALTER TABLE "User" ADD COLUMN "cardExpiryDate" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + cardExpiryDate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'ine') THEN
    ALTER TABLE "User" ADD COLUMN "ine" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + ine';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'tuteur') THEN
    ALTER TABLE "User" ADD COLUMN "tuteur" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + tuteur';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'contactTuteur') THEN
    ALTER TABLE "User" ADD COLUMN "contactTuteur" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + contactTuteur';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'allergies') THEN
    ALTER TABLE "User" ADD COLUMN "allergies" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + allergies';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'assurance') THEN
    ALTER TABLE "User" ADD COLUMN "assurance" TEXT NOT NULL DEFAULT '';
    RAISE NOTICE '  + assurance';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'aiPreferences') THEN
    ALTER TABLE "User" ADD COLUMN "aiPreferences" TEXT NOT NULL DEFAULT '{}';
    RAISE NOTICE '  + aiPreferences';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isTitulaire') THEN
    ALTER TABLE "User" ADD COLUMN "isTitulaire" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE '  + isTitulaire';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'deletedAt') THEN
    ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMPTZ;
    RAISE NOTICE '  + deletedAt';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'active') THEN
    ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
    RAISE NOTICE '  + active';
  END IF;
END $$;

-- ============================================================
-- PARTIE 3 : Créer la table live_locations si absente
-- ============================================================
CREATE TABLE IF NOT EXISTS "live_locations" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
    "latitude"  DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy"  DOUBLE PRECISION,
    "source"    TEXT NOT NULL DEFAULT 'gps',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "live_locations_userId_idx" ON "live_locations"("userId");

-- ============================================================
-- PARTIE 4 : Créer la table presences si absente
-- ============================================================
CREATE TABLE IF NOT EXISTS "presences" (
    "id"            TEXT PRIMARY KEY,
    "school_id"     TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
    "user_id"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "date"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "heure_arrivee" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "statut"        TEXT NOT NULL,
    "justification" TEXT,
    "valide_par"    TEXT,
    "latitude"      DOUBLE PRECISION,
    "longitude"     DOUBLE PRECISION,
    "cree_le"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "modifie_le"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt"     TIMESTAMPTZ,
    CONSTRAINT "presences_userId_date_unique" UNIQUE ("user_id", "date")
);

CREATE INDEX IF NOT EXISTS "presences_school_id_date_idx" ON "presences"("school_id", "date");
CREATE INDEX IF NOT EXISTS "presences_school_id_user_id_date_idx" ON "presences"("school_id", "user_id", "date");

-- ============================================================
-- PARTIE 5 : Tables VideoConference, Participant, Recording
-- ============================================================
CREATE TABLE IF NOT EXISTS "VideoConference" (
    "id"            TEXT PRIMARY KEY,
    "schoolId"      TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
    "title"         TEXT NOT NULL,
    "description"   TEXT NOT NULL DEFAULT '',
    "date"          TEXT NOT NULL DEFAULT '',
    "time"          TEXT NOT NULL DEFAULT '',
    "roomUrl"       TEXT NOT NULL DEFAULT '',
    "targetRole"    TEXT NOT NULL DEFAULT 'ALL',
    "targetClassId" TEXT NOT NULL DEFAULT '',
    "type"          TEXT NOT NULL DEFAULT 'scheduled',
    "status"        TEXT NOT NULL DEFAULT 'scheduled',
    "isLocked"      BOOLEAN NOT NULL DEFAULT false,
    "creatorId"     TEXT NOT NULL DEFAULT '',
    "startedAt"     TIMESTAMPTZ,
    "endedAt"       TIMESTAMPTZ,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt"     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "VideoConference_schoolId_status_idx" ON "VideoConference"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "VideoConference_schoolId_date_idx" ON "VideoConference"("schoolId", "date");

CREATE TABLE IF NOT EXISTS "Participant" (
    "id"        TEXT PRIMARY KEY,
    "meetingId" TEXT NOT NULL REFERENCES "VideoConference"(id) ON DELETE CASCADE,
    "schoolId"  TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "fullName"  TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "status"    TEXT NOT NULL DEFAULT 'pending',
    "isCoHost"  BOOLEAN NOT NULL DEFAULT false,
    "joinedAt"  TIMESTAMPTZ,
    "leftAt"    TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "Participant_meetingId_idx" ON "Participant"("meetingId");
CREATE INDEX IF NOT EXISTS "Participant_schoolId_userId_idx" ON "Participant"("schoolId", "userId");

CREATE TABLE IF NOT EXISTS "Recording" (
    "id"              TEXT PRIMARY KEY,
    "meetingId"       TEXT NOT NULL REFERENCES "VideoConference"(id) ON DELETE CASCADE,
    "schoolId"        TEXT NOT NULL,
    "createdById"     TEXT NOT NULL,
    "url"             TEXT NOT NULL DEFAULT '',
    "note"            TEXT NOT NULL DEFAULT '',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt"       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "Recording_meetingId_idx" ON "Recording"("meetingId");

-- ============================================================
-- PARTIE 6 : INDEX manquants sur School et User
-- ============================================================
CREATE INDEX IF NOT EXISTS "School_subscriptionStatus_idx" ON "School"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "School_inviteCode_idx" ON "School"("inviteCode");

CREATE INDEX IF NOT EXISTS "User_schoolId_role_active_idx" ON "User"("schoolId", "role", "active");
CREATE INDEX IF NOT EXISTS "User_schoolId_parentId_idx" ON "User"("schoolId", "parentId");
CREATE INDEX IF NOT EXISTS "User_schoolId_isTitulaire_idx" ON "User"("schoolId", "isTitulaire");
CREATE INDEX IF NOT EXISTS "User_cardId_idx" ON "User"("cardId");

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
DO $$
DECLARE
  missing_school TEXT[];
  missing_user TEXT[];
  col TEXT;
BEGIN
  SELECT array_agg(column_name::text) INTO missing_school
  FROM information_schema.columns
  WHERE table_name = 'School' AND column_name IN ('color','academicYear','deletedAt','latitude','longitude','schoolCode','subscriptionExpiry');

  SELECT array_agg(column_name::text) INTO missing_user
  FROM information_schema.columns
  WHERE table_name = 'User' AND column_name IN ('bloodType','nationality','address','parentEmail','cardIssuedDate','cardExpiryDate','ine','tuteur','contactTuteur','allergies','assurance','deletedAt','isTitulaire','active','cardId','postName','birthDate','matricule','section','photoUrl','parentCode','parentPhone','parentPhone2','aiPreferences','academicYear');

  RAISE NOTICE '──────────────────────────────────────────';
  RAISE NOTICE 'VÉRIFICATION School : % colonne(s) manquante(s)', array_length(missing_school, 1);
  IF missing_school IS NOT NULL THEN FOREACH col IN ARRAY missing_school LOOP RAISE NOTICE '  MISSING School.%', col; END LOOP; END IF;
  RAISE NOTICE 'VÉRIFICATION User : % colonne(s) manquante(s)', array_length(missing_user, 1);
  IF missing_user IS NOT NULL THEN FOREACH col IN ARRAY missing_user LOOP RAISE NOTICE '  MISSING User.%', col; END LOOP; END IF;
  RAISE NOTICE '──────────────────────────────────────────';
  RAISE NOTICE '✅ Script terminé. Vérifier les NOTICE ci-dessus.';
  RAISE NOTICE '   S''il reste des MISSING, exécuter la partie correspondante.';
END $$;
