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
    const courses = [
      // Section Scientifique, 6ème (Grade 12)
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Mathématique", maxScore: 40, coefficient: 2 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Physique", maxScore: 40, coefficient: 2 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Chimie", maxScore: 30, coefficient: 2 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Biologie", maxScore: 30, coefficient: 2 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Français", maxScore: 30, coefficient: 2 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Anglais", maxScore: 20, coefficient: 1 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Philosophie", maxScore: 20, coefficient: 1 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Histoire", maxScore: 20, coefficient: 1 },
      { section: "Scientifique", option: "Chimie-Bio", level: "6ème", courseName: "Géographie", maxScore: 20, coefficient: 1 },

      // Section Littéraire, 6ème (Grade 12)
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Français", maxScore: 40, coefficient: 2 },
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Langue des affaires", maxScore: 30, coefficient: 2 },
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Philosophie", maxScore: 40, coefficient: 2 },
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Histoire", maxScore: 30, coefficient: 2 },
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Géographie", maxScore: 20, coefficient: 1 },
      { section: "Littéraire", option: "Langues", level: "6ème", courseName: "Mathématiques", maxScore: 20, coefficient: 1 }
    ];

    for (const c of courses) {
      await prisma.ePSTCurriculum.upsert({
        where: {
          section_option_level_courseName: {
            section: c.section,
            option: c.option,
            level: c.level,
            courseName: c.courseName
          }
        },
        update: {
          maxScore: c.maxScore,
          coefficient: c.coefficient
        },
        create: c
      });
    }

    console.log("EPST Curriculum successfully seeded.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
