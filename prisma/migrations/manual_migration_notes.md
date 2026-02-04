# Migration Notes: Company/Recruiter/Subscription Refactoring

## Overview
This migration merges CompanyMember into Recruiter and moves Subscription from Recruiter to Company.

## Schema Changes

### 1. Recruiter table changes
- ADD `role` (CompanyRole) - default 'MEMBER'
- ADD `status` (CompanyMemberStatus) - default 'ACTIVE'
- ADD `invitedByAccountId` (String, nullable)
- ADD `joinedAt` (DateTime, nullable)
- ADD `createdAt` (DateTime)
- ADD `updatedAt` (DateTime)
- REMOVE `companyName` column
- CHANGE `companyId` from nullable to required
- ADD INDEX on `companyId`

### 2. Subscription table changes
- RENAME `recruiterId` to `companyId`
- UPDATE foreign key to reference `Company` instead of `Recruiter`

### 3. PointTransaction table changes
- RENAME `recruiterId` to `companyId`
- UPDATE foreign key to reference `Company` instead of `Recruiter`
- UPDATE INDEX from `recruiterId` to `companyId`

### 4. Account table changes
- REMOVE relation to CompanyMember (companyMemberships)
- REMOVE relation to CompanyMember as MemberInviter (invitedMembers)
- ADD relation to Recruiter as RecruiterInviter (invitedRecruiters)

### 5. Company table changes
- REMOVE relation to CompanyMember (members)
- ADD relation to Subscription
- ADD relation to PointTransaction

### 6. DROP CompanyMember table

## Data Migration Steps

Before running the schema migration, data must be migrated:

```sql
-- 1. Add new columns to Recruiter
ALTER TABLE "Recruiter"
  ADD COLUMN "role" "CompanyRole" DEFAULT 'MEMBER',
  ADD COLUMN "status" "CompanyMemberStatus" DEFAULT 'ACTIVE',
  ADD COLUMN "invitedByAccountId" TEXT,
  ADD COLUMN "joinedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- 2. Copy data from CompanyMember to Recruiter
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

-- 3. For Recruiters without companyId, create companies
-- (Handle case by case based on existing data)

-- 4. Create new Subscription table with companyId
CREATE TABLE "Subscription_new" (
  -- same structure but with companyId instead of recruiterId
);

-- 5. Migrate Subscription data from recruiterId to companyId
INSERT INTO "Subscription_new" (id, "companyId", ...)
SELECT s.id, r."companyId", ...
FROM "Subscription" s
JOIN "Recruiter" r ON s."recruiterId" = r.id;

-- 6. Same for PointTransaction

-- 7. Drop old tables and rename new ones

-- 8. Drop CompanyMember table
DROP TABLE "CompanyMember";

-- 9. Remove companyName from Recruiter
ALTER TABLE "Recruiter" DROP COLUMN "companyName";
```

## Running the Migration

When the database is available, run:
```bash
npx prisma migrate dev --name refactor_company_recruiter_subscription
```

This will generate the actual migration SQL. Review it carefully before applying.
