-- AlterTable
ALTER TABLE "Recruiter" ALTER COLUMN "joinedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Recruiter_companyId_idx" ON "Recruiter"("companyId");
