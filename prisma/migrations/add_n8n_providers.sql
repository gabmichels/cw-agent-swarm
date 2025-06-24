-- Add N8n provider types to IntegrationProvider table
-- Migration: Add N8n Providers (Phase 1 - N8n Execution Implementation)

-- Add N8n Cloud provider
INSERT INTO "IntegrationProvider" (
  "id",
  "name",
  "displayName",
  "category",
  "type",
  "description",
  "isActive",
  "requiresUserAuth",
  "oauthAuthUrl",
  "oauthTokenUrl", 
  "oauthScopes",
  "apiKeyName",
  "createdAt",
  "updatedAt"
) VALUES (
  '01JH1B2C3D4E5F6G7H8J9K',
  'n8n-cloud',
  'n8n Cloud',
  'EXTERNAL_WORKFLOW',
  'OAUTH_2',
  'n8n Cloud workflow automation platform',
  true,
  true,
  'https://app.n8n.cloud/oauth/authorize',
  'https://app.n8n.cloud/oauth/token',
  '["workflows:read", "workflows:write", "executions:read", "executions:write"]',
  null,
  datetime('now'),
  datetime('now')
);

-- Add N8n Self-Hosted provider  
INSERT INTO "IntegrationProvider" (
  "id",
  "name",
  "displayName", 
  "category",
  "type",
  "description",
  "isActive",
  "requiresUserAuth",
  "oauthAuthUrl",
  "oauthTokenUrl",
  "oauthScopes", 
  "apiKeyName",
  "apiKeyFormat",
  "createdAt",
  "updatedAt"
) VALUES (
  '01JH1B2C3D4E5F6G7H8J9L',
  'n8n-self-hosted',
  'n8n Self-Hosted',
  'EXTERNAL_WORKFLOW',
  'API_KEY',
  'Self-hosted n8n workflow automation platform',
  true,
  true,
  null,
  null,
  null,
  'API Key',
  'n8n_[a-zA-Z0-9]{32,}',
  datetime('now'),
  datetime('now')
); 