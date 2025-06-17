import { ulid } from 'ulid';

// ULID-based ID generation following IMPLEMENTATION_GUIDELINES.md
export interface StructuredId {
  readonly id: string;
  readonly prefix: string;
  readonly timestamp: Date;
  toString(): string;
}

export class IdGenerator {
  static generate(prefix: string): StructuredId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      id,
      prefix,
      timestamp,
      toString: () => `${prefix}_${id}`
    };
  }
  
  static parse(structuredId: string): StructuredId {
    const [prefix, id] = structuredId.split('_');
    if (!prefix || !id) {
      throw new RPAError('Invalid structured ID format', 'INVALID_ID_FORMAT', { structuredId });
    }
    
    // Extract timestamp from ULID
    const timestamp = new Date(parseInt(id.substring(0, 10), 32));
    
    return {
      id,
      prefix,
      timestamp,
      toString: () => structuredId
    };
  }
}

// Custom error hierarchy following IMPLEMENTATION_GUIDELINES.md
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class RPAError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `RPA_${code}`, context);
    this.name = 'RPAError';
  }
}

export class RPAWorkflowError extends RPAError {
  constructor(
    message: string,
    public readonly workflowId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'WORKFLOW_EXECUTION_FAILED', { ...context, workflowId });
    this.name = 'RPAWorkflowError';
  }
}

// Validation result interface
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

// Workflow health status
export interface WorkflowHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly lastChecked: Date;
  readonly issues: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

// Workflow execution options
export interface RPAExecutionOptions {
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly priority?: 'high' | 'medium' | 'low';
  readonly metadata?: Record<string, unknown>;
}

// Workflow information for registry
export interface WorkflowInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly domain: string;
  readonly capabilities: readonly string[];
  readonly estimatedDuration: number;
}

// Retry configuration
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly backoffMultiplier: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
}

// Composition options for complex workflows
export interface CompositionOptions {
  readonly continueOnFailure: boolean;
  readonly rollbackOnFailure: boolean;
  readonly maxConcurrentSteps: number;
  readonly timeout?: number;
}

// Workflow step for composition
export interface WorkflowStep {
  readonly workflowId: string;
  readonly params: Record<string, unknown>;
  readonly condition?: (context: RPAExecutionContext) => Promise<boolean>;
  readonly onSuccess?: (result: unknown, context: RPAExecutionContext) => Promise<void>;
  readonly onFailure?: (error: Error, context: RPAExecutionContext) => Promise<void>;
  readonly retryConfig?: RetryConfig;
}

// RPA execution context with shared resources
export interface RPAExecutionContext {
  readonly executionId: string;
  readonly browser: import('puppeteer').Browser;
  page: import('puppeteer').Page;
  readonly logger: Logger;
  readonly auditLogger: AuditLogger;
  readonly credentialManager: RPACredentialManager;
  readonly antiDetection: AntiDetectionManager;
  readonly humanBehavior: HumanBehaviorSimulator;
  readonly startTime: Date;
  metadata: Record<string, unknown>;
}

// RPA execution record for tracking
export interface RPAExecution {
  readonly id: string;
  readonly workflowId: string;
  readonly workflow: IRPAWorkflow;
  readonly params: Record<string, unknown>;
  readonly context: RPAExecutionContext;
  readonly options: RPAExecutionOptions;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: unknown;
  error?: Error;
}

// Base workflow interface - all RPA workflows implement this
export interface IRPAWorkflow<TParams = Record<string, unknown>, TResult = unknown> {
  readonly id: string;
  readonly domain: string;
  readonly name: string;
  readonly description: string;
  readonly estimatedDuration: number;
  readonly requiredCapabilities: readonly string[];
  
  validate(params: TParams): Promise<ValidationResult>;
  execute(params: TParams, context: RPAExecutionContext): Promise<TResult>;
  rollback?(context: RPAExecutionContext): Promise<void>;
  getHealthCheck(): Promise<WorkflowHealth>;
}

// RPA domain configuration
export interface RPADomainConfig {
  readonly domain: string;
  readonly enabled: boolean;
  readonly maxConcurrentExecutions: number;
  readonly defaultTimeout: number;
  readonly retryConfig: RetryConfig;
  readonly browserConfig: BrowserConfig;
  readonly security: SecurityConfig;
}

// Browser configuration
export interface BrowserConfig {
  readonly headless: boolean;
  readonly maxInstances: number;
  readonly idleTimeout: number;
  readonly launchOptions: {
    readonly args: readonly string[];
    readonly executablePath?: string;
  };
}

// Security configuration
export interface SecurityConfig {
  readonly screenshotsEnabled: boolean;
  readonly auditLogging: boolean;
  readonly sessionIsolation: boolean;
  readonly credentialEncryption: boolean;
}

// Logger interface
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

// Audit logger interface
export interface AuditLogger {
  logWorkflowExecution(entry: WorkflowExecutionAuditEntry): Promise<void>;
  logRPAExecution(entry: RPAExecutionAuditEntry): Promise<void>;
}

// Audit entry interfaces
export interface WorkflowExecutionAuditEntry extends Record<string, unknown> {
  readonly executionId: string;
  readonly workflowId: string;
  readonly success: boolean;
  readonly duration: number;
  readonly result?: unknown;
  readonly error?: string;
  readonly timestamp?: Date;
}

export interface RPAExecutionAuditEntry extends Record<string, unknown> {
  readonly executionId: string;
  readonly workflowId: string;
  readonly domain: string;
  readonly success: boolean;
  readonly duration: number;
  readonly error?: string;
  readonly metadata: Record<string, unknown>;
  readonly timestamp?: Date;
}

// Credential manager interface
export interface RPACredentialManager {
  getCredentials(connectionId: string): Promise<RPACredentials | null>;
  storeCredentials(connectionId: string, credentials: RPACredentials): Promise<void>;
  deleteCredentials(connectionId: string): Promise<void>;
}

// RPA credentials
export interface RPACredentials {
  readonly username: string;
  readonly password: string;
  readonly twoFactorSecret?: string;
  readonly sessionCookies?: Record<string, string>;
  readonly metadata?: Record<string, unknown>;
}

// Anti-detection manager interface
export interface AntiDetectionManager {
  setupPage(page: import('puppeteer').Page): Promise<void>;
  getRandomUserAgent(): string;
  getRandomViewport(): { width: number; height: number };
}

// Human behavior simulator interface
export interface HumanBehaviorSimulator {
  humanType(page: import('puppeteer').Page, selector: string, text: string): Promise<void>;
  humanClick(page: import('puppeteer').Page, selector: string): Promise<void>;
  simulateMouseMovement(page: import('puppeteer').Page, target: string): Promise<void>;
  randomDelay(min: number, max: number): Promise<void>;
} 