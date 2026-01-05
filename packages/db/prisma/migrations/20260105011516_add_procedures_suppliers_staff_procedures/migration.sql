-- CreateTable
CREATE TABLE "procedures" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "observations" TEXT,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_procedures" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "procedure_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_procedures_staff_id_procedure_id_key" ON "staff_procedures"("staff_id", "procedure_id");

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_procedures" ADD CONSTRAINT "staff_procedures_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_procedures" ADD CONSTRAINT "staff_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
