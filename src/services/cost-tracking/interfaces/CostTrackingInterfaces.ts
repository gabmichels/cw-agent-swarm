import { StructuredId } from '../../../utils/ulid';

/**
 * Cost tracking categories
 */
export enum CostCategory {
  // Tool-related costs
  APIFY_TOOLS = 'apify_tools',
  WEB_SCRAPING = 'web_scraping',
  SOCIAL_MEDIA_TOOLS = 'social_media_tools',
  DATA_PROCESSING = 'data_processing',
  
  // External workflow costs
  N8N_WORKFLOWS = 'n8n_workflows',
  ZAPIER_WORKFLOWS = 'zapier_workflows',
  MAKE_WORKFLOWS = 'make_workflows',
  
  // Internal API costs
  OPENAI_API = 'openai_api',
  ANTHROPIC_API = 'anthropic_api',
  GOOGLE_AI_API = 'google_ai_api',
  
  // Research-specific costs
  DEEP_RESEARCH = 'deep_research',
  KNOWLEDGE_EXTRACTION = 'knowledge_extraction',
  
  // Infrastructure costs
  VECTOR_DATABASE = 'vector_database',
  STORAGE = 'storage',
  COMPUTE = 'compute',
  
  // Custom/Other
  CUSTOM = 'custom'
}

/**
 * Cost measurement units
 */
export enum CostUnit {
  // API calls
  API_CALLS = 'api_calls',
  REQUESTS = 'requests',
  
  // Data processing
  RESULTS_PROCESSED = 'results_processed',
  PAGES_SCRAPED = 'pages_scraped',
  RECORDS_EXTRACTED = 'records_extracted',
  
  // AI/LLM usage
  TOKENS = 'tokens',
  INPUT_TOKENS = 'input_tokens',
  OUTPUT_TOKENS = 'output_tokens',
  
  // Time-based
  EXECUTION_TIME_MS = 'execution_time_ms',
  COMPUTE_MINUTES = 'compute_minutes',
  
  // Storage
  STORAGE_MB = 'storage_mb',
  STORAGE_GB = 'storage_gb',
  
  // Workflow executions
  WORKFLOW_RUNS = 'workflow_runs',
  STEP_EXECUTIONS = 'step_executions',
  
  // Custom units
  CUSTOM_UNITS = 'custom_units'
}

/**
 * Cost tier for budgeting and alerts
 */
export enum CostTier {
  FREE = 'free',
  LOW = 'low',        // $0.01 - $1.00
  MEDIUM = 'medium',  // $1.01 - $10.00
  HIGH = 'high',      // $10.01 - $100.00
  PREMIUM = 'premium' // $100.01+
}

/**
 * Individual cost entry for a single operation
 */
export interface CostEntry {
  /** Unique identifier for this cost entry */
  id: StructuredId;
  
  /** When this cost was incurred */
  timestamp: Date;
  
  /** Category of cost */
  category: CostCategory;
  
  /** Specific service/tool that incurred the cost */
  service: string;
  
  /** Operation that caused the cost */
  operation: string;
  
  /** Actual cost amount in USD */
  costUsd: number;
  
  /** Number of units consumed */
  unitsConsumed: number;
  
  /** Type of units */
  unitType: CostUnit;
  
  /** Cost per unit */
  costPerUnit: number;
  
  /** Cost tier classification */
  tier: CostTier;
  
  /** Agent or user that triggered this cost */
  initiatedBy: {
    type: 'agent' | 'user' | 'system';
    id: string;
    name?: string;
  };
  
  /** Session or workflow this cost belongs to */
  sessionId?: string;
  
  /** Additional context */
  metadata: {
    /** Tool-specific parameters */
    toolParameters?: Record<string, unknown>;
    
    /** Execution details */
    executionDetails?: {
      duration: number;
      success: boolean;
      retries?: number;
    };
    
    /** Research context if applicable */
    researchContext?: {
      researchSessionId: string;
      researchPhase: string;
      queryType: string;
    };
    
    /** Workflow context if applicable */
    workflowContext?: {
      workflowId: string;
      stepId: string;
      platform: string;
    };
    
    /** Department/team attribution */
    departmentId?: string;
    
    /** Custom tags */
    tags?: string[];
  };
}

/**
 * Aggregated cost summary
 */
export interface CostSummary {
  /** Total cost in USD */
  totalCostUsd: number;
  
  /** Cost breakdown by category */
  byCategory: Record<CostCategory, number>;
  
  /** Cost breakdown by service */
  byService: Record<string, number>;
  
  /** Cost breakdown by tier */
  byTier: Record<CostTier, number>;
  
  /** Cost breakdown by initiator */
  byInitiator: Record<string, {
    totalCost: number;
    operationCount: number;
    averageCost: number;
  }>;
  
  /** Time period this summary covers */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Number of operations */
  totalOperations: number;
  
  /** Average cost per operation */
  averageCostPerOperation: number;
  
  /** Top cost drivers */
  topCostDrivers: Array<{
    service: string;
    operation: string;
    cost: number;
    percentage: number;
  }>;
}

/**
 * Cost budget and limits
 */
export interface CostBudget {
  /** Budget identifier */
  id: StructuredId;
  
  /** Budget name */
  name: string;
  
  /** Budget period */
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  
  /** Budget amount in USD */
  budgetUsd: number;
  
  /** Current spent amount */
  spentUsd: number;
  
  /** Remaining budget */
  remainingUsd: number;
  
  /** Budget utilization percentage */
  utilizationPercent: number;
  
