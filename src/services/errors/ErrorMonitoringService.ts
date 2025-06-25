/**
 * Error Monitoring Service
 * 
 * Implements real-time error threshold monitoring, alerting,
 * and system degradation detection.
 * 
 * Phase 6.3 of the error communication implementation.
 */

import { ILogger } from '../../lib/core/logger';
import {
  IErrorDatabaseProvider
} from './interfaces/IErrorManagementService';

export interface MonitoringThreshold {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly metric: 'ERROR_RATE' | 'CRITICAL_ERRORS' | 'RESOLUTION_RATE' | 'FAILURE_RATE';
  readonly threshold: number;
  readonly timeWindow: number; // in minutes
  readonly severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  readonly enabled: boolean;
  readonly alertChannels: AlertChannel[];
}

export interface AlertChannel {
  readonly type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'NOTIFICATION';
  readonly target: string;
  readonly enabled: boolean;
}

export interface MonitoringAlert {
  readonly id: string;
  readonly thresholdId: string;
  readonly triggeredAt: Date;
  readonly severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  readonly metric: string;
  readonly currentValue: number;
  readonly thresholdValue: number;
  readonly message: string;
  readonly context: Record<string, unknown>;
  readonly status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: Date;
  readonly resolvedAt?: Date;
}

export interface SystemDegradationAlert {
  readonly id: string;
  readonly detectedAt: Date;
  readonly severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  readonly affectedComponents: string[];
  readonly symptoms: string[];
  readonly estimatedImpact: {
    readonly usersAffected: number;
    readonly operationsImpacted: string[];
    readonly estimatedDowntime: number; // in minutes
  };
  readonly recommendedActions: string[];
  readonly status: 'DETECTING' | 'CONFIRMED' | 'MITIGATING' | 'RESOLVED';
}

export interface MonitoringMetrics {
  readonly timestamp: Date;
  readonly errorRate: number; // errors per hour
  readonly criticalErrorsCount: number;
  readonly resolutionRate: number; // percentage
  readonly averageResolutionTime: number; // in hours
  readonly systemAvailability: number; // percentage
  readonly activeAlertsCount: number;
  readonly degradationLevel: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
}

export interface MonitoringConfiguration {
  readonly enabled: boolean;
  readonly checkInterval: number; // in minutes
  readonly thresholds: MonitoringThreshold[];
  readonly alertingEnabled: boolean;
  readonly degradationDetection: boolean;
  readonly retentionPeriod: number; // in days
}

export class DefaultErrorMonitoringService {
  private monitoringConfig: MonitoringConfiguration;
  private activeAlerts: Map<string, MonitoringAlert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: MonitoringMetrics | null = null;

  constructor(
    private readonly logger: ILogger,
    private readonly databaseProvider: IErrorDatabaseProvider,
    config?: Partial<MonitoringConfiguration>
  ) {
    this.monitoringConfig = {
      enabled: true,
      checkInterval: 5, // 5 minutes
      alertingEnabled: true,
      degradationDetection: true,
      retentionPeriod: 30, // 30 days
      thresholds: this.getDefaultThresholds(),
      ...config
    };
  }

  /**
   * Start error monitoring
   */
  async startMonitoring(): Promise<void> {
    try {
      if (!this.monitoringConfig.enabled) {
        this.logger.info('Error monitoring is disabled');
        return;
      }

      this.logger.info('Starting error monitoring', {
        checkInterval: this.monitoringConfig.checkInterval,
        thresholdCount: this.monitoringConfig.thresholds.length
      });

      // Perform initial check
      await this.performMonitoringCheck();

      // Set up monitoring interval
      this.monitoringInterval = setInterval(
        () => this.performMonitoringCheck(),
        this.monitoringConfig.checkInterval * 60 * 1000
      );

      this.logger.info('Error monitoring started successfully');

    } catch (error) {
      this.logger.error('Failed to start error monitoring', { error });
      throw error;
    }
  }

