ALTER TABLE "Grade" ADD COLUMN IF NOT EXISTS "week" INTEGER;

CREATE TABLE IF NOT EXISTS "AcademicClosure" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "schoolYearId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "closedById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicClosure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicClosure_schoolId_schoolYearId_scope_key_key"
  ON "AcademicClosure"("schoolId", "schoolYearId", "scope", "key");
CREATE INDEX IF NOT EXISTS "AcademicClosure_schoolId_schoolYearId_idx"
  ON "AcademicClosure"("schoolId", "schoolYearId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicClosure_schoolId_fkey') THEN
    ALTER TABLE "AcademicClosure" ADD CONSTRAINT "AcademicClosure_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicClosure_schoolYearId_fkey') THEN
    ALTER TABLE "AcademicClosure" ADD CONSTRAINT "AcademicClosure_schoolYearId_fkey"
      FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicClosure_closedById_fkey') THEN
    ALTER TABLE "AcademicClosure" ADD CONSTRAINT "AcademicClosure_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
