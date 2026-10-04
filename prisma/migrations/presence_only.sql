-- Add GPS coordinates to School table
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Add last presence timestamp to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "derniere_presence" TIMESTAMP(3);

-- Create presences table for attendance tracking
CREATE TABLE IF NOT EXISTS "presences" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "heure_arrivee" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "statut" TEXT NOT NULL DEFAULT 'PRESENT',
    "justification" TEXT,
    "valide_par" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presences_pkey" PRIMARY KEY ("id")
);

-- Unique: one presence per user per day (anti-fraud)
CREATE UNIQUE INDEX IF NOT EXISTS "presences_user_id_date_key" ON "presences"("user_id", "date");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'presences_school_id_fkey'
  ) THEN
    ALTER TABLE "presences" ADD CONSTRAINT "presences_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'presences_user_id_fkey'
  ) THEN
    ALTER TABLE "presences" ADD CONSTRAINT "presences_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
