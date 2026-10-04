/* eslint-disable @typescript-eslint/no-require-imports */
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
    // Let's get a student and a class to test with
    const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const cls = await prisma.schoolClass.findFirst();
    const school = await prisma.school.findFirst();

    if (!student || !cls || !school) {
      console.log("Missing student, class, or school in DB. Cannot test.");
      return;
    }

    console.log("Testing with Student:", student.fullName, "Class:", cls.name, "School:", school.name);

    // Create a counter
    const year = 2026;
    const counter = await prisma.reportCounter.upsert({
      where: { year },
      update: { currentCount: { increment: 1 } },
      create: { year, currentCount: 1, maxLimit: 1000000 }
    });

    const reportNumber = `${year}-KIN-${String(counter.currentCount).padStart(8, '0')}`;

    const reportCard = await prisma.reportCard.create({
      data: {
        reportNumber,
        schoolId: school.id,
        classId: cls.id,
        studentId: student.id,
        trimester: "1",
        academicYear: "2025-2026",
        studentName: student.fullName,
        studentGender: student.gender,
        studentBirthDate: student.birthDate || "2000-01-01",
        totalPointsObtained: 150,
        totalPointsPossible: 200,
        overallPercentage: 75,
        averageGrade: 15,
        classRank: 1,
        mention: "Passage",
        status: "draft",
        gradesData: { test: true }
      }
    });

    console.log("Successfully created report card:", reportCard.id, reportCard.reportNumber);
  } catch (err) {
    console.error("Prisma error during creation:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
