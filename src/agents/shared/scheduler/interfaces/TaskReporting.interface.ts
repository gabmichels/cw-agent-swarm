/**
 * Task Reporting Interface
 * 
 * This file defines interfaces for comprehensive task reporting capabilities,
 * enabling standardized mechanisms for generating reports on task execution,
 * status, and performance.
 */

import {
  TaskExecutionStatus,
  TaskPriority,
  TaskPerformanceMetrics,
  TaskExecutionHistory,
  TaskLogEntry,
  TaskAnalysisReport
} from './TaskTracking.interface';

/**
 * Report format options
 */
export enum ReportFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  HTML = 'html',
  CSV = 'csv',
  TEXT = 'text'
}

/**
 * Report delivery method
 */
export enum ReportDeliveryMethod {
  EMAIL = 'email',
  FILE = 'file',
  UI = 'ui',
  API = 'api',
  WEBHOOK = 'webhook',
  NOTIFICATION = 'notification'
}

/**
 * Report type
 */
export enum ReportType {
  SUMMARY = 'summary',           // Overall task summary
  DETAIL = 'detail',             // Detailed task information
  PERFORMANCE = 'performance',   // Performance analysis
  ISSUES = 'issues',             // Issue report
  HISTORY = 'history',           // Historical execution
  STATUS = 'status',             // Current task status
  CUSTOM = 'custom'              // Custom report
}

/**
 * Report schedule type
 */
export enum ReportScheduleType {
  DAILY = 'daily',               // Daily report
  WEEKLY = 'weekly',             // Weekly report
  MONTHLY = 'monthly',           // Monthly report
  QUARTERLY = 'quarterly',       // Quarterly report
  CUSTOM = 'custom',             // Custom schedule
  EVENT_TRIGGERED = 'event'      // Triggered by events
}

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Report type */
  type: ReportType;
  
  /** Report format */
  format: ReportFormat;
  
  /** Report title */
  title: string;
  
  /** Report description */
  description?: string;
  
  /** Task IDs to include (all if omitted) */
  taskIds?: string[];
  
  /** Filter by task status */
  statusFilter?: TaskExecutionStatus[];
  
  /** Filter by task priority */
  priorityFilter?: TaskPriority[];
  
  /** Time range to report on */
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  /** Maximum records to include */
  maxRecords?: number;
  
  /** Whether to include task logs */
  includeLogs?: boolean;
  
  /** Minimum log level to include */
  minLogLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  /** Whether to include performance metrics */
  includePerformanceMetrics?: boolean;
  
  /** Whether to include issue analysis */
  includeIssueAnalysis?: boolean;
  
  /** Whether to include recommendations */
  includeRecommendations?: boolean;
  
  /** Whether to include graphs and charts (for HTML format) */
  includeVisualizations?: boolean;
  
  /** Custom fields to include */
  customFields?: string[];
  
  /** Additional configuration options */
  options?: Record<string, unknown>;
}

/**
 * Report schedule configuration
 */
export interface ReportScheduleConfig {
  /** Schedule type */
  type: ReportScheduleType;
  
  /** Cron expression for custom schedules */
  cronExpression?: string;
  
  /** Day of week for weekly reports (0-6, Sunday=0) */
  dayOfWeek?: number;
  
  /** Day of month for monthly reports (1-31) */
  dayOfMonth?: number;
  
  /** Hour of day (0-23) */
  hour: number;
  
  /** Minute of hour (0-59) */
  minute: number;
  
  /** Time zone identifier */
  timezone?: string;
  
  /** Event types that trigger the report (for event-triggered schedules) */
  triggerEvents?: string[];
  
  /** Whether to skip execution if no new data */
  skipIfNoNewData?: boolean;
  
  /** Maximum delay in minutes */
  maxDelayMinutes?: number;
}

/**
 * Report delivery configuration
 */
export interface ReportDeliveryConfig {
  /** Delivery method */
  method: ReportDeliveryMethod;
  
  /** Recipients (depends on delivery method) */
  recipients?: string[];
  
  /** Subject/title for notifications/emails */
  subject?: string;
  
  /** File path for file delivery */
  filePath?: string;
  
  /** URL for webhook/API delivery */
  url?: string;
  
  /** Headers for webhook/API delivery */
  headers?: Record<string, string>;
  
  /** Compression (for file delivery) */
  compression?: 'none' | 'gzip' | 'zip';
  
