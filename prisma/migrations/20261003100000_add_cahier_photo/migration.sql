-- Photos du cahier de cotation : prise/import de photos par classe secondaire
CREATE TABLE IF NOT EXISTS "CahierPhoto" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "courseId" TEXT,
  "period" TEXT NOT NULL DEFAULT 'P1',
  "page" INTEGER NOT NULL DEFAULT 1,
  "url" TEXT NOT NULL,
  "fileName" TEXT NOT NULL DEFAULT '',
  "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
  "size" INTEGER NOT NULL DEFAULT 0,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CahierPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CahierPhoto_schoolId_classId_courseId_period_idx"
  ON "CahierPhoto"("schoolId", "classId", "courseId", "period");

CREATE INDEX IF NOT EXISTS "CahierPhoto_uploadedById_createdAt_idx"
  ON "CahierPhoto"("uploadedById", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CahierPhoto_classId_fkey'
  ) THEN
    ALTER TABLE "CahierPhoto"
      ADD CONSTRAINT "CahierPhoto_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CahierPhoto_courseId_fkey'
  ) THEN
    ALTER TABLE "CahierPhoto"
      ADD CONSTRAINT "CahierPhoto_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;
