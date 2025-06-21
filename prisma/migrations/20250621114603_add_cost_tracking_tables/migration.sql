-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "budgetLimit" REAL,
    "currentSpent" REAL DEFAULT 0,
    "currency" TEXT DEFAULT 'USD',
    "costCenterId" TEXT,
    "managerId" TEXT,
    "parentDepartmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialMediaProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialMediaConnectionStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialMediaCapability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialMediaConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountDisplayName" TEXT NOT NULL,
    "accountUsername" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "metadata" TEXT,
    "lastValidated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentSocialMediaPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "socialMediaConnectionId" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "restrictions" TEXT,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentSocialMediaPermission_socialMediaConnectionId_fkey" FOREIGN KEY ("socialMediaConnectionId") REFERENCES "SocialMediaConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialMediaAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialMediaConnectionId" TEXT NOT NULL,
    "agentId" TEXT,
    "action" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT,
    "result" TEXT NOT NULL,
    "error" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialMediaAuditLog_socialMediaConnectionId_fkey" FOREIGN KEY ("socialMediaConnectionId") REFERENCES "SocialMediaConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "costUsd" REAL NOT NULL,
    "unitsConsumed" INTEGER NOT NULL,
    "unitType" TEXT NOT NULL,
    "costPerUnit" REAL NOT NULL,
    "tier" TEXT NOT NULL,
    "initiatedByType" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "initiatedByName" TEXT,
    "sessionId" TEXT,
    "toolParameters" TEXT,
    "executionDetails" TEXT,
    "researchContext" TEXT,
    "workflowContext" TEXT,
    "departmentId" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "budgetUsd" REAL NOT NULL,
    "spentUsd" REAL NOT NULL DEFAULT 0,
    "remainingUsd" REAL NOT NULL,
    "utilizationPercent" REAL NOT NULL DEFAULT 0,
    "categories" TEXT NOT NULL,
    "services" TEXT,
    "departmentId" TEXT,
    "warningThreshold" REAL NOT NULL DEFAULT 75,
    "criticalThreshold" REAL NOT NULL DEFAULT 90,
    "maximumThreshold" REAL NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "onWarningAction" TEXT,
    "onCriticalAction" TEXT,
    "onMaximumAction" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "categories" TEXT,
    "services" TEXT,
    "costThresholdUsd" REAL,
    "percentageIncrease" REAL,
    "timeWindow" TEXT,
    "minOperations" INTEGER,
    "severity" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "emailNotifications" TEXT,
    "slackNotifications" TEXT,
    "webhookNotifications" TEXT,
    "lastTriggered" DATETIME,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ToolCostConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricingModel" TEXT NOT NULL,
    "fixedCostUsd" REAL,
    "variableCostPerUnit" REAL,
    "unitType" TEXT,
    "tieredPricing" TEXT,
    "freeTierUnits" INTEGER,
    "freeTierPeriod" TEXT,
    "freeTierResetDay" INTEGER,
    "estimationFactors" TEXT,
    "baseMultiplier" REAL NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalWorkflowCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "costPerExecution" REAL NOT NULL,
    "monthlySubscriptionCost" REAL,
    "executionsPerMonth" INTEGER,
    "dataTransferMBLimit" INTEGER,
    "computeMinutesLimit" INTEGER,
    "executionsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "dataTransferMBUsed" INTEGER NOT NULL DEFAULT 0,
    "computeMinutesUsed" INTEGER NOT NULL DEFAULT 0,
    "subscriptionCost" REAL NOT NULL DEFAULT 0,
    "executionCosts" REAL NOT NULL DEFAULT 0,
    "overageCosts" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "lastResetDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostOptimization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "potentialSavingsUsd" REAL NOT NULL,
    "effort" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedTo" TEXT,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "analysisStartDate" DATETIME NOT NULL,
    "analysisEndDate" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostForecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forecastPeriodStart" DATETIME NOT NULL,
    "forecastPeriodEnd" DATETIME NOT NULL,
    "predictions" TEXT NOT NULL,
    "totalPredictedCost" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "accuracy" REAL,
    "factors" TEXT NOT NULL,
    "basedOnPeriodStart" DATETIME NOT NULL,
    "basedOnPeriodEnd" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_name_idx" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE INDEX "Department_parentDepartmentId_idx" ON "Department"("parentDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaProvider_name_key" ON "SocialMediaProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaConnectionStatus_name_key" ON "SocialMediaConnectionStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaCapability_name_key" ON "SocialMediaCapability"("name");

-- CreateIndex
CREATE INDEX "SocialMediaConnection_userId_idx" ON "SocialMediaConnection"("userId");

-- CreateIndex
CREATE INDEX "SocialMediaConnection_organizationId_idx" ON "SocialMediaConnection"("organizationId");

-- CreateIndex
CREATE INDEX "SocialMediaConnection_provider_idx" ON "SocialMediaConnection"("provider");

-- CreateIndex
CREATE INDEX "SocialMediaConnection_providerAccountId_idx" ON "SocialMediaConnection"("providerAccountId");

-- CreateIndex
CREATE INDEX "SocialMediaConnection_connectionStatus_idx" ON "SocialMediaConnection"("connectionStatus");