  /** Retry configuration */
  retry?: {
    /** Maximum retries */
    maxRetries: number;
    
    /** Delay between retries in milliseconds */
    delayMs: number;
  };
  
  /** Additional delivery options */
  options?: Record<string, unknown>;
}

/**
 * Scheduled report definition
 */
export interface ScheduledReport {
  /** Unique report ID */
  id: string;
  
  /** Report name */
  name: string;
  
  /** Report configuration */
  config: ReportConfig;
  
  /** Schedule configuration */
  schedule: ReportScheduleConfig;
  
  /** Delivery configuration */
  delivery: ReportDeliveryConfig;
  
  /** Enabled status */
  enabled: boolean;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last modified timestamp */
  updatedAt: Date;
  
  /** Last execution timestamp */
  lastExecutedAt?: Date;
  
  /** Next scheduled execution timestamp */
  nextExecutionAt?: Date;
  
  /** Owner of this report */
  owner?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  /** Report ID */
  reportId: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Generation timestamp */
  timestamp: Date;
  
  /** Generation duration in milliseconds */
  durationMs: number;
  
  /** Output format */
  format: ReportFormat;
  
  /** Output content or URL */
  content: string;
  
  /** Content size in bytes */
  sizeBytes: number;
  
  /** Number of records included */
  recordCount: number;
  
  /** Time period covered */
  period?: {
    start: Date;
    end: Date;
  };
  
  /** Delivery status */
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  
  /** Delivery timestamp */
  deliveredAt?: Date;
  
  /** Delivery details */
  deliveryDetails?: {
    /** Method used */
    method: ReportDeliveryMethod;
    
    /** Recipients */
    recipients?: string[];
    
    /** Location where delivered */
    location?: string;
    
    /** Delivery error if any */
    error?: string;
  };
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Report template
 */
export interface ReportTemplate {
  /** Template ID */
  id: string;
  
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Report type */
  type: ReportType;
  
  /** Supported formats */
  supportedFormats: ReportFormat[];
  
  /** Default configuration */
  defaultConfig: Partial<ReportConfig>;
  
  /** Template content or path */
  template: string;
  
  /** Template format (e.g., 'handlebars', 'ejs', 'custom') */
  templateFormat: string;
  
  /** Template version */
  version: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last modified timestamp */
  updatedAt: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Report data source
 */
export interface ReportDataSource {
  /** Data source ID */
  id: string;
  
  /** Data source name */
  name: string;
  
  /** Data source type */
  type: 'task' | 'system' | 'external' | 'custom';
  
  /** Connection details for external sources */
  connection?: {
    /** Connection type */
    type: 'database' | 'api' | 'file' | 'service';
    
    /** Connection URL */
    url?: string;
    
    /** Authentication details */
    auth?: {
      type: 'none' | 'basic' | 'oauth' | 'token' | 'key';
      credentials?: Record<string, string>;
    };
    
    /** Additional connection parameters */
    params?: Record<string, string>;
  };
  
  /** Query details for database sources */
  query?: {
    /** Query string */
    queryString: string;
    
    /** Query parameters */
    parameters?: Record<string, unknown>;
    
    /** Timeout in milliseconds */
    timeoutMs?: number;
  };
  
  /** Data transformation options */
  transform?: {
    /** Type of transformation */
    type: 'none' | 'map' | 'filter' | 'aggregate' | 'custom';
    
    /** Transformation options */
    options?: Record<string, unknown>;
  };
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last modified timestamp */
  updatedAt: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task reporting system interface
 */
export interface TaskReportingSystem {
  /**
   * Initialize the task reporting system
   * 
   * @param options Configuration options
   * @returns Promise resolving to initialization success
   */
  initialize(options?: Record<string, unknown>): Promise<boolean>;
  
  /**
   * Generate a task report
   * 
   * @param config Report configuration
   * @param delivery Optional delivery configuration
   * @returns Promise resolving to report generation result
   */
  generateReport(
    config: ReportConfig,
    delivery?: ReportDeliveryConfig
  ): Promise<ReportGenerationResult>;
  
  /**
   * Create a scheduled report
   * 
   * @param report Scheduled report definition
   * @returns Promise resolving to report ID
   */
  createScheduledReport(
    report: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'nextExecutionAt'>
  ): Promise<string>;
  
