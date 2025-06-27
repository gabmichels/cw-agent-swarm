/**
 * Error Reporting Service
 * 
 * Generates comprehensive error reports, system health summaries,
 * and performance impact analysis.
 * 
 * Phase 6.2 of the error communication implementation.
 */

import { ILogger } from '../../lib/core/logger';
import { ErrorSeverity, ErrorStatus, ErrorType } from '../../lib/errors/types/BaseError';
import {
  ErrorSearchCriteria,
  ErrorStatistics,
  IErrorDatabaseProvider
} from './interfaces/IErrorManagementService';

export interface ErrorReport {
  readonly id: string;
  readonly title: string;
  readonly generatedAt: Date;
  readonly period: {
    readonly from: Date;
    readonly to: Date;
  };
  readonly summary: ErrorReportSummary;
  readonly details: ErrorReportDetails;
  readonly recommendations: ErrorRecommendation[];
  readonly metadata: Record<string, unknown>;
}

export interface ErrorReportSummary {
  readonly totalErrors: number;
  readonly newErrors: number;
  readonly resolvedErrors: number;
  readonly criticalErrors: number;
  readonly resolutionRate: number;
  readonly averageResolutionTime: number;
  readonly systemHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  readonly trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface ErrorReportDetails {
  readonly errorsByType: Array<{ type: string; count: number; percentage: number }>;
  readonly errorsBySeverity: Array<{ severity: string; count: number; percentage: number }>;
  readonly errorsByAgent: Array<{ agentId: string; count: number; percentage: number }>;
  readonly topFailingOperations: Array<{ operation: string; count: number; percentage: number }>;
  readonly errorPatterns: Array<{ pattern: string; occurrences: number; description: string }>;
  readonly performanceImpact: {
    readonly affectedUsers: number;
    readonly estimatedDowntime: number; // in minutes
    readonly operationsDelayed: number;
    readonly costImpact?: number; // in USD
  };
}

export interface ErrorRecommendation {
  readonly id: string;
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly category: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM';
  readonly title: string;
  readonly description: string;
  readonly actionItems: string[];
  readonly estimatedImpact: string;
  readonly basedOn: string[];
}

export interface ReportGenerationOptions {
  readonly reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  readonly from?: Date;
  readonly to?: Date;
  readonly includePatterns?: boolean;
  readonly includeRecommendations?: boolean;
  readonly includePerformanceImpact?: boolean;
  readonly agentFilter?: string[];
  readonly severityFilter?: string[];
  readonly format?: 'JSON' | 'PDF' | 'CSV' | 'HTML';
}

export interface SystemHealthReport {
  readonly timestamp: Date;
  readonly overallHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  readonly errorRate: number; // errors per hour
  readonly resolutionEfficiency: number; // percentage
  readonly criticalIssuesCount: number;
  readonly systemAvailability: number; // percentage
  readonly alerts: SystemAlert[];
  readonly trends: {
    readonly last24h: HealthTrend;
    readonly last7d: HealthTrend;
    readonly last30d: HealthTrend;
  };
}

export interface SystemAlert {
  readonly id: string;
  readonly level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  readonly message: string;
  readonly component: string;
  readonly timestamp: Date;
  readonly actionRequired: boolean;
}

export interface HealthTrend {
  readonly direction: 'UP' | 'DOWN' | 'STABLE';
  readonly change: number; // percentage change
  readonly significance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT';
}

export class DefaultErrorReportingService {
  constructor(
    private readonly logger: ILogger,
    private readonly databaseProvider: IErrorDatabaseProvider
  ) { }