  /**
   * Stop error monitoring
   */
  async stopMonitoring(): Promise<void> {
    try {
      this.logger.info('Stopping error monitoring');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      this.logger.info('Error monitoring stopped');

    } catch (error) {
      this.logger.error('Failed to stop error monitoring', { error });
      throw error;
    }
  }

  /**
   * Get current monitoring metrics
   */
  async getCurrentMetrics(): Promise<MonitoringMetrics> {
    try {
      const now = new Date();
      const timeWindow = new Date(now.getTime() - 60 * 60 * 1000); // Last hour

      const statistics = await this.databaseProvider.getErrorStatistics({
        from: timeWindow,
        to: now
      });

      const metrics: MonitoringMetrics = {
        timestamp: now,
        errorRate: statistics.totalErrors / 1, // errors per hour
        criticalErrorsCount: statistics.errorsBySeverity.get('CRITICAL') || 0,
        resolutionRate: statistics.resolutionRate * 100,
        averageResolutionTime: statistics.averageResolutionTime,
        systemAvailability: this.calculateSystemAvailability(statistics),
        activeAlertsCount: this.activeAlerts.size,
        degradationLevel: this.assessDegradationLevel(statistics)
      };

      this.lastMetrics = metrics;
      return metrics;

    } catch (error) {
      this.logger.error('Failed to get current metrics', { error });
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'ACTIVE')
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      const updatedAlert: MonitoringAlert = {
        ...alert,
        status: 'ACKNOWLEDGED',
        acknowledgedBy,
        acknowledgedAt: new Date()
      };

      this.activeAlerts.set(alertId, updatedAlert);

      this.logger.info('Alert acknowledged', {
        alertId,
        acknowledgedBy,
        severity: alert.severity
      });

    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { error, alertId, acknowledgedBy });
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      const updatedAlert: MonitoringAlert = {
        ...alert,
        status: 'RESOLVED',
        resolvedAt: new Date()
      };

      this.activeAlerts.set(alertId, updatedAlert);

