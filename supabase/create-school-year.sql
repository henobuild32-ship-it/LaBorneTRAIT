-- ============================================================
-- GradeUp — Création de la table SchoolYear (clôture de l'année)
-- Alternative à `prisma db push` si la connexion directe est indisponible.
-- Exécuter ce script dans le SQL Editor de Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS "SchoolYear" (
  "id"            text PRIMARY KEY,
  "schoolId"      text NOT NULL,
  "year"          text NOT NULL,
  "status"        text NOT NULL DEFAULT 'OPEN',
  "closedById"    text,
  "closedAt"      timestamptz,
  "transitionData" jsonb,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "SchoolYear_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "School"(id) ON DELETE CASCADE
);

-- Contrainte d'unicité : une seule entrée par école + année
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolYear_schoolId_year_key"
  ON "SchoolYear" ("schoolId", "year");

-- (Optionnel) Publier la table pour le temps réel Supabase
-- ALTER PUBLICATION supabase_realtime ADD TABLE "SchoolYear";
-- ALTER TABLE "SchoolYear" REPLICA IDENTITY FULL;
