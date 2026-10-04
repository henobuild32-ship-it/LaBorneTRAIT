/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Connecting to DB...");
    const schoolCount = await prisma.school.count();
    console.log("School count:", schoolCount);
    
    const reportCardCount = await prisma.reportCard.count();
    console.log("Report card count:", reportCardCount);

    const counters = await prisma.reportCounter.findMany();
    console.log("Counters:", counters);
  } catch (error) {
    console.error("Prisma query failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
