/**
 * CapabilityDiscovery.ts - Dynamic agent capability discovery
 * 
 * This module provides a system for discovering capabilities of other agents
 * and requesting access to those capabilities.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Capability type
 */
export enum CapabilityType {
  /**
   * Knowledge capability - access to information
   */
  KNOWLEDGE = 'knowledge',
  
  /**
   * Tool capability - ability to use a tool
   */
  TOOL = 'tool',
  
  /**
   * Processing capability - ability to process data
   */
  PROCESSING = 'processing',
  
  /**
   * Communication capability - ability to communicate with external systems
   */
  COMMUNICATION = 'communication',
  
  /**
   * Access capability - access to a resource
   */
  ACCESS = 'access'
}

/**
 * Capability access mode
 */
export enum CapabilityAccessMode {
  /**
   * Read-only access to the capability
   */
  READ = 'read',
  
  /**
   * Execute access to the capability
   */
  EXECUTE = 'execute',
  
  /**
   * Full access to the capability
   */
  FULL = 'full'
}

/**
 * Request status
 */
export enum RequestStatus {
  /**
   * Request is pending
   */
  PENDING = 'pending',
  
  /**
   * Request was approved
   */
  APPROVED = 'approved',
  
  /**
   * Request was denied
   */
  DENIED = 'denied',
  
  /**
   * Request expired
   */
  EXPIRED = 'expired'
}

/**
 * Capability metadata
 */
export interface CapabilityMetadata {
  /**
   * Name of the capability
   */
  name: string;
  
  /**
   * Description of the capability
   */
  description: string;
  
  /**
   * Type of capability
   */
  type: CapabilityType;
  
  /**
   * Schemas for inputs and outputs (if applicable)
   */
  schemas?: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  
  /**
   * Additional metadata
   */
  [key: string]: unknown;
}

/**
 * Agent capability
 */
export interface AgentCapability {
  /**
   * Unique identifier for the capability
   */
  id: string;
  
  /**
   * ID of the agent that owns this capability
   */
  agentId: string;
  
  /**
   * Metadata about the capability
   */
  metadata: CapabilityMetadata;
  
  /**
   * Whether this capability is available for discovery
   */
  discoverable: boolean;
  
  /**
   * Default access mode for the capability
   */
  defaultAccessMode: CapabilityAccessMode;
  
  /**
   * Allowed access modes for this capability
   */
  allowedAccessModes: CapabilityAccessMode[];
  
  /**
   * Function that verifies if an agent can use this capability
   */
  accessValidator?: (requestingAgentId: string, accessMode: CapabilityAccessMode) => Promise<boolean>;
}

/**
 * Capability request
 */
export interface CapabilityRequest {
  /**
   * Unique identifier for the request
   */
  id: string;
  
  /**
   * ID of the capability being requested
   */
  capabilityId: string;
  
  /**
   * ID of the agent making the request
   */
  requestingAgentId: string;
  
  /**
   * Requested access mode
   */
  requestedAccessMode: CapabilityAccessMode;
  
  /**
   * Reason for the request
   */
  reason?: string;
  
  /**
   * Context for the request
   */
  context?: Record<string, unknown>;
  
  /**
   * Current status of the request
   */
  status: RequestStatus;
  
  /**
   * When the request was created
   */
  createdAt: Date;
  
  /**
   * When the request expires
   */
  expiresAt?: Date;
  
  /**
   * When the request was responded to
   */
  respondedAt?: Date;
  
  /**
   * Reason for denial (if denied)
   */
  denialReason?: string;
  
  /**
   * Granted access mode (if approved, might be different from requested)
   */
  grantedAccessMode?: CapabilityAccessMode;
  
  /**
   * Additional constraints on the approved request
   */
  constraints?: Record<string, unknown>;
}

/**
 * Grant for a capability
 */
export interface CapabilityGrant {
  /**
   * Unique identifier for the grant
   */
  id: string;
  
  /**
   * ID of the capability
   */
  capabilityId: string;
  
  /**
   * ID of the request this grant is for
   */
  requestId: string;
  
  /**
   * ID of the agent this grant is for
   */
  grantedAgentId: string;
  
  /**
   * Access mode granted
   */
  accessMode: CapabilityAccessMode;
  
