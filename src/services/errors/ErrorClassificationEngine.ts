/**
 * Error Classification Engine
 * 
 * Analyzes error patterns, assigns severity levels, and detects known error patterns
 * 
 * Features:
 * - Pattern matching for known errors
 * - Severity assessment based on context
 * - User impact scoring
 * - Auto-categorization rules
 */

import { ulid } from 'ulid';
import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  ErrorStatus,
  ErrorCategory,
  UserImpactLevel,
  RetryStrategy
} from '../../lib/errors/types/BaseError';
import { ILogger } from '../../lib/core/ILogger';

/**
 * Error pattern interface for matching known errors
 */
export interface ErrorPattern {
  readonly id: string;
  readonly name: string;
  readonly pattern: RegExp;
  readonly errorType: ErrorType;
  readonly severity: ErrorSeverity;
  readonly userImpact: UserImpactLevel;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly maxRetries: number;
  readonly retryStrategy: RetryStrategy;
  readonly userMessage?: string;
  readonly actionable: boolean;
  readonly resolution?: string;
}

/**
 * Classification result interface
 */
export interface ErrorClassificationResult {
  readonly errorId: string;
  readonly matchedPattern?: ErrorPattern;
  readonly severity: ErrorSeverity;
  readonly userImpact: UserImpactLevel;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly maxRetries: number;
  readonly retryStrategy: RetryStrategy;
  readonly userMessage: string;
  readonly actionableSuggestions: readonly string[];
  readonly estimatedResolutionTime?: number; // minutes
  readonly confidence: number; // 0-100
}

/**
 * Error context analysis result
 */
export interface ContextAnalysisResult {
  readonly agentLoad: 'low' | 'medium' | 'high';
  readonly errorFrequency: 'rare' | 'occasional' | 'frequent';
  readonly timeContext: 'business_hours' | 'off_hours' | 'weekend';
  readonly userActivity: 'active' | 'idle' | 'unknown';
  readonly systemHealth: 'healthy' | 'degraded' | 'critical';
}

/**
 * Error classification engine interface
 */
export interface IErrorClassificationEngine {
  classifyError(error: BaseError): Promise<ErrorClassificationResult>;
  analyzeContext(error: BaseError): Promise<ContextAnalysisResult>;
  registerPattern(pattern: ErrorPattern): Promise<void>;
  getKnownPatterns(): Promise<readonly ErrorPattern[]>;
  updatePatternFromResolution(errorId: string, resolution: string): Promise<void>;
}

/**
 * Default error classification engine implementation
 */
export class DefaultErrorClassificationEngine implements IErrorClassificationEngine {
  private readonly knownPatterns: Map<string, ErrorPattern> = new Map();

  constructor(
    private readonly logger: ILogger
  ) {
    this.initializeDefaultPatterns();
  }

  /**
   * Classify an error using pattern matching and context analysis
   */
  async classifyError(error: BaseError): Promise<ErrorClassificationResult> {
    try {
      this.logger.info('Classifying error', {
        errorId: error.id,
        type: error.type,
        message: error.message
      });

      // Try to match against known patterns
      const matchedPattern = await this.findMatchingPattern(error);

      // Analyze context for dynamic classification
      const contextAnalysis = await this.analyzeContext(error);

      // Determine classification based on pattern match or defaults
      const classification = this.determineClassification(
        error,
        matchedPattern,
        contextAnalysis
      );

      this.logger.info('Error classification complete', {
        errorId: error.id,
        severity: classification.severity,
        userImpact: classification.userImpact,
        confidence: classification.confidence,
        hasPattern: !!matchedPattern
      });

      return classification;
    } catch (classificationError) {
      this.logger.error('Error classification failed', {
        errorId: error.id,
        error: classificationError
      });

      // Return safe default classification
      return this.createDefaultClassification(error);
    }
  }

  /**
   * Analyze error context for dynamic classification
   */
  async analyzeContext(error: BaseError): Promise<ContextAnalysisResult> {
    const now = new Date();
    const errorTime = error.timestamp;

    // Time-based analysis
    const hour = errorTime.getHours();
    const day = errorTime.getDay();

    let timeContext: 'business_hours' | 'off_hours' | 'weekend';
    if (day === 0 || day === 6) {
      timeContext = 'weekend';
    } else if (hour >= 9 && hour <= 17) {
      timeContext = 'business_hours';
    } else {
      timeContext = 'off_hours';
    }

    // Agent activity analysis
    const agentLoad = this.analyzeAgentLoad(error);

    // Error frequency analysis
    const errorFrequency = await this.analyzeErrorFrequency(error);

    // User activity analysis
    const userActivity = this.analyzeUserActivity(error);

    // System health analysis
    const systemHealth = await this.analyzeSystemHealth();

    return {
      agentLoad,
      errorFrequency,
      timeContext,
      userActivity,
      systemHealth
    };
  }

