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
    const rcCount = await prisma.reportCard.count();
    console.log("Total Report Cards:", rcCount);

    const counterCount = await prisma.reportCounter.count();
    console.log("Total Report Counters:", counterCount);

    if (counterCount > 0) {
      const counters = await prisma.reportCounter.findMany();
      console.log("Counters:", counters);
    }

    if (rcCount > 0) {
      const cards = await prisma.reportCard.findMany({ take: 5 });
      console.log("Sample Report Cards:", cards.map(c => ({ id: c.id, reportNumber: c.reportNumber, studentName: c.studentName })));
    }
  } catch (err) {
    console.error("Error checking database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