  /**
   * When the grant was created
   */
  createdAt: Date;
  
  /**
   * When the grant expires
   */
  expiresAt?: Date;
  
  /**
   * Whether the grant is active
   */
  active: boolean;
  
  /**
   * Additional constraints on the grant
   */
  constraints?: Record<string, unknown>;
}

/**
 * Capability instance - a specific capability of an agent
 */
export class CapabilityInstance {
  /**
   * The capability definition
   */
  private readonly capability: AgentCapability;
  
  /**
   * Active grants for this capability
   */
  private readonly grants: Map<string, CapabilityGrant> = new Map();
  
  /**
   * Create a new capability instance
   */
  constructor(capability: AgentCapability) {
    this.capability = capability;
  }
  
  /**
   * Get the capability ID
   */
  getId(): string {
    return this.capability.id;
  }
  
  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.capability.agentId;
  }
  
  /**
   * Get the capability metadata
   */
  getMetadata(): CapabilityMetadata {
    return this.capability.metadata;
  }
  
  /**
   * Check if the capability is discoverable
   */
  isDiscoverable(): boolean {
    return this.capability.discoverable;
  }
  
  /**
   * Check if an agent has access to this capability
   */
  async hasAccess(agentId: string, accessMode: CapabilityAccessMode): Promise<boolean> {
    // Check grants first
    const grants = Array.from(this.grants.values());
    for (const grant of grants) {
      if (
        grant.grantedAgentId === agentId &&
        grant.accessMode === accessMode &&
        grant.active &&
        (!grant.expiresAt || grant.expiresAt > new Date())
      ) {
        return true;
      }
    }
    
    // Check access validator if no grant found
    if (this.capability.accessValidator) {
      return this.capability.accessValidator(agentId, accessMode);
    }
    
    return false;
  }
  
  /**
   * Add a grant for this capability
   */
  addGrant(grant: CapabilityGrant): void {
    if (grant.capabilityId !== this.capability.id) {
      throw new Error(`Grant capability ID ${grant.capabilityId} doesn't match this capability ID ${this.capability.id}`);
    }
    
    this.grants.set(grant.id, grant);
  }
  
  /**
   * Revoke a grant
   */
  revokeGrant(grantId: string): boolean {
    const grant = this.grants.get(grantId);
    
    if (!grant) {
      return false;
    }
    
    grant.active = false;
    this.grants.set(grantId, grant);
    
    return true;
  }
  
  /**
   * Get all active grants for this capability
   */
  getActiveGrants(): CapabilityGrant[] {
    const now = new Date();
    
    return Array.from(this.grants.values()).filter(grant => 
      grant.active && (!grant.expiresAt || grant.expiresAt > now)
    );
  }
  
  /**
   * Get all grants for a specific agent
   */
  getGrantsForAgent(agentId: string): CapabilityGrant[] {
    return Array.from(this.grants.values()).filter(grant => 
      grant.grantedAgentId === agentId
    );
  }
}

/**
 * Capability discovery system for an agent
 */
export class CapabilityDiscovery {
  /**
   * ID of the agent this discovery system belongs to
   */
  private readonly agentId: string;
  
  /**
   * Capabilities offered by this agent
   */
  private readonly capabilities: Map<string, CapabilityInstance> = new Map();
  
  /**
   * Outgoing capability requests
   */
  private readonly outgoingRequests: Map<string, CapabilityRequest> = new Map();
  
  /**
   * Incoming capability requests
   */
  private readonly incomingRequests: Map<string, CapabilityRequest> = new Map();
  
  /**
   * Capabilities discovered from other agents
   */
  private readonly discoveredCapabilities: Map<string, AgentCapability> = new Map();
  
  /**
   * Grants received from other agents
   */
  private readonly receivedGrants: Map<string, CapabilityGrant> = new Map();
  
