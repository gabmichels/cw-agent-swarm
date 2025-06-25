/**
 * Error Notification Service
 * 
 * Integrates with the existing notification system to provide:
 * - Real-time error notifications to users
 * - Progress notifications during retry attempts
 * - Recovery success/failure notifications
 * - User-friendly error explanations with actionable suggestions
 */

import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  UserImpactLevel
} from '../../lib/errors/types/BaseError';
import {
  ErrorClassificationResult
} from './ErrorClassificationEngine';
import { ILogger } from '../../lib/core/ILogger';

/**
 * Notification template interface
 */
export interface ErrorNotificationTemplate {
  readonly id: string;
  readonly errorType: ErrorType;
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionButton?: {
    readonly text: string;
    readonly action: string;
  };
  readonly dismissible: boolean;
  readonly autoHide: boolean;
  readonly autoHideDelay?: number; // seconds
}

/**
 * Progress notification interface
 */
export interface ProgressNotification {
  readonly errorId: string;
  readonly title: string;
  readonly message: string;
  readonly currentAttempt: number;
  readonly maxAttempts: number;
  readonly nextRetryIn?: number; // seconds
  readonly showProgress: boolean;
  readonly progressPercent?: number;
}

/**
 * Recovery notification interface
 */
export interface RecoveryNotification {
  readonly errorId: string;
  readonly success: boolean;
  readonly title: string;
  readonly message: string;
  readonly timeTaken: number; // seconds
  readonly recoveryMethod: 'retry' | 'fallback' | 'degradation' | 'manual';
  readonly finalAttempt: number;
}

/**
 * Error notification service interface
 */
export interface IErrorNotificationService {
  sendErrorNotification(error: BaseError, classification?: ErrorClassificationResult): Promise<void>;
  sendRetryNotification(error: BaseError, attemptNumber: number, maxAttempts: number, nextRetryIn?: number): Promise<void>;
  sendEscalationNotification(error: BaseError, escalationReason: string): Promise<void>;
  sendResolutionNotification(error: BaseError, resolutionMethod: string, timeTaken: number): Promise<void>;
  sendProgressUpdate(errorId: string, progress: ProgressNotification): Promise<void>;
  dismissErrorNotification(errorId: string): Promise<void>;
}

/**
 * Default error notification service implementation
 */
export class DefaultErrorNotificationService implements IErrorNotificationService {
  private readonly notificationTemplates: Map<string, ErrorNotificationTemplate> = new Map();
  private readonly activeNotifications: Map<string, Date> = new Map();

  constructor(
    private readonly logger: ILogger,
    private readonly notificationManager?: any // Will inject the existing notification manager
  ) {
    this.initializeNotificationTemplates();
  }

