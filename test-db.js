/* eslint-disable */
const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log("Testing connection...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.argv[2]
      }
    }
  });
  try {
    const start = Date.now();
    await prisma.$connect();
    console.log("Successfully connected in", Date.now() - start, "ms!");
    const count = await prisma.school.count();
    console.log("School count:", count);
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