  /**
   * Create a new capability discovery system
   */
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  /**
   * Register a capability for this agent
   */
  registerCapability(metadata: CapabilityMetadata, options?: {
    discoverable?: boolean;
    defaultAccessMode?: CapabilityAccessMode;
    allowedAccessModes?: CapabilityAccessMode[];
    accessValidator?: (requestingAgentId: string, accessMode: CapabilityAccessMode) => Promise<boolean>;
  }): string {
    const capabilityId = uuidv4();
    
    const capability: AgentCapability = {
      id: capabilityId,
      agentId: this.agentId,
      metadata,
      discoverable: options?.discoverable ?? true,
      defaultAccessMode: options?.defaultAccessMode ?? CapabilityAccessMode.READ,
      allowedAccessModes: options?.allowedAccessModes ?? [CapabilityAccessMode.READ],
      accessValidator: options?.accessValidator
    };
    
    const instance = new CapabilityInstance(capability);
    this.capabilities.set(capabilityId, instance);
    
    return capabilityId;
  }
  
  /**
   * Unregister a capability
   */
  unregisterCapability(capabilityId: string): boolean {
    return this.capabilities.delete(capabilityId);
  }
  
  /**
   * Get a capability by ID
   */
  getCapability(capabilityId: string): CapabilityInstance | undefined {
    return this.capabilities.get(capabilityId);
  }
  
  /**
   * Get all capabilities offered by this agent
   */
  getCapabilities(): CapabilityInstance[] {
    return Array.from(this.capabilities.values());
  }
  
  /**
   * Get all discoverable capabilities
   */
  getDiscoverableCapabilities(): CapabilityInstance[] {
    return this.getCapabilities().filter(capability => capability.isDiscoverable());
  }
  
  /**
   * Discover capabilities from another agent
   * 
   * In a real implementation, this would send a request to the other agent.
   * For now, it takes capabilities directly.
   */
  discoverCapabilities(
    fromAgentId: string, 
    capabilities: AgentCapability[]
  ): void {
    for (const capability of capabilities) {
      if (capability.discoverable) {
        this.discoveredCapabilities.set(capability.id, capability);
      }
    }
  }
  
  /**
   * Get discovered capabilities
   */
  getDiscoveredCapabilities(options?: {
    agentId?: string;
    type?: CapabilityType;
  }): AgentCapability[] {
    const capabilities = Array.from(this.discoveredCapabilities.values());
    
    if (options?.agentId) {
      return capabilities.filter(capability => capability.agentId === options.agentId);
    }
    
    if (options?.type) {
      return capabilities.filter(capability => capability.metadata.type === options.type);
    }
    
    return capabilities;
  }
  
  /**
   * Request access to a capability
   */
  requestCapability(
    capabilityId: string,
    accessMode: CapabilityAccessMode,
    options?: {
      reason?: string;
      context?: Record<string, unknown>;
      expiresIn?: number;
    }
  ): string {
    const capability = this.discoveredCapabilities.get(capabilityId);
    
    if (!capability) {
      throw new Error(`Capability ${capabilityId} not found`);
    }
    
    if (!capability.allowedAccessModes.includes(accessMode)) {
      throw new Error(`Access mode ${accessMode} not allowed for capability ${capabilityId}`);
    }
    
    const requestId = uuidv4();
    const createdAt = new Date();
    const expiresAt = options?.expiresIn 
      ? new Date(createdAt.getTime() + options.expiresIn) 
      : undefined;
    
    const request: CapabilityRequest = {
      id: requestId,
      capabilityId,
      requestingAgentId: this.agentId,
      requestedAccessMode: accessMode,
      reason: options?.reason,
      context: options?.context,
      status: RequestStatus.PENDING,
      createdAt,
      expiresAt
    };
    
    this.outgoingRequests.set(requestId, request);
    
    // In a real implementation, this would send the request to the other agent
    
    return requestId;
  }
  
  /**
   * Handle a capability request from another agent
   */
  handleCapabilityRequest(request: CapabilityRequest): void {
    // Verify the request is for one of our capabilities
    if (!this.capabilities.has(request.capabilityId)) {
      // Automatically deny if we don't have this capability
      this.respondToRequest(request.id, false, 'Capability not found');
      return;
    }
    
    // Check if the request is already expired
    if (request.expiresAt && request.expiresAt < new Date()) {
      // Automatically mark as expired
      request.status = RequestStatus.EXPIRED;
    }
    
    // Store the request
    this.incomingRequests.set(request.id, request);
  }
  
  /**
   * Get pending incoming requests
   */
  getPendingRequests(): CapabilityRequest[] {
    return Array.from(this.incomingRequests.values())
      .filter(request => request.status === RequestStatus.PENDING);
  }
  
