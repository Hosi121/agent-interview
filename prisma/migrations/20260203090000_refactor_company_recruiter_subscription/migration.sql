-- Refactor company/recruiter/subscription to company-centric model

-- 1) Recruiter: add member fields
ALTER TABLE "Recruiter"
  ADD COLUMN "role" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "status" "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "invitedByAccountId" TEXT,
  ADD COLUMN "joinedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2) Migrate CompanyMember -> Recruiter (if present)
UPDATE "Recruiter" r
SET "companyId" = cm."companyId"
FROM "CompanyMember" cm
WHERE r."accountId" = cm."accountId"
  AND r."companyId" IS NULL;

UPDATE "Recruiter" r
SET
  role = cm.role,
  status = cm.status,
  "invitedByAccountId" = cm."invitedByAccountId",
  "joinedAt" = cm."joinedAt",
  "createdAt" = cm."createdAt",
  "updatedAt" = cm."updatedAt"
FROM "CompanyMember" cm
WHERE r."accountId" = cm."accountId"
  AND r."companyId" = cm."companyId";

-- 3) For recruiters still missing companyId, create companies from legacy companyName
CREATE TEMPORARY TABLE _new_companies AS
  SELECT
    r.id AS recruiter_id,
    md5(random()::text || clock_timestamp()::text) AS company_id,
    r."companyName" AS name
  FROM "Recruiter" r
  WHERE r."companyId" IS NULL;

INSERT INTO "Company" (id, name, slug, "createdAt", "updatedAt")
SELECT
  nc.company_id,
  nc.name,
  'migrated-' || nc.company_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM _new_companies nc;

UPDATE "Recruiter" r
SET "companyId" = nc.company_id
FROM _new_companies nc
WHERE r.id = nc.recruiter_id;

DROP TABLE _new_companies;

-- 4) Drop legacy companyName and enforce companyId required
ALTER TABLE "Recruiter" DROP COLUMN "companyName";
ALTER TABLE "Recruiter" ALTER COLUMN "companyId" SET NOT NULL;

-- 5) Refresh Recruiter foreign keys
ALTER TABLE "Recruiter" DROP CONSTRAINT "Recruiter_companyId_fkey";
ALTER TABLE "Recruiter" ADD CONSTRAINT "Recruiter_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recruiter" ADD CONSTRAINT "Recruiter_invitedByAccountId_fkey"
  FOREIGN KEY ("invitedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Drop CompanyMember table
DROP TABLE "CompanyMember";

-- 7) Subscription: move recruiterId -> companyId
ALTER TABLE "Subscription" ADD COLUMN "companyId" TEXT;
UPDATE "Subscription" s
SET "companyId" = r."companyId"
FROM "Recruiter" r
WHERE s."recruiterId" = r.id;
ALTER TABLE "Subscription" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX "Subscription_recruiterId_key";
DROP INDEX "Subscription_recruiterId_idx";
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_recruiterId_fkey";
ALTER TABLE "Subscription" DROP COLUMN "recruiterId";

CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");
CREATE INDEX "Subscription_companyId_idx" ON "Subscription"("companyId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8) PointTransaction: move recruiterId -> companyId
ALTER TABLE "PointTransaction" ADD COLUMN "companyId" TEXT;
UPDATE "PointTransaction" pt
SET "companyId" = r."companyId"
FROM "Recruiter" r
WHERE pt."recruiterId" = r.id;
ALTER TABLE "PointTransaction" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX "PointTransaction_recruiterId_createdAt_idx";
ALTER TABLE "PointTransaction" DROP CONSTRAINT "PointTransaction_recruiterId_fkey";
ALTER TABLE "PointTransaction" DROP COLUMN "recruiterId";

CREATE INDEX "PointTransaction_companyId_createdAt_idx" ON "PointTransaction"("companyId", "createdAt");
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9) CompanyAccess: move recruiterId -> companyId
ALTER TABLE "CompanyAccess" ADD COLUMN "companyId" TEXT;
UPDATE "CompanyAccess" ca
SET "companyId" = r."companyId"
FROM "Recruiter" r
WHERE ca."recruiterId" = r.id;
ALTER TABLE "CompanyAccess" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX "CompanyAccess_userId_recruiterId_key";
DROP INDEX "CompanyAccess_recruiterId_idx";
ALTER TABLE "CompanyAccess" DROP CONSTRAINT "CompanyAccess_recruiterId_fkey";
ALTER TABLE "CompanyAccess" DROP COLUMN "recruiterId";

CREATE UNIQUE INDEX "CompanyAccess_userId_companyId_key" ON "CompanyAccess"("userId", "companyId");
CREATE INDEX "CompanyAccess_companyId_idx" ON "CompanyAccess"("companyId");
ALTER TABLE "CompanyAccess" ADD CONSTRAINT "CompanyAccess_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
