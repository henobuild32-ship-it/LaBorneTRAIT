-- Migration: Ajouter la table CotationTransmission
-- Exécuter dans l'éditeur SQL de Supabase Dashboard

CREATE TABLE IF NOT EXISTS "CotationTransmission" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "titulaireId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "lastResentAt" TIMESTAMP(3),
  "resentCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CotationTransmission_pkey" PRIMARY KEY ("id")
);

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS "CotationTransmission_evaluationId_titulaireId_key"
  ON "CotationTransmission"("evaluationId", "titulaireId");

CREATE INDEX IF NOT EXISTS "CotationTransmission_schoolId_classId_status_idx"
  ON "CotationTransmission"("schoolId", "classId", "status");

CREATE INDEX IF NOT EXISTS "CotationTransmission_titulaireId_status_idx"
  ON "CotationTransmission"("titulaireId", "status");

CREATE INDEX IF NOT EXISTS "CotationTransmission_evaluationId_status_idx"
  ON "CotationTransmission"("evaluationId", "status");

-- Foreign Keys
ALTER TABLE "CotationTransmission"
  ADD CONSTRAINT "CotationTransmission_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "CahierEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CotationTransmission"
  ADD CONSTRAINT "CotationTransmission_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CotationTransmission"
  ADD CONSTRAINT "CotationTransmission_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CotationTransmission"
  ADD CONSTRAINT "CotationTransmission_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CotationTransmission"
  ADD CONSTRAINT "CotationTransmission_titulaireId_fkey"
  FOREIGN KEY ("titulaireId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