  /**
   * Respond to a capability request
   */
  respondToRequest(
    requestId: string,
    approve: boolean,
    reason?: string,
    options?: {
      grantedAccessMode?: CapabilityAccessMode;
      constraints?: Record<string, unknown>;
      expiresIn?: number;
    }
  ): boolean {
    const request = this.incomingRequests.get(requestId);
    
    if (!request) {
      return false;
    }
    
    if (request.status !== RequestStatus.PENDING) {
      return false;
    }
    
    // Update request
    request.status = approve ? RequestStatus.APPROVED : RequestStatus.DENIED;
    request.respondedAt = new Date();
    
    if (approve) {
      request.grantedAccessMode = options?.grantedAccessMode ?? request.requestedAccessMode;
      request.constraints = options?.constraints;
    } else {
      request.denialReason = reason;
    }
    
    this.incomingRequests.set(requestId, request);
    
    // Create grant if approved
    if (approve) {
      const grantId = uuidv4();
      const createdAt = new Date();
      const expiresAt = options?.expiresIn 
        ? new Date(createdAt.getTime() + options.expiresIn) 
        : undefined;
      
      const grant: CapabilityGrant = {
        id: grantId,
        capabilityId: request.capabilityId,
        requestId,
        grantedAgentId: request.requestingAgentId,
        accessMode: request.grantedAccessMode!,
        createdAt,
        expiresAt,
        active: true,
        constraints: options?.constraints
      };
      
      // Add grant to capability
      const capability = this.capabilities.get(request.capabilityId);
      capability?.addGrant(grant);
      
      // Notify the other agent about the grant
      // In a real implementation, this would send the grant to the other agent
    }
    
    return true;
  }
  
  /**
   * Handle a capability grant from another agent
   */
  handleCapabilityGrant(grant: CapabilityGrant): void {
    // Verify the grant is for one of our requests
    const request = this.outgoingRequests.get(grant.requestId);
    
    if (!request) {
      console.warn(`Received grant for unknown request: ${grant.requestId}`);
      return;
    }
    
    // Check if the grant is already expired
    if (grant.expiresAt && grant.expiresAt < new Date()) {
      return;
    }
    
    // Store the grant
    this.receivedGrants.set(grant.id, grant);
    
    // Update the request status
    request.status = RequestStatus.APPROVED;
    request.grantedAccessMode = grant.accessMode;
    request.constraints = grant.constraints;
    this.outgoingRequests.set(request.id, request);
  }
  
  /**
   * Check if this agent has access to a capability
   */
  hasAccess(capabilityId: string, accessMode: CapabilityAccessMode): boolean {
    // Check grants
    const grants = Array.from(this.receivedGrants.values());
    for (const grant of grants) {
      if (
        grant.capabilityId === capabilityId &&
        grant.accessMode === accessMode &&
        grant.active &&
        (!grant.expiresAt || grant.expiresAt > new Date())
      ) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Revoke a grant
   */
  revokeGrant(grantId: string): boolean {
    const capability = this.getCapabilityByGrantId(grantId);
    
    if (!capability) {
      return false;
    }
    
    return capability.revokeGrant(grantId);
  }
  
  /**
   * Get all active grants issued by this agent
   */
  getIssuedGrants(): CapabilityGrant[] {
    const allGrants: CapabilityGrant[] = [];
    const capabilities = Array.from(this.capabilities.values());
    
    for (const capability of capabilities) {
      allGrants.push(...capability.getActiveGrants());
    }
    
    return allGrants;
  }
  
  /**
   * Get all grants received by this agent
   */
  getReceivedGrants(): CapabilityGrant[] {
    return Array.from(this.receivedGrants.values())
      .filter(grant => grant.active && (!grant.expiresAt || grant.expiresAt > new Date()));
  }
  
  /**
   * Find the capability that issued a grant
   */
  private getCapabilityByGrantId(grantId: string): CapabilityInstance | undefined {
    const capabilities = Array.from(this.capabilities.values());
    for (const capability of capabilities) {
      const grants = capability.getActiveGrants();
      if (grants.some((grant: CapabilityGrant) => grant.id === grantId)) {
        return capability;
      }
    }
    
    return undefined;
  }
} 