-- Ajout de la section, de l'option et de la capacité maximale d'une classe
ALTER TABLE "SchoolClass"
  ADD COLUMN IF NOT EXISTS "option" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 0;
