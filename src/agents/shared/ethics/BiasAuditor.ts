/**
 * BiasAuditor.ts - Rule Executor for ethical oversight
 * 
 * This module provides:
 * - Execution of ethics rules against content
 * - Violation detection and reporting
 * - Integration with AgentMonitor for logging
 */

import { EthicsPolicy } from './EthicsPolicy';
import { AgentMonitor } from '../monitoring/AgentMonitor';

export interface EthicsViolation {
  ruleId: string;
  description: string;
  severity: string;
  snippet: string;
}

export class BiasAuditor {
  /**
   * Audit content against all ethics rules
   */
  static audit(content: string): EthicsViolation[] {
    return EthicsPolicy.flatMap(rule => {
      if (rule.test(content)) {
        return [{
          ruleId: rule.id,
          description: rule.description,
          severity: rule.severity,
          snippet: content.slice(0, 120),
        }];
      }
      return [];
    });
  }

  /**
   * Log violations to AgentMonitor
   */
  static logViolations(agentId: string, taskId: string, violations: EthicsViolation[]) {
    for (const v of violations) {
      AgentMonitor.log({
        agentId,
        taskId,
        eventType: 'error',
        timestamp: Date.now(),
        metadata: {
          type: 'ethics_violation',
          ...v
        },
      });
    }
  }

  /**
   * Check if content is likely to contain sensitive content
   */
  static containsSensitiveContent(content: string): boolean {
    const sensitivePatterns = [
      /\b(password|secret|key|token|credential)\b/i,
      /\b(ssn|social security)\b/i,
      /\b(credit card|cvv|ccv)\b/i,
      /\b(address|phone number)\b/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Get human-readable report of violations
   */
  static generateViolationReport(violations: EthicsViolation[]): string {
    if (violations.length === 0) {
      return "No ethics violations detected";
    }

    const reportLines = [
      "Ethics Violation Report:",
      "------------------------"
    ];

    // Group by severity
    const bySeverity: Record<string, EthicsViolation[]> = {};
    for (const v of violations) {
      if (!bySeverity[v.severity]) {
        bySeverity[v.severity] = [];
      }
      bySeverity[v.severity].push(v);
    }

    // Report high severity first
    for (const severity of ['high', 'medium', 'low']) {
      const violationsOfSeverity = bySeverity[severity] || [];
      if (violationsOfSeverity.length > 0) {
        reportLines.push(`\n${severity.toUpperCase()} SEVERITY (${violationsOfSeverity.length}):`);
        
        for (const v of violationsOfSeverity) {
          reportLines.push(`- ${v.description} [${v.ruleId}]`);
          reportLines.push(`  "${v.snippet.slice(0, 60)}..."`);
        }
      }
    }

    return reportLines.join('\n');
  }
} 