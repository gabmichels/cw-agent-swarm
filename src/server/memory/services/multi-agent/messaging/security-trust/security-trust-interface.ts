/**
 * Security and Trust Layer Interface
 * 
 * This module defines interfaces for the security and trust layer in the multi-agent system,
 * providing authentication, authorization, and trust management between agents.
 */

import { StructuredId } from '../../../../../../utils/ulid';

/**
 * Authentication result for agent-to-agent communication
 */
export interface AuthenticationResult {
  isAuthenticated: boolean;
  agentId: string;
  timestamp: number;
  authMethod: AuthenticationMethod;
  expiresAt?: number;
  credentials?: Record<string, unknown>;
  errors?: AuthenticationError[];
}

/**
 * Authentication methods supported by the system
 */
export enum AuthenticationMethod {
  API_KEY = 'api_key',
  JWT = 'jwt',
  CAPABILITY_TOKEN = 'capability_token',
  MUTUAL_TLS = 'mutual_tls',
  SHARED_SECRET = 'shared_secret',
  TRUST_CHAIN = 'trust_chain'
}

/**
 * Authentication error
 */
export interface AuthenticationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Authorization result for agent operations
 */
export interface AuthorizationResult {
  isAuthorized: boolean;
  agentId: string;
  operation: string;
  resource: string;
  timestamp: number;
  expiresAt?: number;
  permissions?: string[];
  errors?: AuthorizationError[];
}

/**
 * Authorization error
 */
export interface AuthorizationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Trust level between agents
 */
export enum TrustLevel {
  UNTRUSTED = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  FULL = 4
}

/**
 * Trust relationship between two agents
 */
export interface TrustRelationship {
  sourceAgentId: string;
  targetAgentId: string;
  trustLevel: TrustLevel;
  establishedAt: number;
  expiresAt?: number;
  context?: string[];
  verificationMethod?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Security policy for agent communication
 */
export interface SecurityPolicy {
  id: string;
  name: string;
  description?: string;
  requiredTrustLevel: TrustLevel;
  allowedAuthMethods: AuthenticationMethod[];
  requiredCapabilities?: string[];
  resourceRestrictions?: ResourceRestriction[];
  rateLimit?: RateLimit;
  dataClassifications?: string[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Resource restriction in a security policy
 */
export interface ResourceRestriction {
  resourceType: string;
  resourceId?: string;
  allowedOperations: string[];
  deniedOperations?: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  maxRequests: number;
  timeWindowMs: number;
  perResource?: boolean;
}

/**
 * Interface for the security and trust service
 */
export interface ISecurityTrustService {
  /**
   * Authenticate an agent for communication
   * 
   * @param agentId ID of the agent to authenticate
   * @param credentials Authentication credentials
   * @param authMethod Authentication method to use
   * @returns Authentication result
   */
  authenticateAgent(
    agentId: string,
    credentials: Record<string, unknown>,
    authMethod: AuthenticationMethod
  ): Promise<AuthenticationResult>;

  /**
   * Authorize an operation by an agent on a resource
   * 
   * @param agentId ID of the agent requesting authorization
   * @param operation Operation to perform
   * @param resource Resource to operate on
   * @param context Additional context for authorization decision
   * @returns Authorization result
   */
  authorizeOperation(
    agentId: string,
    operation: string,
    resource: string,
    context?: Record<string, unknown>
  ): Promise<AuthorizationResult>;

  /**
   * Establish a trust relationship between two agents
   * 
   * @param sourceAgentId ID of the source agent
   * @param targetAgentId ID of the target agent
   * @param trustLevel Trust level to establish
   * @param context Context for the trust relationship
   * @returns The established trust relationship
   */
  establishTrust(
    sourceAgentId: string,
    targetAgentId: string,
    trustLevel: TrustLevel,
    context?: Record<string, unknown>
  ): Promise<TrustRelationship>;

  /**
   * Get the trust relationship between two agents
   * 
   * @param sourceAgentId ID of the source agent
   * @param targetAgentId ID of the target agent
   * @returns The trust relationship or null if none exists
   */
  getTrustRelationship(
    sourceAgentId: string,
    targetAgentId: string
  ): Promise<TrustRelationship | null>;

  /**
   * Update the trust level between two agents
   * 
   * @param sourceAgentId ID of the source agent
   * @param targetAgentId ID of the target agent
   * @param trustLevel New trust level
   * @param context Context for the trust update
   * @returns The updated trust relationship
   */
  updateTrustLevel(
    sourceAgentId: string,
    targetAgentId: string,
    trustLevel: TrustLevel,
    context?: Record<string, unknown>
  ): Promise<TrustRelationship>;

  /**
   * Create a security policy
   * 
   * @param policy Security policy to create
   * @returns The created security policy
   */
  createSecurityPolicy(
    policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SecurityPolicy>;

  /**
   * Get a security policy by ID
   * 
   * @param policyId ID of the policy to retrieve
   * @returns The security policy or null if not found
   */
  getSecurityPolicy(
    policyId: string
  ): Promise<SecurityPolicy | null>;

  /**
   * Apply a security policy to an agent
   * 
   * @param agentId ID of the agent
   * @param policyId ID of the security policy
   * @returns Success status
   */
  applySecurityPolicy(
    agentId: string,
    policyId: string
  ): Promise<boolean>;

  /**
   * Validate a message against security policies
   * 
   * @param senderId ID of the sender agent
   * @param recipientId ID of the recipient agent
   * @param messageContent Message content to validate
   * @param context Additional context for validation
   * @returns Validation result
   */
  validateMessage(
    senderId: string,
    recipientId: string,
    messageContent: string | Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<{
    isValid: boolean;
    errors?: string[];
  }>;
} 