  /** Categories this budget applies to */
  categories: CostCategory[];
  
  /** Services this budget applies to */
  services?: string[];
  
  /** Department this budget applies to */
  departmentId?: string;
  
  /** Alert thresholds */
  alertThresholds: {
    warning: number;    // Percentage (e.g., 75)
    critical: number;   // Percentage (e.g., 90)
    maximum: number;    // Percentage (e.g., 100)
  };
  
  /** Budget status */
  status: 'active' | 'exceeded' | 'suspended';
  
  /** Auto-actions when limits are hit */
  autoActions: {
    onWarning?: 'notify' | 'throttle';
    onCritical?: 'notify' | 'throttle' | 'suspend';
    onMaximum?: 'notify' | 'suspend' | 'block';
  };
  
  /** Validity period */
  validFrom: Date;
  validTo: Date;
  
  /** Created/updated timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cost alert configuration
 */
export interface CostAlert {
  /** Alert identifier */
  id: StructuredId;
  
  /** Alert name */
  name: string;
  
  /** Alert type */
  type: 'budget_threshold' | 'unusual_spending' | 'cost_spike' | 'service_limit';
  
  /** Conditions that trigger this alert */
  conditions: {
    /** Categories to monitor */
    categories?: CostCategory[];
    
    /** Services to monitor */
    services?: string[];
    
    /** Cost threshold in USD */
    costThresholdUsd?: number;
    
    /** Percentage increase threshold */
    percentageIncrease?: number;
    
    /** Time window for comparison */
    timeWindow?: 'hour' | 'day' | 'week' | 'month';
    
    /** Minimum operations to trigger */
    minOperations?: number;
  };
  
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical';
  
  /** Notification channels */
  notifications: {
    email?: string[];
    slack?: string[];
    webhook?: string[];
  };
  
  /** Whether alert is active */
  enabled: boolean;
  
  /** Alert frequency limit */
  cooldownMinutes: number;
  
  /** Last time this alert was triggered */
  lastTriggered?: Date;
  
  /** Created/updated timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cost prediction and forecasting
 */
export interface CostForecast {
  /** Forecast identifier */
  id: StructuredId;
  
  /** Forecast period */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Predicted costs by category */
  predictions: Record<CostCategory, {
    predictedCost: number;
    confidence: number; // 0-1
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  
  /** Total predicted cost */
  totalPredictedCost: number;
  
  /** Forecast accuracy (if historical) */
  accuracy?: number;
  
  /** Factors influencing the forecast */
  factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    direction: 'increase' | 'decrease';
  }>;
  
  /** Generated timestamp */
  generatedAt: Date;
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimization {
  /** Recommendation identifier */
  id: StructuredId;
  
  /** Recommendation title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Category this applies to */
  category: CostCategory;
  
  /** Service this applies to */
  service: string;
  
  /** Potential savings in USD */
  potentialSavingsUsd: number;
  
  /** Implementation effort */
  effort: 'low' | 'medium' | 'high';
  
  /** Implementation priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Specific actions to take */
  actions: Array<{
    action: string;
    description: string;
    impact: number; // USD savings
  }>;
  
  /** Risk assessment */
  risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  
  /** Status of recommendation */
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  
  /** Generated timestamp */
  generatedAt: Date;
  
  /** Last updated */
  updatedAt: Date;
}

/**
 * Tool-specific cost configuration
 */
export interface ToolCostConfig {
  /** Tool identifier */
  toolId: string;
  
  /** Tool name */
  toolName: string;
  
  /** Cost category */
  category: CostCategory;
  
  /** Pricing model */
  pricingModel: 'per_call' | 'per_result' | 'per_minute' | 'per_token' | 'tiered' | 'custom';
  
  /** Base cost configuration */
  baseCost: {
    /** Fixed cost per operation */
    fixedCostUsd?: number;
    
    /** Variable cost per unit */
    variableCostPerUnit?: number;
    
    /** Unit type for variable cost */
    unitType?: CostUnit;
  };
  
  /** Tiered pricing (if applicable) */
  tieredPricing?: Array<{
    minUnits: number;
    maxUnits: number;
    costPerUnit: number;
  }>;
  
  /** Free tier limits */
  freeTier?: {
    unitsPerPeriod: number;
    period: 'daily' | 'weekly' | 'monthly';
    resetDay?: number; // Day of month for monthly reset
  };
  
  /** Cost estimation factors */
  estimationFactors?: {
    /** Factors that affect cost */
    factors: Record<string, number>;
    
    /** Base multiplier */
    baseMultiplier: number;
  };
  
  /** Last updated */
  updatedAt: Date;
}

/**
 * External workflow cost tracking
 */
export interface ExternalWorkflowCost {
  /** Workflow platform */
  platform: 'n8n' | 'zapier' | 'make' | 'power_automate' | 'custom';
  
  /** Workflow identifier on the platform */
  workflowId: string;
  
  /** Workflow name */
  workflowName: string;
  
  /** Cost per execution */
  costPerExecution: number;
  
  /** Monthly subscription cost (if applicable) */
  monthlySubscriptionCost?: number;
  
  /** Usage limits */
  limits: {
    executionsPerMonth?: number;
    dataTransferMB?: number;
    computeMinutes?: number;
  };
  
  /** Current usage */
  currentUsage: {
    executionsThisMonth: number;
    dataTransferMB: number;
    computeMinutes: number;
  };
  
  /** Cost breakdown */
  costBreakdown: {
    subscriptionCost: number;
    executionCosts: number;
    overageCosts: number;
    totalCost: number;
  };
} 