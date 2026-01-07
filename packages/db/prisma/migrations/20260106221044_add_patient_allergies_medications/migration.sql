-- AlterTable
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allergies" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "medications" TEXT;
