/**
 * EthicsMiddleware.ts - Hook for Planning + Tools
 * 
 * This module provides:
 * - Ethics enforcement layer for agent outputs
 * - Integration points for Planner and ToolRouter
 * - Override mechanisms for false positives
 * - Support for escalation of critical violations
 */

import { BiasAuditor, EthicsViolation } from './BiasAuditor';

/**
 * Configuration options for ethics enforcement
 */
export interface EthicsEnforcementOptions {
  // Whether to block output with violations (vs just logging)
  blockOutput: boolean;
  
  // Severity threshold for blocking output (if blockOutput is true)
  blockThreshold: 'low' | 'medium' | 'high';
  
  // Whether to auto-modify content to remove violations
  attemptAutoFix: boolean;
  
  // IDs of rules to ignore (for override)
  ignoredRuleIds: string[];
  
  // Whether to escalate high severity violations
  enableEscalation: boolean;
}

// Default ethics enforcement configuration
export const defaultEthicsOptions: EthicsEnforcementOptions = {
  blockOutput: false,
  blockThreshold: 'high',
  attemptAutoFix: false,
  ignoredRuleIds: [],
  enableEscalation: true
};

/**
 * Result of ethics enforcement
 */
export interface EnforceEthicsResult {
  output: string;
  violations?: EthicsViolation[];
  wasBlocked?: boolean;
  wasModified?: boolean;
  needsEscalation?: boolean;
}

/**
 * Enforce ethics rules on agent output
 */
export async function enforceEthics({
  agentId,
  taskId,
  output,
  options = defaultEthicsOptions
}: {
  agentId: string;
  taskId: string;
  output: string;
  options?: Partial<EthicsEnforcementOptions>;
}): Promise<EnforceEthicsResult> {
  // Merge provided options with defaults
  const mergedOptions: EthicsEnforcementOptions = {
    ...defaultEthicsOptions,
    ...options
  };
  
  // Skip checks for empty output
  if (!output || output.trim().length === 0) {
    return { output };
  }
  
  // Detect violations
  const violations = BiasAuditor.audit(output)
    // Filter out ignored rules
    .filter(v => !mergedOptions.ignoredRuleIds.includes(v.ruleId));
  
  // If no violations, return immediately
  if (violations.length === 0) {
    return { output };
  }
  
  // Log all violations
  BiasAuditor.logViolations(agentId, taskId, violations);
  
  // Check if we need to block based on severity
  const hasViolationAboveThreshold = violations.some(v => {
    const severityMap = { 'low': 1, 'medium': 2, 'high': 3 };
    const thresholdValue = severityMap[mergedOptions.blockThreshold];
    const violationValue = severityMap[v.severity as 'low' | 'medium' | 'high'];
    return violationValue >= thresholdValue;
  });
  
  // Determine if we need escalation
  const needsEscalation = mergedOptions.enableEscalation && 
    violations.some(v => v.severity === 'high');
  
  // Block output if configured and violations exceed threshold
  if (mergedOptions.blockOutput && hasViolationAboveThreshold) {
    return {
      output,
      violations,
      wasBlocked: true,
      needsEscalation
    };
  }
  
  // Attempt to fix output if configured
  if (mergedOptions.attemptAutoFix) {
    // Placeholder for auto-fix logic
    // In a real implementation, this would use techniques to modify the content
    // For now, we just add a disclaimer
    const modifiedOutput = `[ETHICS DISCLAIMER: This content may contain biased language or unbalanced information.]\n\n${output}`;
    
    return {
      output: modifiedOutput,
      violations,
      wasModified: true,
      needsEscalation
    };
  }
  
  // Default case: return original with violations
  return {
    output,
    violations,
    needsEscalation
  };
}

/**
 * Override specific rule for a given agent
 */
export function addRuleOverride(agentId: string, ruleId: string): void {
  // This would be connected to a persistent override registry in a real implementation
  console.log(`Added override for rule ${ruleId} for agent ${agentId}`);
}

/**
 * Escalate an ethics violation
 */
export async function escalateViolation(
  agentId: string, 
  taskId: string,
  violations: EthicsViolation[]
): Promise<void> {
  // This would connect to an escalation system in a real implementation
  console.log(`ESCALATION: Agent ${agentId}, Task ${taskId} has critical ethics violations`);
  console.log(BiasAuditor.generateViolationReport(violations));
} 