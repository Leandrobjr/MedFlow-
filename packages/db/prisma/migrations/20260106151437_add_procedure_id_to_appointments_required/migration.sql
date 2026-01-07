/*
  Warnings:

  - Added the required column `procedure_id` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- Limpar dados de teste (ambiente de desenvolvimento)
DELETE FROM "appointments";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "procedure_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