  /**
   * Update a scheduled report
   * 
   * @param reportId Report ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateScheduledReport(
    reportId: string,
    updates: Partial<Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'nextExecutionAt'>>
  ): Promise<boolean>;
  
  /**
   * Delete a scheduled report
   * 
   * @param reportId Report ID
   * @returns Promise resolving to success
   */
  deleteScheduledReport(reportId: string): Promise<boolean>;
  
  /**
   * Get a scheduled report by ID
   * 
   * @param reportId Report ID
   * @returns Promise resolving to scheduled report or null if not found
   */
  getScheduledReport(reportId: string): Promise<ScheduledReport | null>;
  
  /**
   * Get all scheduled reports
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to scheduled reports
   */
  getScheduledReports(filter?: {
    enabled?: boolean;
    type?: ReportType[];
    scheduleType?: ReportScheduleType[];
    owner?: string;
  }): Promise<ScheduledReport[]>;
  
  /**
   * Enable a scheduled report
   * 
   * @param reportId Report ID
   * @returns Promise resolving to success
   */
  enableScheduledReport(reportId: string): Promise<boolean>;
  
  /**
   * Disable a scheduled report
   * 
   * @param reportId Report ID
   * @returns Promise resolving to success
   */
  disableScheduledReport(reportId: string): Promise<boolean>;
  
  /**
   * Execute a scheduled report immediately
   * 
   * @param reportId Report ID
   * @returns Promise resolving to report generation result
   */
  executeScheduledReport(reportId: string): Promise<ReportGenerationResult>;
  
  /**
   * Get report history
   * 
   * @param reportId Report ID (optional - if omitted, get history for all reports)
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @returns Promise resolving to report generation results
   */
  getReportHistory(
    reportId?: string,
    limit?: number,
    offset?: number
  ): Promise<ReportGenerationResult[]>;
  
  /**
   * Create a report template
   * 
   * @param template Report template definition
   * @returns Promise resolving to template ID
   */
  createReportTemplate(
    template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string>;
  
  /**
   * Get a report template by ID
   * 
   * @param templateId Template ID
   * @returns Promise resolving to report template or null if not found
   */
  getReportTemplate(templateId: string): Promise<ReportTemplate | null>;
  
  /**
   * Get all report templates
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to report templates
   */
  getReportTemplates(filter?: {
    type?: ReportType[];
    format?: ReportFormat[];
  }): Promise<ReportTemplate[]>;
  
  /**
   * Update a report template
   * 
   * @param templateId Template ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateReportTemplate(
    templateId: string,
    updates: Partial<Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean>;
  
  /**
   * Delete a report template
   * 
   * @param templateId Template ID
   * @returns Promise resolving to success
   */
  deleteReportTemplate(templateId: string): Promise<boolean>;
  
  /**
   * Register a report data source
   * 
   * @param dataSource Data source definition
   * @returns Promise resolving to data source ID
   */
  registerDataSource(
    dataSource: Omit<ReportDataSource, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string>;
  
  /**
   * Get a data source by ID
   * 
   * @param dataSourceId Data source ID
   * @returns Promise resolving to data source or null if not found
   */
  getDataSource(dataSourceId: string): Promise<ReportDataSource | null>;
  
  /**
   * Get all data sources
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to data sources
   */
  getDataSources(filter?: {
    type?: string[];
  }): Promise<ReportDataSource[]>;
  
  /**
   * Update a data source
   * 
   * @param dataSourceId Data source ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateDataSource(
    dataSourceId: string,
    updates: Partial<Omit<ReportDataSource, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean>;
  
  /**
   * Delete a data source
   * 
   * @param dataSourceId Data source ID
   * @returns Promise resolving to success
   */
  deleteDataSource(dataSourceId: string): Promise<boolean>;
  
  /**
   * Test a data source connection
   * 
   * @param dataSourceId Data source ID or data source definition
   * @returns Promise resolving to connection test result
   */
  testDataSourceConnection(
    dataSourceId: string | Omit<ReportDataSource, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;
  
  /**
   * Query a data source
   * 
   * @param dataSourceId Data source ID
   * @param query Query string or parameters
   * @returns Promise resolving to query results
   */
  queryDataSource(
    dataSourceId: string,
    query: string | Record<string, unknown>
  ): Promise<unknown[]>;
  
  /**
   * Shutdown the task reporting system
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 