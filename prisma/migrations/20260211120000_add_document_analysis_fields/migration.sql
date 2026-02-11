-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "analysisError" TEXT,
  ADD COLUMN "analyzedAt" TIMESTAMP(3);