  /**
   * Generate a comprehensive error report
   */
  async generateErrorReport(options: ReportGenerationOptions): Promise<ErrorReport> {
    try {
      this.logger.info('Generating error report', { options });

      const { from, to } = this.calculateReportPeriod(options);

      // Build search criteria
      const criteria: ErrorSearchCriteria = {
        fromDate: from,
        toDate: to,
        ...(options.agentFilter && { agentId: options.agentFilter[0] }),
        ...(options.severityFilter && { severity: options.severityFilter[0] as ErrorSeverity })
      };

      // Fetch error statistics and data
      const [statistics, errors] = await Promise.all([
        this.databaseProvider.getErrorStatistics(criteria),
        this.databaseProvider.searchErrors(criteria)
      ]);

      // Generate report sections
      const summary = this.generateReportSummary(statistics, from, to);
      const details = await this.generateReportDetails(statistics, Array.from(errors), options);
      const recommendations = options.includeRecommendations ?
        await this.generateRecommendations(statistics, Array.from(errors)) : [];

      const report: ErrorReport = {
        id: `report-${Date.now()}`,
        title: `Error Report - ${this.formatReportTitle(options.reportType, from, to)}`,
        generatedAt: new Date(),
        period: { from, to },
        summary,
        details,
        recommendations,
        metadata: {
          reportType: options.reportType,
          generationOptions: options,
          dataPoints: errors.length
        }
      };

      this.logger.info('Error report generated successfully', {
        reportId: report.id,
        totalErrors: summary.totalErrors,
        recommendations: recommendations.length
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to generate error report', { error, options });
      throw error;
    }
  }

  /**
   * Generate system health report
   */
  async generateSystemHealthReport(): Promise<SystemHealthReport> {
    try {
      this.logger.info('Generating system health report');

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch statistics for different time periods
      const [stats24h, stats7d, stats30d] = await Promise.all([
        this.databaseProvider.getErrorStatistics({ fromDate: last24h, toDate: now }),
        this.databaseProvider.getErrorStatistics({ fromDate: last7d, toDate: now }),
        this.databaseProvider.getErrorStatistics({ fromDate: last30d, toDate: now })
      ]);

      // Calculate health metrics
      const errorRate = stats24h.totalErrors / 24; // errors per hour
      const resolutionEfficiency = stats24h.resolutionRate * 100;
      const criticalIssuesCount = stats24h.errorsBySeverity.get(ErrorSeverity.CRITICAL) || 0;

      // Determine overall health
      const overallHealth = this.calculateOverallHealth(
        errorRate,
        resolutionEfficiency,
        criticalIssuesCount
      );

      // Generate alerts
      const alerts = this.generateSystemAlerts(
        errorRate,
        resolutionEfficiency,
        criticalIssuesCount,
        stats24h
      );

      // Calculate trends
      const trends = {
        last24h: this.calculateHealthTrend(stats24h, 'day'),
        last7d: this.calculateHealthTrend(stats7d, 'week'),
        last30d: this.calculateHealthTrend(stats30d, 'month')
      };

      const healthReport: SystemHealthReport = {
        timestamp: now,
        overallHealth,
        errorRate,
        resolutionEfficiency,
        criticalIssuesCount,
        systemAvailability: Math.max(0, 100 - (errorRate * 2)), // Simplified calculation
        alerts,
        trends
      };

      this.logger.info('System health report generated', {
        overallHealth,
        errorRate,
        resolutionEfficiency,
        alertsCount: alerts.length
      });

      return healthReport;

    } catch (error) {
      this.logger.error('Failed to generate system health report', { error });
      throw error;
    }
  }

  /**
   * Export report in specified format
   */
  async exportReport(report: ErrorReport, format: 'JSON' | 'CSV' | 'HTML'): Promise<string> {
    try {
      this.logger.info('Exporting report', { reportId: report.id, format });

      switch (format) {
        case 'JSON':
          return JSON.stringify(report, null, 2);

        case 'CSV':
          return this.convertReportToCSV(report);

        case 'HTML':
          return this.convertReportToHTML(report);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      this.logger.error('Failed to export report', { error, reportId: report.id, format });
      throw error;
    }
  }

  private calculateReportPeriod(options: ReportGenerationOptions): { from: Date; to: Date } {
    const now = new Date();

    if (options.from && options.to) {
      return { from: options.from, to: options.to };
    }

    switch (options.reportType) {
      case 'DAILY':
        return {
          from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          to: now
        };
      case 'WEEKLY':
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          to: now
        };
      case 'MONTHLY':
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: now
        };
      default:
        return {
          from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          to: now
        };
    }
  }

  private generateReportSummary(
    statistics: ErrorStatistics,
    from: Date,
    to: Date
  ): ErrorReportSummary {
    const newErrors = statistics.errorsByStatus.get(ErrorStatus.NEW) || 0;
    const resolvedErrors = statistics.errorsByStatus.get(ErrorStatus.RESOLVED) || 0;
    const criticalErrors = statistics.errorsBySeverity.get(ErrorSeverity.CRITICAL) || 0;

    // Calculate system health based on error rates and severity
    let systemHealth: ErrorReportSummary['systemHealth'];
    if (criticalErrors === 0 && statistics.resolutionRate > 0.95) {
      systemHealth = 'EXCELLENT';
    } else if (criticalErrors <= 2 && statistics.resolutionRate > 0.90) {
      systemHealth = 'GOOD';
    } else if (criticalErrors <= 5 && statistics.resolutionRate > 0.80) {
      systemHealth = 'FAIR';
    } else if (criticalErrors <= 10 && statistics.resolutionRate > 0.60) {
      systemHealth = 'POOR';
    } else {
      systemHealth = 'CRITICAL';
    }

    // Determine trend (simplified - would compare with previous period in real implementation)
    const trend: ErrorReportSummary['trend'] = statistics.resolutionRate > 0.85 ? 'IMPROVING' :
      statistics.resolutionRate > 0.70 ? 'STABLE' : 'DECLINING';

    return {
      totalErrors: statistics.totalErrors,
      newErrors,
      resolvedErrors,
      criticalErrors,
      resolutionRate: statistics.resolutionRate,
      averageResolutionTime: statistics.averageResolutionTime,
      systemHealth,
      trend
    };
  }

  private async generateReportDetails(
    statistics: ErrorStatistics,
    errors: any[],
    options: ReportGenerationOptions
  ): Promise<ErrorReportDetails> {
    // Convert Maps to arrays with percentages
    const errorsByType = Array.from(statistics.errorsByType.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: (count / statistics.totalErrors) * 100
    }));

