/**
 * DefaultEthicsManager.ts - Default Ethics Manager Implementation
 * 
 * This file provides the default ethics manager implementation with support for:
 * - Ethical compliance checking
 * - Bias auditing and detection
 * - Ethics middleware enforcement
 * - Policy management and violation tracking
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - No placeholder implementations
 * - Industry best practices with ULID IDs
 */

import { ulid } from 'ulid';
import { 
  EthicsManager, 
  EthicsManagerConfig,
  EthicsValidationResult,
  BiasAuditResult,
  AgentAction,
  AgentRequest,
  EthicsPolicy
} from '../../../../agents/shared/base/managers/EthicsManager.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';

// Import existing ethics implementations
import { EthicsPolicy as EthicsPolicyRules, EthicsRule, addEthicsRule, removeEthicsRule, updateEthicsRule } from '../../../../agents/shared/ethics/EthicsPolicy';
import { BiasAuditor, EthicsViolation } from '../../../../agents/shared/ethics/BiasAuditor';
import { enforceEthics, EthicsEnforcementOptions, EnforceEthicsResult, escalateViolation, addRuleOverride } from '../../../../agents/shared/ethics/EthicsMiddleware';

/**
 * Extended configuration for DefaultEthicsManager
 */
export interface DefaultEthicsManagerConfig extends EthicsManagerConfig {
  /**
   * Whether this manager is enabled (required by BaseManager)
   */
  enabled: boolean;
  
  /**
   * Ethics enforcement options
   */
  enforcementOptions?: Partial<EthicsEnforcementOptions>;
  
  /**
   * Whether to enable automatic escalation of critical violations
   */
  enableAutoEscalation?: boolean;
  
  /**
   * Maximum number of violations to store in memory
   */
  maxViolationHistory?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_ETHICS_MANAGER_CONFIG: DefaultEthicsManagerConfig = {
  enabled: false, // Disabled by default for backward compatibility
  enableBiasAuditing: true,
  enforceMiddleware: true,
  biasThreshold: 0.7,
  policyConfig: {
    allowOverride: false,
    blockingSeverity: 'high'
  },
  enforcementOptions: {
    blockOutput: false,
    blockThreshold: 'high',
    attemptAutoFix: false,
    ignoredRuleIds: [],
    enableEscalation: true
  },
  enableAutoEscalation: true,
  maxViolationHistory: 1000
};

/**
 * Error class for ethics-related errors
 */
export class EthicsError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ETHICS_ERROR',
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'EthicsError';
  }
}

/**
 * Default implementation of the EthicsManager interface
 */
export class DefaultEthicsManager extends AbstractBaseManager implements EthicsManager {
  public readonly managerType: ManagerType = ManagerType.ETHICS;
  
  protected violationHistory: Array<{
    id: string;
    actionId: string;
    agentId: string;
    violations: EthicsValidationResult['violations'];
    timestamp: Date;
  }> = [];
  
  protected _config: DefaultEthicsManagerConfig;
  protected _initialized: boolean = false;
  
  /**
   * Create a new DefaultEthicsManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    protected agent: AgentBase,
    config: Partial<DefaultEthicsManagerConfig> = {}
  ) {
    const managerId = `ethics-manager-${ulid()}`;
    const mergedConfig = {
      ...DEFAULT_ETHICS_MANAGER_CONFIG,
      ...config
    };
    
    super(
      managerId,
      ManagerType.ETHICS,
      agent,
      mergedConfig
    );
    
    this._config = mergedConfig;
  }

  /**
   * Get the agent this manager belongs to
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Get the current configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return { ...this._config } as T;
  }

  /**
   * Update the configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    return this._config as T;
  }

  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  /**
   * Initialize the ethics manager
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`[${this.managerId}] Initializing DefaultEthicsManager...`);
      
      if (!this._config.enabled) {
        console.log(`[${this.managerId}] Manager is disabled, skipping initialization`);
        this._initialized = true;
        return true;
      }
      
      // Clear violation history
      this.violationHistory = [];
      
      console.log(`[${this.managerId}] DefaultEthicsManager initialized successfully`);
      this._initialized = true;
      
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to initialize DefaultEthicsManager:`, error);
      return false;
    }
  }

  /**
   * Shutdown the ethics manager
   */
  async shutdown(): Promise<void> {
    try {
      console.log(`[${this.managerId}] Shutting down DefaultEthicsManager...`);
      
      // Clear violation history
      this.violationHistory = [];
      
      this._initialized = false;
      
      console.log(`[${this.managerId}] DefaultEthicsManager shutdown complete`);
    } catch (error) {
      console.error(`[${this.managerId}] Error during shutdown:`, error);
    }
  }