  /**
   * Register a new error pattern
   */
  async registerPattern(pattern: ErrorPattern): Promise<void> {
    this.knownPatterns.set(pattern.id, pattern);

    this.logger.info('Error pattern registered', {
      patternId: pattern.id,
      name: pattern.name,
      errorType: pattern.errorType
    });
  }

  /**
   * Get all known error patterns
   */
  async getKnownPatterns(): Promise<readonly ErrorPattern[]> {
    return Array.from(this.knownPatterns.values());
  }

  /**
   * Update pattern based on resolution feedback
   */
  async updatePatternFromResolution(errorId: string, resolution: string): Promise<void> {
    // This would typically update patterns based on successful resolutions
    // For now, we'll log the feedback for future pattern improvement
    this.logger.info('Pattern feedback received', {
      errorId,
      resolution
    });
  }

  /**
   * Find matching pattern for error
   */
  private async findMatchingPattern(error: BaseError): Promise<ErrorPattern | undefined> {
    for (const pattern of this.knownPatterns.values()) {
      // Match by error type first
      if (pattern.errorType !== error.type) {
        continue;
      }

      // Then try pattern matching on message
      if (pattern.pattern.test(error.message)) {
        this.logger.debug('Pattern matched', {
          errorId: error.id,
          patternId: pattern.id,
          patternName: pattern.name
        });
        return pattern;
      }

      // Check metadata for additional matching
      if (error.metadata && this.matchesMetadataPattern(pattern, error.metadata)) {
        return pattern;
      }
    }

    return undefined;
  }