    const errorsBySeverity = Array.from(statistics.errorsBySeverity.entries()).map(([severity, count]) => ({
      severity,
      count,
      percentage: (count / statistics.totalErrors) * 100
    }));

    // Analyze errors by agent
    const agentCounts = errors.reduce((acc: Record<string, number>, error: any) => {
      if (error.agentId) {
        acc[error.agentId] = (acc[error.agentId] || 0) + 1;
      }
      return acc;
    }, {});

    const errorsByAgent = Object.entries(agentCounts).map(([agentId, count]) => ({
      agentId,
      count,
      percentage: (count / statistics.totalErrors) * 100
    }));

    // Analyze operations
    const operationCounts = errors.reduce((acc: Record<string, number>, error: any) => {
      if (error.operation) {
        acc[error.operation] = (acc[error.operation] || 0) + 1;
      }
      return acc;
    }, {});

    const topFailingOperations = Object.entries(operationCounts)
      .map(([operation, count]) => ({
        operation,
        count,
        percentage: (count / statistics.totalErrors) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate patterns (simplified)
    const errorPatterns = [
      {
        pattern: 'Connection Timeout',
        occurrences: errors.filter(e => e.message.toLowerCase().includes('timeout')).length,
        description: 'Network or service timeout issues'
      },
      {
        pattern: 'Permission Denied',
        occurrences: errors.filter(e => e.message.toLowerCase().includes('permission')).length,
        description: 'Access control and authorization failures'
      },
      {
        pattern: 'Rate Limit',
        occurrences: errors.filter(e => e.message.toLowerCase().includes('rate limit')).length,
        description: 'API rate limiting issues'
      }
    ].filter(pattern => pattern.occurrences > 0);

    // Calculate performance impact
    const affectedUsers = new Set(errors.map(e => e.userId).filter(Boolean)).size;
    const estimatedDowntime = errors.reduce((total, error) => {
      return total + (error.severity === 'CRITICAL' ? 5 : error.severity === 'HIGH' ? 2 : 0.5);
    }, 0);

    const performanceImpact = {
      affectedUsers,
      estimatedDowntime,
      operationsDelayed: errors.filter(e => e.retryAttempt > 0).length
    };

    return {
      errorsByType,
      errorsBySeverity,
      errorsByAgent,
      topFailingOperations,
      errorPatterns,
      performanceImpact
    };
  }

  private async generateRecommendations(
    statistics: ErrorStatistics,
    errors: any[]
  ): Promise<ErrorRecommendation[]> {
    const recommendations: ErrorRecommendation[] = [];

    // High critical error count
    const criticalErrors = statistics.errorsBySeverity.get(ErrorSeverity.CRITICAL) || 0;
    if (criticalErrors > 5) {
      recommendations.push({
        id: 'reduce-critical-errors',
        priority: 'CRITICAL',
        category: 'IMMEDIATE',
        title: 'Address Critical Error Spike',
        description: `${criticalErrors} critical errors detected. Immediate investigation required.`,
        actionItems: [
          'Review all critical errors in the last 24 hours',
          'Identify common failure patterns',
          'Implement emergency fixes for recurring issues',
          'Set up enhanced monitoring for critical components'
        ],
        estimatedImpact: 'High - Reduces system instability and user impact',
        basedOn: ['Critical error count exceeding threshold']
      });
    }

    // Low resolution rate
    if (statistics.resolutionRate < 0.80) {
      recommendations.push({
        id: 'improve-resolution-rate',
        priority: 'HIGH',
        category: 'SHORT_TERM',
        title: 'Improve Error Resolution Process',
        description: `Resolution rate is ${(statistics.resolutionRate * 100).toFixed(1)}%, below optimal threshold.`,
        actionItems: [
          'Review manual resolution processes',
          'Implement automated recovery for common issues',
          'Provide additional training to support team',
          'Set up automated retry mechanisms'
        ],
        estimatedImpact: 'Medium - Improves system reliability and user experience',
        basedOn: ['Resolution rate below 80%']
      });
    }

    // High tool execution errors
    const toolErrors = statistics.errorsByType.get(ErrorType.TOOL_EXECUTION) || 0;
    if (toolErrors > statistics.totalErrors * 0.3) {
      recommendations.push({
        id: 'improve-tool-reliability',
        priority: 'MEDIUM',
        category: 'LONG_TERM',
        title: 'Enhance Tool Integration Reliability',
        description: `${toolErrors} tool execution errors represent ${((toolErrors / statistics.totalErrors) * 100).toFixed(1)}% of all errors.`,
        actionItems: [
          'Audit tool integration points',
          'Implement better error handling in tools',
          'Add health checks for external services',
          'Consider implementing circuit breaker patterns'
        ],
        estimatedImpact: 'Medium - Reduces tool-related failures',
        basedOn: ['High percentage of tool execution errors']
      });
    }

    return recommendations;
  }

  private calculateOverallHealth(
    errorRate: number,
    resolutionEfficiency: number,
    criticalIssuesCount: number
  ): SystemHealthReport['overallHealth'] {
    if (criticalIssuesCount === 0 && errorRate < 1 && resolutionEfficiency > 95) {
      return 'EXCELLENT';
    } else if (criticalIssuesCount <= 2 && errorRate < 3 && resolutionEfficiency > 90) {
      return 'GOOD';
    } else if (criticalIssuesCount <= 5 && errorRate < 8 && resolutionEfficiency > 80) {
      return 'FAIR';
    } else if (criticalIssuesCount <= 10 && errorRate < 15 && resolutionEfficiency > 60) {
      return 'POOR';
    } else {
      return 'CRITICAL';
    }
  }

  private generateSystemAlerts(
    errorRate: number,
    resolutionEfficiency: number,
    criticalIssuesCount: number,
    statistics: ErrorStatistics
  ): SystemAlert[] {
    const alerts: SystemAlert[] = [];
    const now = new Date();

    if (errorRate > 10) {
      alerts.push({
        id: `alert-high-error-rate-${Date.now()}`,
        level: 'ERROR',
        message: `High error rate detected: ${errorRate.toFixed(1)} errors/hour`,
        component: 'Error Management System',
        timestamp: now,
        actionRequired: true
      });
    }

    if (criticalIssuesCount > 0) {
      alerts.push({
        id: `alert-critical-errors-${Date.now()}`,
        level: 'CRITICAL',
        message: `${criticalIssuesCount} critical errors require immediate attention`,
        component: 'System Health Monitor',
        timestamp: now,
        actionRequired: true
      });
    }

    if (resolutionEfficiency < 70) {
      alerts.push({
        id: `alert-low-resolution-${Date.now()}`,
        level: 'WARNING',
        message: `Low resolution efficiency: ${resolutionEfficiency.toFixed(1)}%`,
        component: 'Error Resolution Process',
        timestamp: now,
        actionRequired: true
      });
    }

    return alerts;
  }

  private calculateHealthTrend(statistics: ErrorStatistics, period: 'day' | 'week' | 'month'): HealthTrend {
    // Simplified trend calculation - in real implementation, compare with previous period
    const score = statistics.resolutionRate * 100 - (statistics.totalErrors / 10);

    let direction: HealthTrend['direction'];
    let significance: HealthTrend['significance'];

    if (score > 85) {
      direction = 'UP';
      significance = 'MINOR';
    } else if (score > 70) {
      direction = 'STABLE';
      significance = 'MINOR';
    } else {
      direction = 'DOWN';
      significance = score < 50 ? 'SIGNIFICANT' : 'MODERATE';
    }

    return {
      direction,
      change: Math.abs(score - 75), // Baseline of 75
      significance
    };
  }

  private formatReportTitle(reportType: string, from: Date, to: Date): string {
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    switch (reportType) {
      case 'DAILY':
        return `Daily Report - ${toStr}`;
      case 'WEEKLY':
        return `Weekly Report - ${fromStr} to ${toStr}`;
      case 'MONTHLY':
        return `Monthly Report - ${fromStr} to ${toStr}`;
      default:
        return `Custom Report - ${fromStr} to ${toStr}`;
    }
  }

  private convertReportToCSV(report: ErrorReport): string {
    const lines = [
      'Error Report CSV Export',
      `Generated: ${report.generatedAt.toISOString()}`,
      `Period: ${report.period.from.toISOString()} to ${report.period.to.toISOString()}`,
      '',
      'Summary',
      `Total Errors,${report.summary.totalErrors}`,
      `New Errors,${report.summary.newErrors}`,
      `Resolved Errors,${report.summary.resolvedErrors}`,
      `Critical Errors,${report.summary.criticalErrors}`,
      `Resolution Rate,${(report.summary.resolutionRate * 100).toFixed(1)}%`,
      `Average Resolution Time,${report.summary.averageResolutionTime}h`,
      `System Health,${report.summary.systemHealth}`,
      '',
      'Errors by Type',
      'Type,Count,Percentage',
      ...report.details.errorsByType.map(item =>
        `${item.type},${item.count},${item.percentage.toFixed(1)}%`
      )
    ];

    return lines.join('\n');
  }

  private convertReportToHTML(report: ErrorReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p>Generated: ${report.generatedAt.toLocaleDateString()}</p>
        <p>Period: ${report.period.from.toLocaleDateString()} - ${report.period.to.toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="summary">
            <div class="metric">
                <h3>Total Errors</h3>
                <p>${report.summary.totalErrors}</p>
            </div>
            <div class="metric">
                <h3>Resolution Rate</h3>
                <p>${(report.summary.resolutionRate * 100).toFixed(1)}%</p>
            </div>
            <div class="metric">
                <h3>System Health</h3>
                <p>${report.summary.systemHealth}</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Errors by Type</h2>
        <table>
            <tr><th>Type</th><th>Count</th><th>Percentage</th></tr>
            ${report.details.errorsByType.map(item =>
      `<tr><td>${item.type}</td><td>${item.count}</td><td>${item.percentage.toFixed(1)}%</td></tr>`
    ).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        ${report.recommendations.map(rec =>
      `<div style="margin: 15px 0; padding: 15px; border-left: 4px solid #007cba;">
             <h3>${rec.title} (${rec.priority})</h3>
             <p>${rec.description}</p>
             <ul>${rec.actionItems.map(item => `<li>${item}</li>`).join('')}</ul>
           </div>`
    ).join('')}
    </div>
</body>
</html>`;
  }
} 