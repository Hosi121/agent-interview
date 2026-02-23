-- CreateIndex
CREATE INDEX "Session_recruiterId_agentId_sessionType_idx" ON "Session"("recruiterId", "agentId", "sessionType");

-- CreateIndex
CREATE INDEX "Session_userId_sessionType_idx" ON "Session"("userId", "sessionType");

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Fragment_userId_idx" ON "Fragment"("userId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "JobPosting_recruiterId_idx" ON "JobPosting"("recruiterId");

-- CreateIndex
CREATE INDEX "MessageReference_messageId_idx" ON "MessageReference"("messageId");
