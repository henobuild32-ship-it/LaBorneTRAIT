-- Phase Courses & Schedules real-time migration

-- Add status to Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add periodStart, periodEnd, and exceptions to CourseSchedule
ALTER TABLE "CourseSchedule" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP;
ALTER TABLE "CourseSchedule" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP;
ALTER TABLE "CourseSchedule" ADD COLUMN IF NOT EXISTS "exceptions" TEXT NOT NULL DEFAULT '[]';

SELECT 'Migration Course & Schedule OK ✅' AS status;
