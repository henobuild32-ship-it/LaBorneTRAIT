/* eslint-disable */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres:EEHqMU7oOKr91d2f@db.nqgrpkzrbzkjpqthydpd.supabase.co:5432/postgres"
      }
    }
  });

  try {
    const gradeCount = await prisma.grade.count();
    console.log("Total Grades (standard):", gradeCount);

    const detailedCount = await prisma.detailedGrade.count();
    console.log("Total Detailed Grades:", detailedCount);

    if (gradeCount > 0) {
      const grades = await prisma.grade.findMany({ take: 5, include: { course: true, student: true } });
      console.log("Sample Grades:", grades.map(g => ({
        id: g.id,
        student: g.student.fullName,
        course: g.course.name,
        score: g.score,
        trimester: g.trimester
      })));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