      this.logger.info('Alert resolved', {
        alertId,
        severity: alert.severity,
        duration: Date.now() - alert.triggeredAt.getTime()
      });

    } catch (error) {
      this.logger.error('Failed to resolve alert', { error, alertId });
      throw error;
    }
  }

  /**
   * Update monitoring configuration
   */
  async updateConfiguration(config: Partial<MonitoringConfiguration>): Promise<void> {
    try {
      this.logger.info('Updating monitoring configuration', { config });

      const wasEnabled = this.monitoringConfig.enabled;
      this.monitoringConfig = {
        ...this.monitoringConfig,
        ...config
      };

      // Restart monitoring if configuration changed
      if (wasEnabled && !this.monitoringConfig.enabled) {
        await this.stopMonitoring();
      } else if (!wasEnabled && this.monitoringConfig.enabled) {
        await this.startMonitoring();
      } else if (this.monitoringConfig.enabled && this.monitoringInterval) {
        // Restart with new interval if changed
        if (config.checkInterval) {
          await this.stopMonitoring();
          await this.startMonitoring();
        }
      }

      this.logger.info('Monitoring configuration updated successfully');

    } catch (error) {
      this.logger.error('Failed to update monitoring configuration', { error });
      throw error;
    }
  }

  /**
   * Detect system degradation
   */
  async detectSystemDegradation(): Promise<SystemDegradationAlert | null> {
    try {
      if (!this.monitoringConfig.degradationDetection) {
        return null;
      }

      const metrics = await this.getCurrentMetrics();

      // Analyze degradation indicators
      const indicators = this.analyzeDegradationIndicators(metrics);

      if (indicators.severity === 'NONE') {
        return null;
      }

      const degradationAlert: SystemDegradationAlert = {
        id: `degradation-${Date.now()}`,
        detectedAt: new Date(),
        severity: indicators.severity as SystemDegradationAlert['severity'],
        affectedComponents: indicators.affectedComponents,
        symptoms: indicators.symptoms,
        estimatedImpact: {
          usersAffected: this.estimateAffectedUsers(metrics),
          operationsImpacted: indicators.operationsImpacted,
          estimatedDowntime: this.estimateDowntime(metrics)
        },
        recommendedActions: this.generateDegradationRecommendations(indicators),
        status: 'DETECTING'
      };

      this.logger.warn('System degradation detected', {
        degradationId: degradationAlert.id,
        severity: degradationAlert.severity,
        affectedComponents: degradationAlert.affectedComponents
      });

      return degradationAlert;

    } catch (error) {
      this.logger.error('Failed to detect system degradation', { error });
      return null;
    }
  }

  private async performMonitoringCheck(): Promise<void> {
    try {
      this.logger.debug('Performing monitoring check');

      const metrics = await this.getCurrentMetrics();

      // Check each threshold
      for (const threshold of this.monitoringConfig.thresholds) {
        if (!threshold.enabled) continue;

        const currentValue = this.getMetricValue(metrics, threshold.metric);
        const isThresholdExceeded = this.checkThreshold(currentValue, threshold);

        if (isThresholdExceeded) {
          await this.triggerAlert(threshold, currentValue, metrics);
        }
      }

      // Check for system degradation
      if (this.monitoringConfig.degradationDetection) {
        const degradation = await this.detectSystemDegradation();
        if (degradation) {
          await this.handleSystemDegradation(degradation);
        }
      }

      // Clean up resolved alerts
      await this.cleanupResolvedAlerts();

    } catch (error) {
      this.logger.error('Error during monitoring check', { error });
    }
  }

  private async triggerAlert(
    threshold: MonitoringThreshold,
    currentValue: number,
    metrics: MonitoringMetrics
  ): Promise<void> {
    try {
      // Check if alert already exists for this threshold
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.thresholdId === threshold.id && alert.status === 'ACTIVE');

      if (existingAlert) {
        this.logger.debug('Alert already active for threshold', { thresholdId: threshold.id });
        return;
      }

      const alert: MonitoringAlert = {
        id: `alert-${threshold.id}-${Date.now()}`,
        thresholdId: threshold.id,
        triggeredAt: new Date(),
        severity: threshold.severity,
        metric: threshold.metric,
        currentValue,
        thresholdValue: threshold.threshold,
        message: this.generateAlertMessage(threshold, currentValue),
        context: {
          metrics,
          timeWindow: threshold.timeWindow
        },
        status: 'ACTIVE'
      };

      this.activeAlerts.set(alert.id, alert);

      this.logger.warn('Alert triggered', {
        alertId: alert.id,
        thresholdId: threshold.id,
        severity: alert.severity,
        metric: threshold.metric,
        currentValue,
        threshold: threshold.threshold
      });

      // Send alert notifications
      if (this.monitoringConfig.alertingEnabled) {
        await this.sendAlertNotifications(alert, threshold);
      }

    } catch (error) {
      this.logger.error('Failed to trigger alert', { error, thresholdId: threshold.id });
    }
  }

  private async sendAlertNotifications(
    alert: MonitoringAlert,
    threshold: MonitoringThreshold
  ): Promise<void> {
    try {
      for (const channel of threshold.alertChannels) {
        if (!channel.enabled) continue;

        switch (channel.type) {
          case 'EMAIL':
            await this.sendEmailAlert(alert, channel.target);
            break;
          case 'SLACK':
            await this.sendSlackAlert(alert, channel.target);
            break;
          case 'WEBHOOK':
            await this.sendWebhookAlert(alert, channel.target);
            break;
          case 'NOTIFICATION':
            await this.sendNotificationAlert(alert);
            break;
          default:
            this.logger.warn('Unsupported alert channel type', { type: channel.type });
        }
      }

    } catch (error) {
      this.logger.error('Failed to send alert notifications', { error, alertId: alert.id });
    }
  }

  private async sendEmailAlert(alert: MonitoringAlert, email: string): Promise<void> {
    // Mock implementation - in production, integrate with email service
    this.logger.info('Email alert sent', { alertId: alert.id, email });
  }

  private async sendSlackAlert(alert: MonitoringAlert, webhook: string): Promise<void> {
    // Mock implementation - in production, send to Slack webhook
    this.logger.info('Slack alert sent', { alertId: alert.id, webhook });
  }

  private async sendWebhookAlert(alert: MonitoringAlert, url: string): Promise<void> {
    // Mock implementation - in production, send HTTP POST to webhook
    this.logger.info('Webhook alert sent', { alertId: alert.id, url });
  }

  private async sendNotificationAlert(alert: MonitoringAlert): Promise<void> {
    // Mock implementation - in production, integrate with notification system
    this.logger.info('Notification alert sent', { alertId: alert.id });
  }

  private getMetricValue(metrics: MonitoringMetrics, metric: string): number {
    switch (metric) {
      case 'ERROR_RATE':
        return metrics.errorRate;
      case 'CRITICAL_ERRORS':
        return metrics.criticalErrorsCount;
      case 'RESOLUTION_RATE':
        return metrics.resolutionRate;
      case 'FAILURE_RATE':
        return 100 - metrics.systemAvailability;
      default:
        return 0;
    }
  }

  private checkThreshold(currentValue: number, threshold: MonitoringThreshold): boolean {
    switch (threshold.metric) {
      case 'ERROR_RATE':
      case 'CRITICAL_ERRORS':
      case 'FAILURE_RATE':
        return currentValue > threshold.threshold;
      case 'RESOLUTION_RATE':
        return currentValue < threshold.threshold;
      default:
        return false;
    }
  }

  private generateAlertMessage(threshold: MonitoringThreshold, currentValue: number): string {
    const formattedValue = threshold.metric.includes('RATE') ?
      `${currentValue.toFixed(1)}%` : currentValue.toString();

    const formattedThreshold = threshold.metric.includes('RATE') ?
      `${threshold.threshold}%` : threshold.threshold.toString();

    return `${threshold.name}: ${formattedValue} ${this.getThresholdComparison(threshold.metric)} ${formattedThreshold}`;
  }

  private getThresholdComparison(metric: string): string {
    switch (metric) {
      case 'ERROR_RATE':
      case 'CRITICAL_ERRORS':
      case 'FAILURE_RATE':
        return 'exceeds threshold of';
      case 'RESOLUTION_RATE':
        return 'below threshold of';
      default:
        return 'vs threshold of';
    }
  }

  private calculateSystemAvailability(statistics: any): number {
    // Simplified calculation - in production, use more sophisticated metrics
    const errorImpact = (statistics.totalErrors || 0) / 100;
    const criticalImpact = (statistics.errorsBySeverity.get('CRITICAL') || 0) * 5;
    return Math.max(0, 100 - errorImpact - criticalImpact);
  }

  private assessDegradationLevel(statistics: any): MonitoringMetrics['degradationLevel'] {
    const criticalErrors = statistics.errorsBySeverity.get('CRITICAL') || 0;
    const highErrors = statistics.errorsBySeverity.get('HIGH') || 0;
    const resolutionRate = statistics.resolutionRate;

    if (criticalErrors > 10 || resolutionRate < 0.5) {
      return 'CRITICAL';
    } else if (criticalErrors > 5 || highErrors > 20 || resolutionRate < 0.7) {
      return 'SEVERE';
    } else if (criticalErrors > 2 || highErrors > 10 || resolutionRate < 0.8) {
      return 'MODERATE';
    } else if (criticalErrors > 0 || highErrors > 5 || resolutionRate < 0.9) {
      return 'MINOR';
    } else {
      return 'NONE';
    }
  }

  private analyzeDegradationIndicators(metrics: MonitoringMetrics) {
    const indicators = {
      severity: 'NONE',
      affectedComponents: [] as string[],
      symptoms: [] as string[],
      operationsImpacted: [] as string[]
    };

    if (metrics.criticalErrorsCount > 5) {
      indicators.severity = 'SEVERE';
      indicators.affectedComponents.push('Critical System Components');
      indicators.symptoms.push(`${metrics.criticalErrorsCount} critical errors detected`);
      indicators.operationsImpacted.push('Core Operations');
    }

    if (metrics.errorRate > 10) {
      indicators.severity = indicators.severity === 'NONE' ? 'MODERATE' : indicators.severity;
      indicators.affectedComponents.push('Error Management System');
      indicators.symptoms.push(`High error rate: ${metrics.errorRate.toFixed(1)} errors/hour`);
      indicators.operationsImpacted.push('All Operations');
    }

    if (metrics.resolutionRate < 70) {
      indicators.severity = indicators.severity === 'NONE' ? 'MINOR' : indicators.severity;
      indicators.affectedComponents.push('Resolution Process');
      indicators.symptoms.push(`Low resolution rate: ${metrics.resolutionRate.toFixed(1)}%`);
      indicators.operationsImpacted.push('Error Recovery');
    }

    return indicators;
  }

  private estimateAffectedUsers(metrics: MonitoringMetrics): number {
    // Simplified estimation - in production, use actual user metrics
    return Math.floor(metrics.criticalErrorsCount * 10 + metrics.errorRate * 5);
  }

  private estimateDowntime(metrics: MonitoringMetrics): number {
    // Simplified estimation - in production, use historical data
    return metrics.criticalErrorsCount * 5 + (metrics.errorRate > 10 ? 15 : 0);
  }

  private generateDegradationRecommendations(indicators: any): string[] {
    const recommendations = [];

    if (indicators.affectedComponents.includes('Critical System Components')) {
      recommendations.push('Immediately investigate all critical errors');
      recommendations.push('Consider activating incident response team');
    }

    if (indicators.affectedComponents.includes('Error Management System')) {
      recommendations.push('Scale up error processing capacity');
      recommendations.push('Review system resource utilization');
    }

    if (indicators.affectedComponents.includes('Resolution Process')) {
      recommendations.push('Review manual resolution processes');
      recommendations.push('Activate additional support resources');
    }

    return recommendations;
  }

  private async handleSystemDegradation(degradation: SystemDegradationAlert): Promise<void> {
    this.logger.error('System degradation detected', {
      degradationId: degradation.id,
      severity: degradation.severity,
      affectedComponents: degradation.affectedComponents,
      estimatedImpact: degradation.estimatedImpact
    });

    // In production, this would trigger incident response procedures
  }

  private async cleanupResolvedAlerts(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.status === 'RESOLVED' && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  private getDefaultThresholds(): MonitoringThreshold[] {
    return [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds acceptable threshold',
        metric: 'ERROR_RATE',
        threshold: 10, // 10 errors per hour
        timeWindow: 60, // 1 hour
        severity: 'WARNING',
        enabled: true,
        alertChannels: [
          { type: 'NOTIFICATION', target: 'system', enabled: true }
        ]
      },
      {
        id: 'critical-errors',
        name: 'Critical Errors',
        description: 'Critical errors detected',
        metric: 'CRITICAL_ERRORS',
        threshold: 1, // Any critical error
        timeWindow: 15, // 15 minutes
        severity: 'CRITICAL',
        enabled: true,
        alertChannels: [
          { type: 'NOTIFICATION', target: 'system', enabled: true }
        ]
      },
      {
        id: 'low-resolution-rate',
        name: 'Low Resolution Rate',
        description: 'Error resolution rate below acceptable threshold',
        metric: 'RESOLUTION_RATE',
        threshold: 80, // 80%
        timeWindow: 120, // 2 hours
        severity: 'WARNING',
        enabled: true,
        alertChannels: [
          { type: 'NOTIFICATION', target: 'system', enabled: true }
        ]
      },
      {
        id: 'system-degradation',
        name: 'System Degradation',
        description: 'System availability below acceptable threshold',
        metric: 'FAILURE_RATE',
        threshold: 5, // 5% failure rate
        timeWindow: 30, // 30 minutes
        severity: 'ERROR',
        enabled: true,
        alertChannels: [
          { type: 'NOTIFICATION', target: 'system', enabled: true }
        ]
      }
    ];
  }
} 