  /**
   * Send initial error notification to user
   */
  async sendErrorNotification(
    error: BaseError,
    classification?: ErrorClassificationResult
  ): Promise<void> {
    try {
      // Skip low-impact errors unless they're retryable
      if (error.userImpact === UserImpactLevel.NONE ||
        (error.userImpact === UserImpactLevel.LOW && !error.retryable)) {
        this.logger.debug('Skipping notification for low-impact error', {
          errorId: error.id,
          userImpact: error.userImpact,
          retryable: error.retryable
        });
        return;
      }

      const template = this.getNotificationTemplate(error, classification);
      const notification = this.buildNotificationFromTemplate(error, template, classification);

      // Send notification through existing notification system
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          userId: error.context.userId,
          agentId: error.context.agentId,
          type: 'error',
          severity: this.mapSeverityToNotificationLevel(error.severity),
          title: notification.title,
          message: notification.message,
          metadata: {
            errorId: error.id,
            errorType: error.type,
            dismissible: template.dismissible,
            autoHide: template.autoHide,
            autoHideDelay: template.autoHideDelay,
            actionButton: template.actionButton,
            classification: classification ? {
              confidence: classification.confidence,
              estimatedResolutionTime: classification.estimatedResolutionTime,
              actionableSuggestions: classification.actionableSuggestions
            } : undefined
          }
        });
      }

      // Track active notification
      this.activeNotifications.set(error.id, new Date());

      this.logger.info('Error notification sent', {
        errorId: error.id,
        userId: error.context.userId,
        severity: error.severity,
        template: template.id
      });

    } catch (notificationError) {
      this.logger.error('Failed to send error notification', {
        errorId: error.id,
        error: notificationError
      });
    }
  }

  /**
   * Send retry progress notification
   */
  async sendRetryNotification(
    error: BaseError,
    attemptNumber: number,
    maxAttempts: number,
    nextRetryIn?: number
  ): Promise<void> {
    try {
      // Only send retry notifications for user-facing operations
      if (error.userImpact === UserImpactLevel.NONE) {
        return;
      }

      const progressNotification: ProgressNotification = {
        errorId: error.id,
        title: this.getRetryTitle(error.type),
        message: this.getRetryMessage(error.type, attemptNumber, maxAttempts, nextRetryIn),
        currentAttempt: attemptNumber,
        maxAttempts,
        nextRetryIn,
        showProgress: true,
        progressPercent: Math.round((attemptNumber / maxAttempts) * 100)
      };

      await this.sendProgressUpdate(error.id, progressNotification);

      this.logger.info('Retry notification sent', {
        errorId: error.id,
        attemptNumber,
        maxAttempts,
        nextRetryIn
      });

    } catch (notificationError) {
      this.logger.error('Failed to send retry notification', {
        errorId: error.id,
        error: notificationError
      });
    }
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(error: BaseError, escalationReason: string): Promise<void> {
    try {
      const notification = {
        userId: error.context.userId,
        agentId: error.context.agentId,
        type: 'error_escalation',
        severity: 'high',
        title: 'Issue Escalated',
        message: this.getEscalationMessage(error.type, escalationReason),
        metadata: {
          errorId: error.id,
          escalationReason,
          dismissible: true,
          autoHide: false
        }
      };

      if (this.notificationManager) {
        await this.notificationManager.sendNotification(notification);
      }

      this.logger.info('Escalation notification sent', {
        errorId: error.id,
        escalationReason
      });

    } catch (notificationError) {
      this.logger.error('Failed to send escalation notification', {
        errorId: error.id,
        error: notificationError
      });
    }
  }

  /**
   * Send resolution notification
   */
  async sendResolutionNotification(
    error: BaseError,
    resolutionMethod: string,
    timeTaken: number
  ): Promise<void> {
    try {
      const recoveryNotification: RecoveryNotification = {
        errorId: error.id,
        success: true,
        title: 'Issue Resolved',
        message: this.getResolutionMessage(error.type, resolutionMethod, timeTaken),
        timeTaken,
        recoveryMethod: resolutionMethod as any,
        finalAttempt: error.retryAttempt
      };

      const notification = {
        userId: error.context.userId,
        agentId: error.context.agentId,
        type: 'error_resolution',
        severity: 'info',
        title: recoveryNotification.title,
        message: recoveryNotification.message,
        metadata: {
          errorId: error.id,
          resolutionMethod,
          timeTaken,
          dismissible: true,
          autoHide: true,
          autoHideDelay: 5
        }
      };

      if (this.notificationManager) {
        await this.notificationManager.sendNotification(notification);
      }

      // Remove from active notifications
      this.activeNotifications.delete(error.id);

      this.logger.info('Resolution notification sent', {
        errorId: error.id,
        resolutionMethod,
        timeTaken
      });

    } catch (notificationError) {
      this.logger.error('Failed to send resolution notification', {
        errorId: error.id,
        error: notificationError
      });
    }
  }

  /**
   * Send progress update notification
   */
  async sendProgressUpdate(errorId: string, progress: ProgressNotification): Promise<void> {
    try {
      const notification = {
        type: 'error_progress',
        severity: 'info',
        title: progress.title,
        message: progress.message,
        metadata: {
          errorId,
          currentAttempt: progress.currentAttempt,
          maxAttempts: progress.maxAttempts,
          nextRetryIn: progress.nextRetryIn,
          progressPercent: progress.progressPercent,
          showProgress: progress.showProgress,
          dismissible: false,
          autoHide: false
        }
      };

      if (this.notificationManager) {
        await this.notificationManager.updateNotification(errorId, notification);
      }

      this.logger.debug('Progress update sent', {
        errorId,
        currentAttempt: progress.currentAttempt,
        maxAttempts: progress.maxAttempts
      });

    } catch (notificationError) {
      this.logger.error('Failed to send progress update', {
        errorId,
        error: notificationError
      });
    }
  }

  /**
   * Dismiss error notification
   */
  async dismissErrorNotification(errorId: string): Promise<void> {
    try {
      if (this.notificationManager) {
        await this.notificationManager.dismissNotification(errorId);
      }

      this.activeNotifications.delete(errorId);

      this.logger.debug('Error notification dismissed', { errorId });

    } catch (notificationError) {
      this.logger.error('Failed to dismiss error notification', {
        errorId,
        error: notificationError
      });
    }
  }

  /**
   * Get notification template for error
   */
  private getNotificationTemplate(
    error: BaseError,
    classification?: ErrorClassificationResult
  ): ErrorNotificationTemplate {
    const templateKey = `${error.type}_${error.severity}`;
    let template = this.notificationTemplates.get(templateKey);

    if (!template) {
      // Fall back to error type template
      template = this.notificationTemplates.get(error.type);
    }

    if (!template) {
      // Fall back to default template
      template = this.notificationTemplates.get('default');
    }

    return template!;
  }

  /**
   * Build notification from template
   */
  private buildNotificationFromTemplate(
    error: BaseError,
    template: ErrorNotificationTemplate,
    classification?: ErrorClassificationResult
  ): { title: string; message: string } {
    let title = template.title;
    let message = template.message;

    // Use classification user message if available
    if (classification?.userMessage) {
      message = classification.userMessage;
    }

    // Add actionable suggestions
    if (classification?.actionableSuggestions.length) {
      const suggestions = classification.actionableSuggestions
        .slice(0, 2) // Limit to top 2 suggestions
        .map(suggestion => `• ${suggestion}`)
        .join('\n');

      message += `\n\nWhat you can do:\n${suggestions}`;
    }

    // Add estimated resolution time
    if (classification?.estimatedResolutionTime) {
      const timeText = classification.estimatedResolutionTime < 60
        ? `${classification.estimatedResolutionTime} minutes`
        : `${Math.round(classification.estimatedResolutionTime / 60)} hours`;

      message += `\n\nEstimated resolution time: ${timeText}`;
    }

    return { title, message };
  }

  /**
   * Get retry notification title
   */
  private getRetryTitle(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION:
        return 'Retrying Operation';
      case ErrorType.API_FAILURE:
        return 'Reconnecting to Service';
      case ErrorType.WORKSPACE_CONNECTION:
        return 'Reconnecting Workspace';
      case ErrorType.NETWORK_ERROR:
        return 'Retrying Connection';
      default:
        return 'Retrying Request';
    }
  }

  /**
   * Get retry notification message
   */
  private getRetryMessage(
    errorType: ErrorType,
    attemptNumber: number,
    maxAttempts: number,
    nextRetryIn?: number
  ): string {
    let baseMessage = `Attempt ${attemptNumber} of ${maxAttempts}`;

    if (nextRetryIn && nextRetryIn > 0) {
      const retryText = nextRetryIn < 60
        ? `${nextRetryIn} seconds`
        : `${Math.round(nextRetryIn / 60)} minutes`;

      baseMessage += `. Next attempt in ${retryText}.`;
    } else if (attemptNumber < maxAttempts) {
      baseMessage += '. Retrying now...';
    }

    return baseMessage;
  }

  /**
   * Get escalation message
   */
  private getEscalationMessage(errorType: ErrorType, reason: string): string {
    const typeText = this.getErrorTypeDisplayName(errorType);
    return `The ${typeText} issue has been escalated for priority handling. Reason: ${reason}. You'll be notified once it's resolved.`;
  }

  /**
   * Get resolution message
   */
  private getResolutionMessage(
    errorType: ErrorType,
    resolutionMethod: string,
    timeTaken: number
  ): string {
    const typeText = this.getErrorTypeDisplayName(errorType);
    const timeText = timeTaken < 60
      ? `${timeTaken} seconds`
      : `${Math.round(timeTaken / 60)} minutes`;

    return `The ${typeText} issue has been resolved via ${resolutionMethod}. Resolution time: ${timeText}.`;
  }

  /**
   * Get user-friendly error type display name
   */
  private getErrorTypeDisplayName(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION:
        return 'operation';
      case ErrorType.API_FAILURE:
        return 'service connection';
      case ErrorType.WORKSPACE_CONNECTION:
        return 'workspace connection';
      case ErrorType.PERMISSION_DENIED:
        return 'permission';
      case ErrorType.NETWORK_ERROR:
        return 'network';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'rate limit';
      case ErrorType.VALIDATION_ERROR:
        return 'validation';
      case ErrorType.DATABASE_ERROR:
        return 'data access';
      default:
        return 'system';
    }
  }

  /**
   * Map error severity to notification level
   */
  private mapSeverityToNotificationLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.EMERGENCY:
        return 'critical';
      default:
        return 'info';
    }
  }

  /**
   * Initialize notification templates
   */
  private initializeNotificationTemplates(): void {
    const templates: ErrorNotificationTemplate[] = [
      // Tool execution templates
      {
        id: 'tool_execution_high',
        errorType: ErrorType.TOOL_EXECUTION,
        severity: ErrorSeverity.HIGH,
        title: 'Operation Failed',
        message: 'We encountered an issue while performing your request. We\'re working to resolve it.',
        dismissible: true,
        autoHide: false
      },
      {
        id: 'tool_execution_medium',
        errorType: ErrorType.TOOL_EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        title: 'Operation Issue',
        message: 'There was a temporary issue with your request. We\'re retrying automatically.',
        dismissible: true,
        autoHide: true,
        autoHideDelay: 10
      },

      // Permission templates
      {
        id: 'permission_denied',
        errorType: ErrorType.PERMISSION_DENIED,
        severity: ErrorSeverity.MEDIUM,
        title: 'Access Required',
        message: 'You don\'t have permission to perform this action.',
        actionButton: {
          text: 'Request Access',
          action: 'request_permission'
        },
        dismissible: true,
        autoHide: false
      },

      // API failure templates
      {
        id: 'api_failure_high',
        errorType: ErrorType.API_FAILURE,
        severity: ErrorType.HIGH,
        title: 'Service Unavailable',
        message: 'An external service is temporarily unavailable. We\'re working to restore the connection.',
        dismissible: true,
        autoHide: false
      },

      // Workspace connection templates
      {
        id: 'workspace_connection',
        errorType: ErrorType.WORKSPACE_CONNECTION,
        severity: ErrorType.MEDIUM,
        title: 'Connection Issue',
        message: 'We\'re having trouble connecting to your workspace. Attempting to reconnect...',
        actionButton: {
          text: 'Reconnect',
          action: 'reconnect_workspace'
        },
        dismissible: true,
        autoHide: false
      },

      // Network error templates
      {
        id: 'network_error',
        errorType: ErrorType.NETWORK_ERROR,
        severity: ErrorType.LOW,
        title: 'Connection Issue',
        message: 'Network connection is unstable. Retrying automatically.',
        dismissible: true,
        autoHide: true,
        autoHideDelay: 8
      },

      // Rate limit templates
      {
        id: 'rate_limit',
        errorType: ErrorType.RATE_LIMIT_ERROR,
        severity: ErrorType.MEDIUM,
        title: 'Service Busy',
        message: 'The service is currently busy. We\'ll retry your request shortly.',
        dismissible: true,
        autoHide: true,
        autoHideDelay: 15
      },

      // Default template
      {
        id: 'default',
        errorType: ErrorType.EXTERNAL_SERVICE_ERROR,
        severity: ErrorType.MEDIUM,
        title: 'Something Went Wrong',
        message: 'We encountered an unexpected issue. Please try again.',
        dismissible: true,
        autoHide: false
      }
    ];

    for (const template of templates) {
      this.notificationTemplates.set(template.id, template);
      this.notificationTemplates.set(template.errorType, template);
    }

    this.logger.info('Notification templates initialized', {
      templateCount: templates.length
    });
  }
} 