  /**
   * Check if pattern matches error metadata
   */
  private matchesMetadataPattern(pattern: ErrorPattern, metadata: Record<string, unknown>): boolean {
    // Tool-specific pattern matching
    if (pattern.errorType === ErrorType.TOOL_EXECUTION) {
      const toolName = metadata.toolName as string;
      if (toolName && pattern.name.includes(toolName)) {
        return true;
      }
    }

    // API-specific pattern matching
    if (pattern.errorType === ErrorType.API_FAILURE) {
      const statusCode = metadata.statusCode as number;
      if (statusCode) {
        // Match specific HTTP status codes
        if (pattern.name.includes(statusCode.toString())) {
          return true;
        }

        // Match status code ranges
        if (statusCode >= 500 && pattern.name.includes('5xx')) {
          return true;
        }
        if (statusCode >= 400 && statusCode < 500 && pattern.name.includes('4xx')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Determine final classification
   */
  private determineClassification(
    error: BaseError,
    matchedPattern: ErrorPattern | undefined,
    contextAnalysis: ContextAnalysisResult
  ): ErrorClassificationResult {
    let severity = error.severity;
    let userImpact = error.userImpact;
    let retryable = error.retryable;
    let maxRetries = error.maxRetries;
    let retryStrategy = error.retryStrategy || RetryStrategy.LINEAR;
    let userMessage = error.userMessage || 'An error occurred while processing your request.';
    let actionableSuggestions: string[] = [];
    let estimatedResolutionTime: number | undefined;
    let confidence = 50; // Default confidence

    if (matchedPattern) {
      // Use pattern-based classification
      severity = matchedPattern.severity;
      userImpact = matchedPattern.userImpact;
      retryable = matchedPattern.retryable;
      maxRetries = matchedPattern.maxRetries;
      retryStrategy = matchedPattern.retryStrategy;
      userMessage = matchedPattern.userMessage || userMessage;
      confidence = 90;

      if (matchedPattern.actionable && matchedPattern.resolution) {
        actionableSuggestions.push(matchedPattern.resolution);
      }
    }

    // Adjust classification based on context
    const adjustedClassification = this.adjustForContext(
      { severity, userImpact, retryable, maxRetries, retryStrategy },
      contextAnalysis
    );

    // Generate actionable suggestions
    if (actionableSuggestions.length === 0) {
      actionableSuggestions = this.generateActionableSuggestions(error, adjustedClassification);
    }

    // Estimate resolution time
    estimatedResolutionTime = this.estimateResolutionTime(
      error,
      adjustedClassification,
      contextAnalysis
    );

    return {
      errorId: error.id,
      matchedPattern,
      severity: adjustedClassification.severity,
      userImpact: adjustedClassification.userImpact,
      category: error.category,
      retryable: adjustedClassification.retryable,
      maxRetries: adjustedClassification.maxRetries,
      retryStrategy: adjustedClassification.retryStrategy,
      userMessage,
      actionableSuggestions,
      estimatedResolutionTime,
      confidence
    };
  }

  /**
   * Adjust classification based on context
   */
  private adjustForContext(
    classification: {
      severity: ErrorSeverity;
      userImpact: UserImpactLevel;
      retryable: boolean;
      maxRetries: number;
      retryStrategy: RetryStrategy;
    },
    context: ContextAnalysisResult
  ): typeof classification {
    let { severity, userImpact, retryable, maxRetries, retryStrategy } = classification;

    // Adjust severity based on system health
    if (context.systemHealth === 'critical') {
      if (severity === ErrorSeverity.MEDIUM) severity = ErrorSeverity.HIGH;
      if (severity === ErrorSeverity.HIGH) severity = ErrorSeverity.CRITICAL;
    } else if (context.systemHealth === 'degraded') {
      if (severity === ErrorSeverity.LOW) severity = ErrorSeverity.MEDIUM;
    }

    // Adjust retries based on error frequency
    if (context.errorFrequency === 'frequent') {
      maxRetries = Math.max(1, Math.floor(maxRetries * 0.5));
      retryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF;
    }

    // Adjust user impact based on time context
    if (context.timeContext === 'off_hours' || context.timeContext === 'weekend') {
      if (userImpact === UserImpactLevel.HIGH) userImpact = UserImpactLevel.MEDIUM;
      if (userImpact === UserImpactLevel.MEDIUM) userImpact = UserImpactLevel.LOW;
    }

    // Adjust for high agent load
    if (context.agentLoad === 'high') {
      maxRetries = Math.max(1, Math.floor(maxRetries * 0.7));
    }

    return { severity, userImpact, retryable, maxRetries, retryStrategy };
  }

  /**
   * Generate actionable suggestions for users
   */
  private generateActionableSuggestions(
    error: BaseError,
    classification: {
      severity: ErrorSeverity;
      userImpact: UserImpactLevel;
      retryable: boolean;
      maxRetries: number;
      retryStrategy: RetryStrategy;
    }
  ): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case ErrorType.TOOL_EXECUTION:
        suggestions.push('Try the operation again in a few moments');
        if (error.context.toolName) {
          suggestions.push(`Check if ${error.context.toolName} service is accessible`);
        }
        break;

      case ErrorType.PERMISSION_DENIED:
        suggestions.push('Check your workspace permissions');
        suggestions.push('Contact your administrator if you need additional access');
        break;

      case ErrorType.WORKSPACE_CONNECTION:
        suggestions.push('Reconnect your workspace account');
        suggestions.push('Check your internet connection');
        break;

      case ErrorType.API_FAILURE:
        suggestions.push('The external service may be temporarily unavailable');
        suggestions.push('Try again in a few minutes');
        break;

      case ErrorType.NETWORK_ERROR:
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        break;

      default:
        suggestions.push('Try the operation again');
        break;
    }

    return suggestions;
  }

  /**
   * Estimate resolution time based on error classification and context
   */
  private estimateResolutionTime(
    error: BaseError,
    classification: {
      severity: ErrorSeverity;
      userImpact: UserImpactLevel;
      retryable: boolean;
      maxRetries: number;
      retryStrategy: RetryStrategy;
    },
    context: ContextAnalysisResult
  ): number | undefined {
    // Base resolution times in minutes
    const baseTimes: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 2,
      [ErrorSeverity.MEDIUM]: 5,
      [ErrorSeverity.HIGH]: 15,
      [ErrorSeverity.CRITICAL]: 60,
      [ErrorSeverity.EMERGENCY]: 180
    };

    let estimatedTime = baseTimes[classification.severity];

    // Adjust based on context
    if (context.systemHealth === 'degraded') {
      estimatedTime *= 1.5;
    } else if (context.systemHealth === 'critical') {
      estimatedTime *= 2;
    }

    if (context.errorFrequency === 'frequent') {
      estimatedTime *= 1.3;
    }

    if (context.timeContext === 'off_hours' || context.timeContext === 'weekend') {
      estimatedTime *= 1.2;
    }

    return Math.round(estimatedTime);
  }

  /**
   * Analyze agent load based on error context
   */
  private analyzeAgentLoad(error: BaseError): 'low' | 'medium' | 'high' {
    // This would typically query agent metrics
    // For now, return medium as default
    return 'medium';
  }

  /**
   * Analyze error frequency for this error type
   */
  private async analyzeErrorFrequency(error: BaseError): Promise<'rare' | 'occasional' | 'frequent'> {
    // This would typically query error history from database
    // For now, return occasional as default
    return 'occasional';
  }

  /**
   * Analyze user activity state
   */
  private analyzeUserActivity(error: BaseError): 'active' | 'idle' | 'unknown' {
    // This would typically check user session activity
    // For now, return active as default
    return 'active';
  }

  /**
   * Analyze overall system health
   */
  private async analyzeSystemHealth(): Promise<'healthy' | 'degraded' | 'critical'> {
    // This would typically check system metrics
    // For now, return healthy as default
    return 'healthy';
  }

  /**
   * Create default classification for unmatched errors
   */
  private createDefaultClassification(error: BaseError): ErrorClassificationResult {
    return {
      errorId: error.id,
      matchedPattern: undefined,
      severity: error.severity,
      userImpact: error.userImpact,
      category: error.category,
      retryable: error.retryable,
      maxRetries: error.maxRetries,
      retryStrategy: error.retryStrategy || RetryStrategy.LINEAR,
      userMessage: error.userMessage || 'An unexpected error occurred.',
      actionableSuggestions: ['Try the operation again', 'Contact support if the problem persists'],
      estimatedResolutionTime: 5,
      confidence: 30
    };
  }

  /**
   * Initialize default error patterns
   */
  private initializeDefaultPatterns(): void {
    const defaultPatterns: ErrorPattern[] = [
      // Tool execution patterns
      {
        id: ulid(),
        name: 'Email Send Failure',
        pattern: /email.*failed|failed.*send.*email|gmail.*error/i,
        errorType: ErrorType.TOOL_EXECUTION,
        severity: ErrorSeverity.HIGH,
        userImpact: UserImpactLevel.HIGH,
        category: ErrorCategory.INTERNAL,
        retryable: true,
        maxRetries: 3,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        userMessage: 'Failed to send email. We\'re retrying the operation.',
        actionable: true,
        resolution: 'Check your email connection and try again'
      },
      {
        id: ulid(),
        name: 'Calendar Access Failure',
        pattern: /calendar.*access|failed.*calendar|calendar.*permission/i,
        errorType: ErrorType.TOOL_EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        userImpact: UserImpactLevel.MEDIUM,
        category: ErrorCategory.INTERNAL,
        retryable: true,
        maxRetries: 2,
        retryStrategy: RetryStrategy.LINEAR,
        userMessage: 'Unable to access your calendar. Checking permissions.',
        actionable: true,
        resolution: 'Ensure calendar permissions are granted'
      },

      // Permission patterns
      {
        id: ulid(),
        name: 'Workspace Permission Denied',
        pattern: /permission.*denied|access.*denied|unauthorized.*workspace/i,
        errorType: ErrorType.PERMISSION_DENIED,
        severity: ErrorSeverity.MEDIUM,
        userImpact: UserImpactLevel.MEDIUM,
        category: ErrorCategory.USER_ACTION,
        retryable: false,
        maxRetries: 0,
        retryStrategy: RetryStrategy.NO_RETRY,
        userMessage: 'You don\'t have permission to perform this action.',
        actionable: true,
        resolution: 'Contact your administrator to request access'
      },

      // API failure patterns
      {
        id: ulid(),
        name: 'Rate Limit Exceeded',
        pattern: /rate.*limit|too.*many.*requests|quota.*exceeded/i,
        errorType: ErrorType.RATE_LIMIT_ERROR,
        severity: ErrorSeverity.MEDIUM,
        userImpact: UserImpactLevel.LOW,
        category: ErrorCategory.EXTERNAL,
        retryable: true,
        maxRetries: 5,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        userMessage: 'Service temporarily busy. Retrying in a moment.',
        actionable: false,
        resolution: 'Wait for rate limit to reset'
      },

      // Network patterns
      {
        id: ulid(),
        name: 'Network Timeout',
        pattern: /timeout|network.*error|connection.*failed/i,
        errorType: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.LOW,
        userImpact: UserImpactLevel.LOW,
        category: ErrorCategory.EXTERNAL,
        retryable: true,
        maxRetries: 3,
        retryStrategy: RetryStrategy.LINEAR,
        userMessage: 'Network connection issue. Retrying...',
        actionable: true,
        resolution: 'Check your internet connection'
      }
    ];

    for (const pattern of defaultPatterns) {
      this.knownPatterns.set(pattern.id, pattern);
    }

    this.logger.info('Default error patterns initialized', {
      patternCount: defaultPatterns.length
    });
  }
} 