  /**
   * Reset the ethics manager
   */
  async reset(): Promise<boolean> {
    try {
      await this.shutdown();
      return await this.initialize();
    } catch (error) {
      console.error(`[${this.managerId}] Failed to reset DefaultEthicsManager:`, error);
      return false;
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const issues = [];
    
    // Check if manager is not enabled
    if (!this._config.enabled) {
      issues.push({
        severity: 'low' as const,
        message: 'Ethics manager is disabled',
        detectedAt: new Date()
      });
    }
    
    // Check if violation history is getting too large
    if (this.violationHistory.length > (this._config.maxViolationHistory || 1000) * 0.8) {
      issues.push({
        severity: 'medium' as const,
        message: 'Violation history approaching maximum capacity',
        detectedAt: new Date()
      });
    }
    
    return {
      status: this._initialized && this._config.enabled ? 'healthy' : 'degraded',
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          initialized: this._initialized,
          enabled: this._config.enabled,
          violationHistorySize: this.violationHistory.length,
          maxViolationHistory: this._config.maxViolationHistory
        }
      }
    };
  }

  /**
   * Check if an agent action is ethically compliant
   */
  async checkEthicalCompliance(action: AgentAction): Promise<EthicsValidationResult> {
    try {
      if (!this._config.enabled) {
        return {
          isCompliant: true,
          severity: 'none',
          violations: [],
          recommendations: [],
          shouldBlock: false
        };
      }

      console.log(`[${this.managerId}] Checking ethical compliance for action: ${action.type}`);
      
      // Use BiasAuditor to check for violations
      const content = action.content || action.description || '';
      const violations = BiasAuditor.audit(content);
      
      // Convert violations to our interface format
      const convertedViolations = violations.map(v => ({
        rule: v.ruleId,
        description: v.description,
        severity: v.severity as 'low' | 'medium' | 'high' | 'critical'
      }));
      
      // Determine overall severity
      const maxSeverity = this.getMaxSeverity(convertedViolations);
      
      // Determine if action should be blocked
      const shouldBlock = this._config.policyConfig?.blockingSeverity 
        ? this.shouldBlockBySeverity(maxSeverity, this._config.policyConfig.blockingSeverity)
        : false;
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(convertedViolations);
      
      const result: EthicsValidationResult = {
        isCompliant: convertedViolations.length === 0,
        severity: maxSeverity,
        violations: convertedViolations,
        recommendations,
        shouldBlock
      };
      
      // Log violations if any
      if (convertedViolations.length > 0) {
        await this.logViolation({
          violations: convertedViolations,
          agentId: this.agent.getId(),
          timestamp: new Date()
        });
        
        // Auto-escalate if enabled and high severity
        if (this._config.enableAutoEscalation && maxSeverity === 'high') {
          await this.escalateViolations(convertedViolations);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error(`[${this.managerId}] Error checking ethical compliance:`, error);
      throw new EthicsError(
        'Failed to check ethical compliance',
        'COMPLIANCE_CHECK_ERROR',
        { action, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Audit content for bias
   */
  async auditForBias(content: string): Promise<BiasAuditResult> {
    try {
      if (!this._config.enabled || !this._config.enableBiasAuditing) {
        return {
          biasDetected: false,
          confidence: 0,
          biasTypes: [],
          instances: [],
          overallScore: 0
        };
      }

      console.log(`[${this.managerId}] Auditing content for bias`);
      
      // Use BiasAuditor to detect violations/bias
      const violations = BiasAuditor.audit(content);
      
      // Check for sensitive content
      const hasSensitiveContent = BiasAuditor.containsSensitiveContent(content);
      
      // Convert violations to bias instances
      const instances = violations.map(v => ({
        text: v.snippet,
        biasType: v.ruleId,
        confidence: this.getSeverityConfidence(v.severity),
        suggestion: `Consider revising: ${v.description}`
      }));
      
      // Add sensitive content as bias if detected
      if (hasSensitiveContent) {
        instances.push({
          text: content.slice(0, 100),
          biasType: 'sensitive-content',
          confidence: 0.8,
          suggestion: 'Remove or redact sensitive information'
        });
      }
      
      // Calculate overall bias score
      const overallScore = instances.length > 0 
        ? instances.reduce((sum, i) => sum + i.confidence, 0) / instances.length
        : 0;
      
      // Extract unique bias types
      const biasTypes = [...new Set(instances.map(i => i.biasType))];
      
      return {
        biasDetected: instances.length > 0,
        confidence: overallScore,
        biasTypes,
        instances,
        overallScore
      };
      
    } catch (error) {
      console.error(`[${this.managerId}] Error auditing for bias:`, error);
      throw new EthicsError(
        'Failed to audit for bias',
        'BIAS_AUDIT_ERROR',
        { content: content.slice(0, 100), error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Apply ethics middleware to a request
   */
  async applyEthicsMiddleware(request: AgentRequest): Promise<AgentRequest> {
    try {
      if (!this._config.enabled || !this._config.enforceMiddleware) {
        return request;
      }

      console.log(`[${this.managerId}] Applying ethics middleware to request: ${request.id}`);
      
      // Use the existing ethics middleware
      const result: EnforceEthicsResult = await enforceEthics({
        agentId: this.agent.getId(),
        taskId: request.id,
        output: request.content,
        options: this._config.enforcementOptions
      });
      
      // Create modified request if content was changed
      const modifiedRequest: AgentRequest = {
        ...request,
        content: result.output,
        metadata: {
          ...request.metadata,
          ethicsProcessed: true,
          wasBlocked: result.wasBlocked || false,
          wasModified: result.wasModified || false,
          needsEscalation: result.needsEscalation || false,
          violations: result.violations || []
        }
      };
      
      // Escalate if needed
      if (result.needsEscalation && result.violations) {
        await escalateViolation(this.agent.getId(), request.id, result.violations);
      }
      
      return modifiedRequest;
      
    } catch (error) {
      console.error(`[${this.managerId}] Error applying ethics middleware:`, error);
      throw new EthicsError(
        'Failed to apply ethics middleware',
        'MIDDLEWARE_ERROR',
        { requestId: request.id, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get the current ethics policy
   */
  async getEthicsPolicy(): Promise<EthicsPolicy> {
    try {
      // Convert the existing EthicsPolicy rules to our interface format
      const rules = EthicsPolicyRules.map(rule => ({
        id: rule.id,
        name: rule.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: rule.description,
        severity: rule.severity as 'low' | 'medium' | 'high' | 'critical',
        enabled: true
      }));
      
      return {
        id: `ethics-policy-${ulid()}`,
        name: 'Default Ethics Policy',
        rules,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      };
      
    } catch (error) {
      console.error(`[${this.managerId}] Error getting ethics policy:`, error);
      throw new EthicsError(
        'Failed to get ethics policy',
        'POLICY_GET_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update the ethics policy
   */
  async updateEthicsPolicy(policy: Partial<EthicsPolicy>): Promise<boolean> {
    try {
      if (!this._config.enabled) {
        return false;
      }

      console.log(`[${this.managerId}] Updating ethics policy`);
      
      if (policy.rules) {
        // Update existing rules
        for (const rule of policy.rules) {
          const existingRule = EthicsPolicyRules.find(r => r.id === rule.id);
          
          if (existingRule) {
            // Update existing rule
            updateEthicsRule(rule.id, {
              description: rule.description,
              severity: rule.severity as 'low' | 'medium' | 'high'
            });
          } else if (rule.enabled) {
            // Add new rule
            addEthicsRule({
              id: rule.id,
              description: rule.description,
              severity: rule.severity as 'low' | 'medium' | 'high',
              test: (content: string) => {
                // Simple pattern-based test - in a real implementation this would be more sophisticated
                return content.toLowerCase().includes(rule.name.toLowerCase());
              }
            });
          }
        }
      }
      
      return true;
      
    } catch (error) {
      console.error(`[${this.managerId}] Error updating ethics policy:`, error);
      throw new EthicsError(
        'Failed to update ethics policy',
        'POLICY_UPDATE_ERROR',
        { policy, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Log an ethics violation
   */
  async logViolation(violation: {
    violations: EthicsValidationResult['violations'];
    agentId: string;
    timestamp: Date;
  }): Promise<boolean> {
    try {
      const violationRecord = {
        id: ulid(),
        actionId: ulid(),
        agentId: violation.agentId,
        violations: violation.violations,
        timestamp: violation.timestamp
      };
      
      // Add to memory
      this.violationHistory.push(violationRecord);
      
      // Trim history if too large
      if (this.violationHistory.length > (this._config.maxViolationHistory || 1000)) {
        this.violationHistory = this.violationHistory.slice(-this._config.maxViolationHistory!);
      }
      
      console.log(`[${this.managerId}] Logged ethics violation with ${violation.violations.length} issues`);
      
      return true;
      
    } catch (error) {
      console.error(`[${this.managerId}] Error logging violation:`, error);
      return false;
    }
  }

  /**
   * Get ethics violation history
   */
  async getViolationHistory(options: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    limit?: number;
  } = {}): Promise<Array<{
    id: string;
    actionId: string;
    agentId: string;
    violations: EthicsValidationResult['violations'];
    timestamp: Date;
  }>> {
    try {
      let filteredHistory = [...this.violationHistory];
      
      // Filter by agent ID
      if (options.agentId) {
        filteredHistory = filteredHistory.filter(v => v.agentId === options.agentId);
      }
      
      // Filter by date range
      if (options.startDate) {
        filteredHistory = filteredHistory.filter(v => v.timestamp >= options.startDate!);
      }
      
      if (options.endDate) {
        filteredHistory = filteredHistory.filter(v => v.timestamp <= options.endDate!);
      }
      
      // Filter by severity
      if (options.severity) {
        filteredHistory = filteredHistory.filter(v => 
          v.violations.some(violation => violation.severity === options.severity)
        );
      }
      
      // Apply limit
      if (options.limit) {
        filteredHistory = filteredHistory.slice(-options.limit);
      }
      
      return filteredHistory;
      
    } catch (error) {
      console.error(`[${this.managerId}] Error getting violation history:`, error);
      return [];
    }
  }

  /**
   * Helper method to get maximum severity from violations
   */
  protected getMaxSeverity(violations: EthicsValidationResult['violations']): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'none';
    
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const maxSeverityIndex = Math.max(...violations.map(v => severityOrder.indexOf(v.severity)));
    
    return severityOrder[maxSeverityIndex] as 'low' | 'medium' | 'high' | 'critical';
  }

  /**
   * Helper method to determine if action should be blocked based on severity
   */
  protected shouldBlockBySeverity(severity: string, threshold: string): boolean {
    const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
    const severityIndex = severityOrder.indexOf(severity);
    const thresholdIndex = severityOrder.indexOf(threshold);
    
    return severityIndex >= thresholdIndex;
  }

  /**
   * Helper method to generate recommendations based on violations
   */
  protected generateRecommendations(violations: EthicsValidationResult['violations']): string[] {
    const recommendations: string[] = [];
    
    for (const violation of violations) {
      switch (violation.rule) {
        case 'bias-gender':
          recommendations.push('Consider using more inclusive language that avoids gender stereotypes');
          break;
        case 'unbalanced-advice':
          recommendations.push('Include both benefits and risks when providing advice');
          break;
        case 'opinion-as-fact':
          recommendations.push('Clearly distinguish between facts and opinions');
          break;
        case 'gdpr-violation':
          recommendations.push('Remove or redact personal data');
          break;
        default:
          recommendations.push(`Address violation: ${violation.description}`);
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Helper method to convert severity to confidence score
   */
  protected getSeverityConfidence(severity: string): number {
    switch (severity) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 0.9;
      default: return 0.5;
    }
  }

  /**
   * Helper method to escalate violations
   */
  protected async escalateViolations(violations: EthicsValidationResult['violations']): Promise<void> {
    try {
      // Convert to EthicsViolation format for escalation
      const ethicsViolations: EthicsViolation[] = violations.map(v => ({
        ruleId: v.rule,
        description: v.description,
        severity: v.severity,
        snippet: v.description.slice(0, 120)
      }));
      
      await escalateViolation(this.agent.getId(), ulid(), ethicsViolations);
      
    } catch (error) {
      console.error(`[${this.managerId}] Error escalating violations:`, error);
    }
  }
} 