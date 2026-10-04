/* eslint-disable @typescript-eslint/no-require-imports */
/* Read-only verification of the real database prerequisites for the grade/promotion flow. */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  const schools = await db.school.count();
  const students = await db.user.count({ where: { role: 'STUDENT' } });
  const enrollments = await db.enrolledClass.count();
  const passages = await db.passageHistorique.count();
  const grades = await db.grade.count();
  const evaluations = await db.cahierEvaluation.count({ where: { deletedAt: null } });
  const result = { schools, students, enrollments, passages, grades, evaluations, checks: {
    hasStudents: students > 0,
    hasEnrollments: enrollments > 0,
    promotionHistoryReadable: passages >= 0,
    gradesReadable: grades >= 0,
    evaluationsReadable: evaluations >= 0,
  }};
  console.log(JSON.stringify(result, null, 2));
  await db.$disconnect();
})().catch(async (error) => {
  console.error(error.message);
  await db.$disconnect();
  process.exit(1);
});
