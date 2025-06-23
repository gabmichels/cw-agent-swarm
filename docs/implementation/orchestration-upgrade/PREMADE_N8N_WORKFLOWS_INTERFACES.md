# Premade N8N Workflows - TypeScript Interfaces

## 🎯 **Repository Integration Interfaces**

These interfaces define the TypeScript contracts for integrating the [Zie619/n8n-workflows repository](https://github.com/Zie619/n8n-workflows) and its sophisticated FastAPI server system.

---

## 📁 **Core Repository Types**

### **Repository Management**
```typescript
// File: src/types/external-workflows/repository.ts

interface RepositoryHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  lastCheck: Date;
  uptime: number;
  serverStatus: ServerStatus;
  databaseStatus: DatabaseStatus;
}

interface ServerStatus {
  isRunning: boolean;
  port: number;                // Default: 8001
  responseTime: number;        // Target: <100ms
  uptime: number;             // Seconds since start
  memoryUsage: string;        // "50MB"
  errorRate: number;          // 0-1 (0% to 100%)
  lastHealthCheck: Date;
}

interface DatabaseStatus {
  isConnected: boolean;
  recordCount: number;        // Should be 2,053
  indexHealth: 'good' | 'rebuilding' | 'corrupted';
  lastUpdate: Date;
  diskUsage: string;          // "50MB"
}

interface RepositoryStats {
  totalWorkflows: number;        // 2,053
  activeWorkflows: number;       // 215  
  totalNodes: number;           // 29,445
  uniqueIntegrations: number;   // 365
  categories: WorkflowCategory[];// 12 categories
  lastUpdated: Date;
  diskUsage: string;           // ~50MB
  searchIndexSize: string;     // SQLite FTS5 size
}
```

### **Workflow Search Types**
```typescript
// File: src/types/external-workflows/search.ts

interface WorkflowSearchQuery {
  q?: string;                    // "telegram automation"
  category?: WorkflowCategory;   // "messaging"
  trigger?: string;              // "Webhook"
  complexity?: WorkflowComplexity; // "high"
  integrations?: string[];       // ["telegram", "google-sheets"]
  minNodes?: number;             // Minimum complexity
  maxNodes?: number;             // Maximum complexity
  active?: boolean;              // Only active workflows
  limit?: number;                // Results per page (default: 20)
  offset?: number;               // Pagination
  sortBy?: 'name' | 'popularity' | 'complexity' | 'recent';
  sortOrder?: 'asc' | 'desc';
}

interface WorkflowSearchResult {
  workflows: N8nWorkflowTemplate[];
  total: number;
  categories: CategoryCount[];
  integrations: IntegrationCount[];
  searchTime: number;            // Response time in ms
  suggestions: string[];         // "Did you mean" suggestions
  filters: SearchFilters;        // Available filter options
}

interface CategoryCount {
  category: WorkflowCategory;
  count: number;
  percentage: number;            // % of total workflows
}

interface IntegrationCount {
  integration: string;           // "telegram"
  count: number;
  category: WorkflowCategory;
  popularity: number;            // 0-1 popularity score
}

interface SearchFilters {
  availableCategories: WorkflowCategory[];
  availableTriggers: string[];
  availableComplexities: WorkflowComplexity[];
  nodeCountRange: {
    min: number;
    max: number;
  };
  integrationOptions: string[];
}
```

### **Enhanced Workflow Template**
```typescript
// File: src/types/external-workflows/template.ts

interface N8nWorkflowTemplate {
  // Repository Metadata (from their SQLite database)
  id: string;                    // Our ULID
  filename: string;              // "2051_Telegram_Webhook_Automation_Webhook.json"
  name: string;                  // "Telegram Webhook Automation" (smart naming)
  description: string;           // AI-generated or manual description
  category: WorkflowCategory;    // "messaging"
  complexity: WorkflowComplexity; // "medium"
  
  // Workflow Analysis (from their analysis)
  nodeCount: number;             // 12
  triggerType: string;           // "Webhook"
  integrations: string[];        // ["telegram", "webhook", "http-request"]
  tags: string[];               // Auto-generated tags
  active: boolean;              // Whether workflow is currently active
  
  // Repository URLs and Access
  downloadUrl: string;          // "http://localhost:8001/api/workflows/{filename}/download"
  diagramUrl?: string;          // Mermaid diagram URL if available
  repositoryPath: string;       // "workflows/messaging/telegram_webhook.json"
  
  // Timestamps
  createdAt?: Date;             // Repository file creation
  updatedAt?: Date;             // Last modification
  lastAnalyzed: Date;           // When metadata was last analyzed
  
  // Import Metadata (when imported)
  importedAt?: Date;
  importedBy?: string;          // User ID
  agentAssignments?: string[];  // Agent IDs this workflow is assigned to
}

interface WorkflowDetails extends N8nWorkflowTemplate {
  // Extended details from repository API
  documentation?: string;        // Usage instructions
  prerequisites: string[];       // Required credentials/setup
  estimatedSetupTime: number;    // Minutes
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  
  // Workflow JSON Analysis
  nodeTypes: string[];          // ["Telegram", "Webhook", "HTTP Request"]
  requiredCredentials: string[]; // ["telegramApi", "webhookAuth"]
  configurableParameters: WorkflowParameter[];
  
  // Community Data (if available)
  usageCount?: number;          // How many times downloaded
  rating?: number;              // 0-5 stars
  reviews?: WorkflowReview[];
}

interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'credential';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;           // Regex pattern
    min?: number;              // Min value/length
    max?: number;              // Max value/length
    options?: string[];        // Enum options
  };
}

interface WorkflowReview {
  id: string;
  userId: string;
  rating: number;               // 1-5 stars
  comment: string;
  helpful: number;              // Helpful votes
  createdAt: Date;
}

// Core category types from repository
type WorkflowCategory = 
  | 'messaging'          // Telegram, Discord, Slack, WhatsApp
  | 'ai_ml'             // OpenAI, Anthropic, Hugging Face
  | 'database'          // PostgreSQL, MySQL, MongoDB, Airtable
  | 'email'             // Gmail, Mailjet, Outlook, SMTP
  | 'cloud_storage'     // Google Drive, Dropbox, OneDrive
  | 'project_management' // Jira, GitHub, GitLab, Trello
  | 'social_media'      // LinkedIn, Twitter, Facebook, Instagram
  | 'ecommerce'         // Shopify, Stripe, PayPal
  | 'analytics'         // Google Analytics, Mixpanel
  | 'calendar_tasks'    // Google Calendar, Cal.com, Calendly
  | 'forms'             // Typeform, Google Forms
  | 'development';      // Webhook, HTTP Request, GraphQL

type WorkflowComplexity = 'simple' | 'medium' | 'high';
```

---

## 🔍 **Search & Discovery Interfaces**

### **Recommendation Engine**
```typescript
// File: src/types/external-workflows/recommendations.ts

interface WorkflowRecommendation {
  workflow: N8nWorkflowTemplate;
  confidence: number;           // 0-1 confidence score
  reason: string;              // Human-readable explanation
  matchedIntegrations: string[]; // Services that matched user intent
  estimatedSetupTime: number;   // Minutes
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  priority: 'high' | 'medium' | 'low';
}

interface RecommendationOptions {
  userMessage: string;          // Original user input
  agentId?: string;            // Context agent
  agentContext?: AgentContext;  // Agent specialization
  userHistory?: UserWorkflowHistory;
  maxRecommendations?: number;  // Default: 10
  minConfidence?: number;       // Default: 0.3
  preferredComplexity?: WorkflowComplexity;
  excludeCategories?: WorkflowCategory[];
}

interface AgentContext {
  agentId: string;
  specialization: string[];     // ["email", "marketing", "automation"]
  existingIntegrations: string[]; // Services already configured
  workflowHistory: string[];    // Previously used workflow IDs
  userPreferences: UserPreferences;
}

interface UserWorkflowHistory {
  recentSearches: string[];
  importedWorkflows: string[];
  favoriteCategories: WorkflowCategory[];
  rejectedRecommendations: string[];
  successfulExecutions: string[];
}

interface UserPreferences {
  preferredComplexity: WorkflowComplexity;
  favoriteIntegrations: string[];
  preferredTriggerTypes: string[];
  autoImportConfidence: number; // Auto-import above this confidence
}
```

### **Intent Analysis**
```typescript
// File: src/types/external-workflows/intent.ts

interface Intent {
  action: string;               // "send_email", "post_social_media"
  entities: Entity[];
  confidence: number;           // 0-1
  category: WorkflowCategory;   // Predicted category
  urgency: 'low' | 'medium' | 'high';
}

interface Entity {
  type: 'service' | 'action' | 'object' | 'time' | 'person';
  value: string;               // "gmail", "telegram", "daily"
  confidence: number;          // 0-1
  synonyms: string[];          // Alternative names
}

interface IntentAnalysisResult {
  originalMessage: string;
  intent: Intent;
  suggestedQueries: string[];   // Search queries to try
  searchFilters: Partial<WorkflowSearchQuery>;
  contextualHints: string[];    // Additional context for search
}
```

---

## 📥 **Import & Customization Interfaces**

### **Workflow Import**
```typescript
// File: src/types/external-workflows/import.ts

interface WorkflowImportRequest {
  workflowId: string;           // N8nWorkflowTemplate.id
  agentId: string;             // Target agent
  customizations: WorkflowCustomizations;
  options: ImportOptions;
}

interface WorkflowCustomizations {
  name?: string;                // Custom workflow name
  description?: string;         // Custom description
  nlpTriggers: string[];       // ["send telegram message", "notify via telegram"]
  parameters: Record<string, any>; // Parameter overrides
  scheduling?: ScheduleConfig;
  notifications: NotificationConfig;
  tags: string[];              // User-defined tags
}

interface ImportOptions {
  validateCredentials: boolean; // Check if required credentials exist
  testExecution: boolean;       // Run test execution after import
  createBackup: boolean;        // Backup existing workflows before import
  conflictResolution: 'skip' | 'overwrite' | 'rename'; // Handle naming conflicts
  autoActivate: boolean;        // Activate workflow after import
}

interface WorkflowImportResult {
  success: boolean;
  workflowId: string;          // Imported workflow ID
  agentId: string;             // Agent ID
  errors: ImportError[];
  warnings: ImportWarning[];
  executionResult?: TestExecutionResult;
  backupId?: string;           // If backup was created
  
  // Import statistics
  importTime: number;          // Milliseconds
  nodesImported: number;
  credentialsRequired: string[];
  parametersConfigured: number;
}

interface ImportError {
  code: string;                // "MISSING_CREDENTIAL", "INVALID_PARAMETER"
  message: string;
  field?: string;              // Parameter or field name
  severity: 'error' | 'warning';
  resolution?: string;         // Suggested fix
}

interface ImportWarning {
  code: string;
  message: string;
  impact: 'low' | 'medium' | 'high';
  recommendation?: string;
}

interface TestExecutionResult {
  success: boolean;
  executionTime: number;       // Milliseconds
  errors: string[];
  output?: any;               // Execution output
  nodeResults: NodeExecutionResult[];
}

interface NodeExecutionResult {
  nodeName: string;
  success: boolean;
  executionTime: number;
  error?: string;
  output?: any;
}
```

### **Scheduling & Notifications**
```typescript
// File: src/types/external-workflows/scheduling.ts

interface ScheduleConfig {
  type: 'cron' | 'interval' | 'webhook' | 'manual';
  expression?: string;          // Cron expression or interval
  timezone?: string;           // "America/New_York"
  enabled: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
}

interface NotificationConfig {
  onSuccess: boolean;
  onFailure: boolean;
  onLongRunning: boolean;      // If execution takes >5 minutes
  channels: NotificationChannel[];
  customMessages?: {
    success?: string;
    failure?: string;
    longRunning?: string;
  };
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'discord' | 'webhook';
  destination: string;         // Email, channel ID, webhook URL
  enabled: boolean;
  filterLevel: 'all' | 'errors_only' | 'critical_only';
}
```

---

## 📊 **Analytics & Monitoring Interfaces**

### **Usage Analytics**
```typescript
// File: src/types/external-workflows/analytics.ts

interface WorkflowAnalytics {
  workflowId: string;
  totalViews: number;
  totalImports: number;
  totalExecutions: number;
  successRate: number;         // 0-1
  averageExecutionTime: number; // Milliseconds
  popularityScore: number;     // Calculated metric
  
  // Time-based metrics
  viewsThisWeek: number;
  importsThisWeek: number;
  executionsThisWeek: number;
  
  // User feedback
  averageRating?: number;      // 0-5 stars
  totalReviews: number;
  
  // Performance metrics
  errorRate: number;           // 0-1
  retryRate: number;          // 0-1
  timeouts: number;           // Count of timeouts
}

interface SearchAnalytics {
  totalSearches: number;
  averageResponseTime: number; // Milliseconds
  popularQueries: QueryAnalytics[];
  noResultQueries: string[];   // Queries that returned no results
  categoryBreakdown: CategorySearchStats[];
  
  // User behavior
  searchToImportRate: number;  // % of searches that result in imports
  averageResultsViewed: number;
  abandonmentRate: number;     // % of searches with no clicks
}

interface QueryAnalytics {
  query: string;
  count: number;
  averageResults: number;
  clickThroughRate: number;    // % of searches that get clicks
  importRate: number;          // % that result in imports
}

interface CategorySearchStats {
  category: WorkflowCategory;
  searchCount: number;
  viewCount: number;
  importCount: number;
  averageRating: number;
}

interface UsageMetrics {
  timeframe: TimeFrame;
  totalUsers: number;
  activeUsers: number;         // Users who imported/executed workflows
  newUsers: number;
  returningUsers: number;
  
  // Workflow metrics
  workflowsImported: number;
  workflowsExecuted: number;
  successfulExecutions: number;
  failedExecutions: number;
  
  // Performance metrics
  averageImportTime: number;   // Seconds
  averageSearchTime: number;   // Milliseconds
  systemUptime: number;        // %
}

interface TimeFrame {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}
```

### **Performance Monitoring**
```typescript
// File: src/types/external-workflows/monitoring.ts

interface PerformanceMetrics {
  searchLatency: LatencyMetrics;
  importLatency: LatencyMetrics;
  repositorySync: SyncMetrics;
  serverHealth: ServerHealthMetrics;
  databaseHealth: DatabaseHealthMetrics;
}

interface LatencyMetrics {
  p50: number;                 // 50th percentile (milliseconds)
  p95: number;                 // 95th percentile
  p99: number;                 // 99th percentile
  average: number;
  max: number;
  min: number;
  samples: number;             // Number of measurements
}

interface SyncMetrics {
  lastSyncTime: Date;
  syncDuration: number;        // Milliseconds
  workflowsAdded: number;
  workflowsUpdated: number;
  workflowsRemoved: number;
  syncErrors: string[];
  nextScheduledSync: Date;
}

interface ServerHealthMetrics {
  cpuUsage: number;            // 0-100%
  memoryUsage: number;         // 0-100%
  diskUsage: number;           // 0-100%
  networkLatency: number;      // Milliseconds
  errorRate: number;           // Errors per minute
  uptime: number;              // Seconds
}

interface DatabaseHealthMetrics {
  queryLatency: LatencyMetrics;
  indexHealth: 'good' | 'rebuilding' | 'corrupted';
  recordCount: number;
  databaseSize: string;        // "50MB"
  lastOptimization: Date;
  fragmentationLevel: number;   // 0-100%
}
```

---

## 🔧 **Service Interfaces**

### **Repository Service Contracts**
```typescript
// File: src/types/external-workflows/services.ts

interface IN8nWorkflowRepositoryService {
  // Repository Management
  cloneRepository(): Promise<void>;
  updateRepository(): Promise<boolean>;
  checkRepositoryHealth(): Promise<RepositoryHealth>;
  
  // Server Management  
  startWorkflowServer(): Promise<ServerStatus>;
  stopWorkflowServer(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  restartServer(): Promise<ServerStatus>;
  
  // Repository Statistics
  getRepositoryStats(): Promise<RepositoryStats>;
  getCategoryBreakdown(): Promise<CategoryCount[]>;
  getIntegrationCounts(): Promise<IntegrationCount[]>;
}

interface IWorkflowSearchService {
  // Search Operations
  searchWorkflows(query: WorkflowSearchQuery): Promise<WorkflowSearchResult>;
  getWorkflowsByCategory(category: WorkflowCategory): Promise<N8nWorkflowTemplate[]>;
  getWorkflowDetails(filename: string): Promise<WorkflowDetails>;
  
  // Browse Operations
  getAllCategories(): Promise<WorkflowCategory[]>;
  getPopularWorkflows(limit?: number): Promise<N8nWorkflowTemplate[]>;
  getRecentWorkflows(limit?: number): Promise<N8nWorkflowTemplate[]>;
  
  // Advanced Discovery
  findSimilarWorkflows(workflowId: string): Promise<N8nWorkflowTemplate[]>;
  getWorkflowsByIntegration(service: string): Promise<N8nWorkflowTemplate[]>;
  getWorkflowsByComplexity(complexity: WorkflowComplexity): Promise<N8nWorkflowTemplate[]>;
}

interface IWorkflowRecommendationEngine {
  // Intent-Based Recommendations
  getRecommendationsByIntent(userMessage: string): Promise<WorkflowRecommendation[]>;
  getRecommendationsByAgent(agentId: string): Promise<WorkflowRecommendation[]>;
  getRecommendationsByContext(context: AgentContext): Promise<WorkflowRecommendation[]>;
  
  // Similarity Recommendations
  findSimilarWorkflows(workflowId: string): Promise<WorkflowRecommendation[]>;
  getPopularInCategory(category: WorkflowCategory): Promise<WorkflowRecommendation[]>;
  
  // Learning & Analytics
  recordWorkflowUsage(workflowId: string, agentId: string, outcome: UsageOutcome): Promise<void>;
  getUsageAnalytics(timeframe?: TimeFrame): Promise<UsageAnalytics>;
}

interface IWorkflowImportService {
  // Import Operations
  importWorkflow(request: WorkflowImportRequest): Promise<WorkflowImportResult>;
  validateWorkflow(workflowId: string): Promise<ValidationResult>;
  previewImport(workflowId: string, customizations: WorkflowCustomizations): Promise<ImportPreview>;
  
  // Batch Operations
  importMultipleWorkflows(requests: WorkflowImportRequest[]): Promise<WorkflowImportResult[]>;
  
  // Management
  getImportHistory(agentId?: string): Promise<ImportHistoryEntry[]>;
  rollbackImport(importId: string): Promise<RollbackResult>;
}

interface UsageOutcome {
  outcome: 'accepted' | 'rejected' | 'imported' | 'executed_success' | 'executed_failure';
  metadata?: Record<string, any>;
  feedback?: string;
  timestamp: Date;
}

interface ValidationResult {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  requiredCredentials: string[];
  estimatedComplexity: WorkflowComplexity;
  estimatedSetupTime: number;
}

interface ImportPreview {
  workflow: N8nWorkflowTemplate;
  customizations: WorkflowCustomizations;
  requiredSetup: SetupStep[];
  estimatedTime: number;
  potentialIssues: ImportWarning[];
  preview: WorkflowPreviewData;
}

interface SetupStep {
  step: number;
  title: string;
  description: string;
  type: 'credential' | 'parameter' | 'webhook' | 'test';
  required: boolean;
  estimatedTime: number;       // Minutes
}

interface WorkflowPreviewData {
  nodeCount: number;
  triggerTypes: string[];
  integrations: string[];
  dataFlow: NodeConnection[];
  securityConsiderations: string[];
}

interface NodeConnection {
  from: string;                // Node name
  to: string;                  // Node name
  dataType: string;           // "json", "binary", "text"
}

interface ImportHistoryEntry {
  importId: string;
  workflowId: string;
  workflowName: string;
  agentId: string;
  importedAt: Date;
  status: 'success' | 'partial' | 'failed';
  customizations: WorkflowCustomizations;
}

interface RollbackResult {
  success: boolean;
  rollbackId: string;
  itemsRolledBack: string[];
  errors: string[];
}
```

---

These interfaces provide **complete type safety** for integrating the sophisticated n8n workflow repository system, enabling our platform to leverage their FastAPI server, SQLite database, and professional workflow categorization while maintaining strict TypeScript compliance and our ULID-based architecture. 