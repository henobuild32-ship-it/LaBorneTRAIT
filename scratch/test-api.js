/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const schools = await prisma.school.findMany({ take: 2 });
    console.log("Found schools:", schools.map(s => ({ id: s.id, name: s.name })));
    
    if (schools.length > 0) {
      const validId = schools[0].id;
      console.log(`\nTesting stats API with valid schoolId: ${validId}`);
      const res1 = await fetch(`http://localhost:3000/api/report-cards/stats?schoolId=${validId}`);
      console.log("Status:", res1.status);
      console.log("Body:", await res1.json());
    }
    
    console.log("\nTesting stats API with undefined schoolId");
    const res2 = await fetch(`http://localhost:3000/api/report-cards/stats?schoolId=undefined`);
    console.log("Status:", res2.status);
    console.log("Body:", await res2.json());
    
    console.log("\nTesting stats API with missing schoolId");
    const res3 = await fetch(`http://localhost:3000/api/report-cards/stats`);
    console.log("Status:", res3.status);
    console.log("Body:", await res3.json());
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
