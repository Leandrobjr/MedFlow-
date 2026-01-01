-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "commission_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "fixed_commission" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "rqe" TEXT,
ADD COLUMN     "rqe_state" TEXT;
