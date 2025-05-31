/**
 * EthicsManager.interface.ts - Ethics Manager Interface
 * 
 * This file defines the ethics manager interface that handles ethical governance,
 * bias auditing, and policy enforcement for agent operations.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration for the ethics manager
 */
export interface EthicsManagerConfig extends ManagerConfig {
  /** Whether to enable automatic bias auditing */
  enableBiasAuditing?: boolean;
  
  /** Whether to enforce ethics middleware on all requests */
  enforceMiddleware?: boolean;
  
  /** Threshold for bias detection (0.0-1.0) */
  biasThreshold?: number;
  
  /** Ethics policy configuration */
  policyConfig?: {
    /** Whether to allow override of ethics violations */
    allowOverride?: boolean;
    
    /** Severity level for automatic blocking */
    blockingSeverity?: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Result of ethical compliance check
 */
export interface EthicsValidationResult {
  /** Whether the action is ethically compliant */
  isCompliant: boolean;
  
  /** Severity of any violations found */
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  
  /** List of violations found */
  violations: Array<{
    rule: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  
  /** Suggested actions or corrections */
  recommendations: string[];
  
  /** Whether the action should be blocked */
  shouldBlock: boolean;
}

/**
 * Result of bias audit
 */
export interface BiasAuditResult {
  /** Whether bias was detected */
  biasDetected: boolean;
  
  /** Confidence score of bias detection (0.0-1.0) */
  confidence: number;
  
  /** Types of bias detected */
  biasTypes: string[];
  
  /** Specific instances of bias found */
  instances: Array<{
    text: string;
    biasType: string;
    confidence: number;
    suggestion: string;
  }>;
  
  /** Overall bias score (0.0-1.0) */
  overallScore: number;
}

/**
 * Agent action for ethics validation
 */
export interface AgentAction {
  /** Action type */
  type: string;
  
  /** Action description */
  description: string;
  
  /** Content or parameters of the action */
  content?: string;
  
  /** Target of the action */
  target?: string;
  
  /** Context or metadata */
  context?: Record<string, unknown>;
}

/**
 * Agent request for ethics middleware
 */
export interface AgentRequest {
  /** Request ID */
  id: string;
  
  /** Request content */
  content: string;
  
  /** Request type */
  type: string;
  
  /** User ID making the request */
  userId?: string;
  
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Ethics policy interface
 */
export interface EthicsPolicy {
  /** Policy ID */
  id: string;
  
  /** Policy name */
  name: string;
  
  /** Policy rules */
  rules: Array<{
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
  }>;
  
  /** When the policy was created */
  createdAt: Date;
  
  /** When the policy was last updated */
  updatedAt: Date;
  
  /** Policy version */
  version: string;
}

/**
 * Ethics manager interface
 */
export interface EthicsManager extends BaseManager {
  /**
   * Check if an agent action is ethically compliant
   * 
   * @param action The action to validate
   * @returns Promise resolving to validation result
   */
  checkEthicalCompliance(action: AgentAction): Promise<EthicsValidationResult>;
  
  /**
   * Audit content for bias
   * 
   * @param content The content to audit
   * @returns Promise resolving to bias audit result
   */
  auditForBias(content: string): Promise<BiasAuditResult>;
  
  /**
   * Apply ethics middleware to a request
   * 
   * @param request The request to process
   * @returns Promise resolving to processed request
   */
  applyEthicsMiddleware(request: AgentRequest): Promise<AgentRequest>;
  
  /**
   * Get the current ethics policy
   * 
   * @returns The current ethics policy
   */
  getEthicsPolicy(): Promise<EthicsPolicy>;
  
  /**
   * Update the ethics policy
   * 
   * @param policy Partial policy updates
   * @returns Promise resolving to success status
   */
  updateEthicsPolicy(policy: Partial<EthicsPolicy>): Promise<boolean>;
  
  /**
   * Log an ethics violation
   * 
   * @param violation Violation details
   * @returns Promise resolving to success status
   */
  logViolation(violation: {
    actionId: string;
    violations: EthicsValidationResult['violations'];
    agentId: string;
    timestamp: Date;
  }): Promise<boolean>;
  
  /**
   * Get ethics violation history
   * 
   * @param options Filter options
   * @returns Promise resolving to violation history
   */
  getViolationHistory(options?: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    actionId: string;
    agentId: string;
    violations: EthicsValidationResult['violations'];
    timestamp: Date;
  }>>;
} 