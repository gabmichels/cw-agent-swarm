/*
  Warnings:

  - You are about to drop the column `title` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `fileId` on the `ChatAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `ChatAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `ChatAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `ChatAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `storageUrl` on the `ChatAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ChatAttachment` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "WorkspaceProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceAccountType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConnectionType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConnectionStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceCapabilityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AccessLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceEventType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationPriority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scopes" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentWorkspacePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "workspaceConnectionId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "restrictions" TEXT,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentWorkspacePermission_workspaceConnectionId_fkey" FOREIGN KEY ("workspaceConnectionId") REFERENCES "WorkspaceConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkspaceCapability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceConnectionId" TEXT NOT NULL,
    "capabilityType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "configuration" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceConnectionId" TEXT NOT NULL,
    "agentId" TEXT,
    "action" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceAuditLog_workspaceConnectionId_fkey" FOREIGN KEY ("workspaceConnectionId") REFERENCES "WorkspaceConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "failedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    CONSTRAINT "AgentNotification_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WorkspaceConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Chat" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "Chat";
DROP TABLE "Chat";
ALTER TABLE "new_Chat" RENAME TO "Chat";
CREATE TABLE "new_ChatAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'file',
    "url" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChatAttachment" ("chatId", "createdAt", "id") SELECT "chatId", "createdAt", "id" FROM "ChatAttachment";
DROP TABLE "ChatAttachment";
ALTER TABLE "new_ChatAttachment" RENAME TO "ChatAttachment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProvider_name_key" ON "WorkspaceProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceAccountType_name_key" ON "WorkspaceAccountType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionType_name_key" ON "ConnectionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionStatus_name_key" ON "ConnectionStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCapabilityType_name_key" ON "WorkspaceCapabilityType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessLevel_name_key" ON "AccessLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceAction_name_key" ON "WorkspaceAction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ActionResult_name_key" ON "ActionResult"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEventType_name_key" ON "WorkspaceEventType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPriority_name_key" ON "NotificationPriority"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationStatus_name_key" ON "NotificationStatus"("name");

-- CreateIndex
CREATE INDEX "WorkspaceConnection_userId_idx" ON "WorkspaceConnection"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceConnection_organizationId_idx" ON "WorkspaceConnection"("organizationId");

-- CreateIndex
CREATE INDEX "WorkspaceConnection_provider_idx" ON "WorkspaceConnection"("provider");

-- CreateIndex
CREATE INDEX "WorkspaceConnection_email_idx" ON "WorkspaceConnection"("email");

-- CreateIndex
CREATE INDEX "WorkspaceConnection_status_idx" ON "WorkspaceConnection"("status");

-- CreateIndex
CREATE INDEX "AgentWorkspacePermission_agentId_idx" ON "AgentWorkspacePermission"("agentId");

-- CreateIndex
CREATE INDEX "AgentWorkspacePermission_workspaceConnectionId_idx" ON "AgentWorkspacePermission"("workspaceConnectionId");

-- CreateIndex
CREATE INDEX "AgentWorkspacePermission_capability_idx" ON "AgentWorkspacePermission"("capability");

-- CreateIndex
CREATE INDEX "AgentWorkspacePermission_accessLevel_idx" ON "AgentWorkspacePermission"("accessLevel");

-- CreateIndex
CREATE INDEX "WorkspaceCapability_workspaceConnectionId_idx" ON "WorkspaceCapability"("workspaceConnectionId");

-- CreateIndex
CREATE INDEX "WorkspaceCapability_capabilityType_idx" ON "WorkspaceCapability"("capabilityType");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_workspaceConnectionId_idx" ON "WorkspaceAuditLog"("workspaceConnectionId");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_agentId_idx" ON "WorkspaceAuditLog"("agentId");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_action_idx" ON "WorkspaceAuditLog"("action");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_timestamp_idx" ON "WorkspaceAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AgentNotification_agentId_idx" ON "AgentNotification"("agentId");

-- CreateIndex
CREATE INDEX "AgentNotification_connectionId_idx" ON "AgentNotification"("connectionId");

-- CreateIndex
CREATE INDEX "AgentNotification_eventType_idx" ON "AgentNotification"("eventType");

-- CreateIndex
CREATE INDEX "AgentNotification_status_idx" ON "AgentNotification"("status");

-- CreateIndex
CREATE INDEX "AgentNotification_createdAt_idx" ON "AgentNotification"("createdAt");
