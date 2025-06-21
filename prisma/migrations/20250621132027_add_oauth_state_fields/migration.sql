-- AlterTable
ALTER TABLE "OAuthState" ADD COLUMN "accountType" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "codeVerifier" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "metadata" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "platform" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "returnUrl" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OAuthState" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "OAuthState_tenantId_idx" ON "OAuthState"("tenantId");

-- CreateIndex
CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");

-- CreateIndex
CREATE INDEX "OAuthState_platform_idx" ON "OAuthState"("platform");