-- CreateIndex
CREATE INDEX "AgentSocialMediaPermission_agentId_idx" ON "AgentSocialMediaPermission"("agentId");

-- CreateIndex
CREATE INDEX "AgentSocialMediaPermission_socialMediaConnectionId_idx" ON "AgentSocialMediaPermission"("socialMediaConnectionId");

-- CreateIndex
CREATE INDEX "AgentSocialMediaPermission_accessLevel_idx" ON "AgentSocialMediaPermission"("accessLevel");

-- CreateIndex
CREATE INDEX "AgentSocialMediaPermission_isActive_idx" ON "AgentSocialMediaPermission"("isActive");

-- CreateIndex
CREATE INDEX "SocialMediaAuditLog_socialMediaConnectionId_idx" ON "SocialMediaAuditLog"("socialMediaConnectionId");

-- CreateIndex
CREATE INDEX "SocialMediaAuditLog_agentId_idx" ON "SocialMediaAuditLog"("agentId");

-- CreateIndex
CREATE INDEX "SocialMediaAuditLog_action_idx" ON "SocialMediaAuditLog"("action");

-- CreateIndex
CREATE INDEX "SocialMediaAuditLog_platform_idx" ON "SocialMediaAuditLog"("platform");

-- CreateIndex
CREATE INDEX "SocialMediaAuditLog_timestamp_idx" ON "SocialMediaAuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_state_idx" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "CostEntry_timestamp_idx" ON "CostEntry"("timestamp");

-- CreateIndex
CREATE INDEX "CostEntry_category_idx" ON "CostEntry"("category");

-- CreateIndex
CREATE INDEX "CostEntry_service_idx" ON "CostEntry"("service");

-- CreateIndex
CREATE INDEX "CostEntry_initiatedByType_initiatedById_idx" ON "CostEntry"("initiatedByType", "initiatedById");

-- CreateIndex
CREATE INDEX "CostEntry_sessionId_idx" ON "CostEntry"("sessionId");

-- CreateIndex
CREATE INDEX "CostEntry_departmentId_idx" ON "CostEntry"("departmentId");

-- CreateIndex
CREATE INDEX "CostEntry_tier_idx" ON "CostEntry"("tier");

-- CreateIndex
CREATE INDEX "CostBudget_period_idx" ON "CostBudget"("period");

-- CreateIndex
CREATE INDEX "CostBudget_status_idx" ON "CostBudget"("status");

-- CreateIndex
CREATE INDEX "CostBudget_departmentId_idx" ON "CostBudget"("departmentId");

-- CreateIndex
CREATE INDEX "CostBudget_validFrom_validTo_idx" ON "CostBudget"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "CostAlert_type_idx" ON "CostAlert"("type");

-- CreateIndex
CREATE INDEX "CostAlert_severity_idx" ON "CostAlert"("severity");

-- CreateIndex
CREATE INDEX "CostAlert_enabled_idx" ON "CostAlert"("enabled");

-- CreateIndex
CREATE INDEX "CostAlert_lastTriggered_idx" ON "CostAlert"("lastTriggered");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCostConfig_toolId_key" ON "ToolCostConfig"("toolId");

-- CreateIndex
CREATE INDEX "ToolCostConfig_toolId_idx" ON "ToolCostConfig"("toolId");

-- CreateIndex
CREATE INDEX "ToolCostConfig_category_idx" ON "ToolCostConfig"("category");

-- CreateIndex
CREATE INDEX "ToolCostConfig_enabled_idx" ON "ToolCostConfig"("enabled");

-- CreateIndex
CREATE INDEX "ExternalWorkflowCost_platform_idx" ON "ExternalWorkflowCost"("platform");

-- CreateIndex
CREATE INDEX "ExternalWorkflowCost_enabled_idx" ON "ExternalWorkflowCost"("enabled");

-- CreateIndex
CREATE INDEX "ExternalWorkflowCost_lastResetDate_idx" ON "ExternalWorkflowCost"("lastResetDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalWorkflowCost_platform_workflowId_key" ON "ExternalWorkflowCost"("platform", "workflowId");

-- CreateIndex
CREATE INDEX "CostOptimization_category_idx" ON "CostOptimization"("category");

-- CreateIndex
CREATE INDEX "CostOptimization_service_idx" ON "CostOptimization"("service");

-- CreateIndex
CREATE INDEX "CostOptimization_status_idx" ON "CostOptimization"("status");

-- CreateIndex
CREATE INDEX "CostOptimization_priority_idx" ON "CostOptimization"("priority");

-- CreateIndex
CREATE INDEX "CostOptimization_potentialSavingsUsd_idx" ON "CostOptimization"("potentialSavingsUsd");

-- CreateIndex
CREATE INDEX "CostForecast_forecastPeriodStart_forecastPeriodEnd_idx" ON "CostForecast"("forecastPeriodStart", "forecastPeriodEnd");

-- CreateIndex
CREATE INDEX "CostForecast_totalPredictedCost_idx" ON "CostForecast"("totalPredictedCost");

-- CreateIndex
CREATE INDEX "CostForecast_confidence_idx" ON "CostForecast"("confidence");
