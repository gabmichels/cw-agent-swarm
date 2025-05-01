/**
 * CapabilityRegistry.ts - Registry for agent capabilities and skill matching
 * 
 * This module provides:
 * - Registration of agent capabilities (skills, roles, expertise)
 * - Capability-based agent discovery
 * - Capability matching for task delegation
 * - Fallback suggestion when capabilities aren't fully matched
 */

import { AgentBase, AgentCapabilityLevel } from '../base/AgentBase';
import { AgentHealthChecker } from './AgentHealthChecker';
import { AgentMonitor } from '../monitoring/AgentMonitor';

// Capability types
export enum CapabilityType {
  SKILL = 'skill',       // Specific technical ability
  ROLE = 'role',         // Functional role the agent can perform
  DOMAIN = 'domain',     // Knowledge domain
  TAG = 'tag'            // General purpose tag
}

// Capability level
export enum CapabilityLevel {
  BASIC = 'basic',       // Basic capability, minimum functionality
  INTERMEDIATE = 'intermediate', // Medium level capability
  ADVANCED = 'advanced', // Advanced capability
  EXPERT = 'expert'      // Expert level capability
}

// Capability definition
export interface Capability {
  id: string;            // Unique identifier
  name: string;          // Human-readable name
  type: CapabilityType;  // Type of capability
  level?: CapabilityLevel; // Optional proficiency level
  description?: string;  // Optional description
  dependencies?: string[]; // Optional list of dependent capabilities
  metadata?: Record<string, any>; // Additional metadata
}

// Registered agent capability entry
export interface AgentCapabilityEntry {
  agentId: string;       // Agent identifier
  capabilities: Map<string, CapabilityLevel>; // Map of capability ID to level
  preferredDomains: string[]; // Domains the agent specializes in
  primaryRoles: string[]; // Primary roles the agent fulfills
}

// Capability match result
export interface CapabilityMatch {
  agentId: string;       // Agent identifier
  matchScore: number;    // Score from 0-1 indicating match quality
  matchedCapabilities: string[]; // Capabilities that matched
  missingCapabilities: string[]; // Capabilities that were requested but missing
  levelMismatches: Array<{ // Capabilities with level mismatches
    id: string;
    requested: CapabilityLevel;
    available: CapabilityLevel;
  }>;
}

// Capability search options
export interface CapabilitySearchOptions {
  requiredCapabilities: string[]; // Must have these capabilities 
  preferredCapabilities?: string[]; // Prefer agents with these capabilities
  requiredLevels?: Record<string, CapabilityLevel>; // Required capability levels
  preferredDomain?: string; // Preferred knowledge domain
  requiredRoles?: string[]; // Must have one of these roles
  minMatchScore?: number; // Minimum match score (0-1)
  includeUnavailableAgents?: boolean; // Include agents that are unavailable
  limit?: number; // Max number of results
}

/**
 * Registry for agent capabilities across the system
 */
export class CapabilityRegistry {
  // Singleton instance
  private static instance: CapabilityRegistry;
  
  // Maps for capabilities and agent capabilities
  private capabilities: Map<string, Capability> = new Map();
  private agentCapabilities: Map<string, AgentCapabilityEntry> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }
  
  /**
   * Register a capability definition
   */
  registerCapability(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      console.warn(`Capability ${capability.id} already registered and will be updated`);
    }
    
    this.capabilities.set(capability.id, capability);
    console.log(`Registered capability: ${capability.name} (${capability.id}) of type ${capability.type}`);
  }
  
  /**
   * Register multiple capabilities at once
   */
  registerCapabilities(capabilities: Capability[]): void {
    capabilities.forEach(capability => this.registerCapability(capability));
  }
  
  /**
   * Register agent capabilities
   */
  registerAgentCapabilities(
    agentId: string,
    capabilities: Record<string, CapabilityLevel>,
    options: {
      preferredDomains?: string[],
      primaryRoles?: string[]
    } = {}
  ): void {
    // Check if capabilities exist first
    Object.keys(capabilities).forEach(capId => {
      if (!this.capabilities.has(capId)) {
        console.warn(`Registering unknown capability ${capId} for agent ${agentId}`);
      }
    });
    
    // Create capability map
    const capabilityMap = new Map<string, CapabilityLevel>();
    Object.entries(capabilities).forEach(([id, level]) => {
      capabilityMap.set(id, level);
    });
    
    // Register or update agent capabilities
    if (this.agentCapabilities.has(agentId)) {
      const existing = this.agentCapabilities.get(agentId)!;
      
      // Merge capabilities
      for (const [id, level] of Array.from(capabilityMap.entries())) {
        existing.capabilities.set(id, level);
      }
      
      // Update domains and roles if provided
      if (options.preferredDomains) {
        existing.preferredDomains = options.preferredDomains;
      }
      
      if (options.primaryRoles) {
        existing.primaryRoles = options.primaryRoles;
      }
      
      console.log(`Updated capabilities for agent ${agentId}`);
    } else {
      // Create new entry
      this.agentCapabilities.set(agentId, {
        agentId,
        capabilities: capabilityMap,
        preferredDomains: options.preferredDomains || [],
        primaryRoles: options.primaryRoles || []
      });
      
      console.log(`Registered capabilities for agent ${agentId}`);
    }
    
    // Log registration
    AgentMonitor.log({
      agentId,
      taskId: `capability_registry_${Date.now()}`,
      eventType: 'message',
      timestamp: Date.now(),
      metadata: {
        type: 'capability_registration',
        capabilityCount: capabilityMap.size,
        domains: options.preferredDomains,
        roles: options.primaryRoles
      }
    });
  }
  
  /**
   * Get all capabilities for an agent
   */
  getAgentCapabilities(agentId: string): Map<string, CapabilityLevel> | null {
    const entry = this.agentCapabilities.get(agentId);
    return entry ? entry.capabilities : null;
  }
  
  /**
   * Get all preferred domains for an agent
   */
  getAgentDomains(agentId: string): string[] {
    const entry = this.agentCapabilities.get(agentId);
    return entry ? entry.preferredDomains : [];
  }
  
  /**
   * Get all primary roles for an agent
   */
  getAgentRoles(agentId: string): string[] {
    const entry = this.agentCapabilities.get(agentId);
    return entry ? entry.primaryRoles : [];
  }
  
  /**
   * Check if an agent has a specific capability
   */
  hasCapability(agentId: string, capabilityId: string): boolean {
    const capabilities = this.getAgentCapabilities(agentId);
    return capabilities ? capabilities.has(capabilityId) : false;
  }
  
  /**
   * Get the level of a specific capability for an agent
   */
  getCapabilityLevel(agentId: string, capabilityId: string): CapabilityLevel | null {
    const capabilities = this.getAgentCapabilities(agentId);
    return capabilities && capabilities.has(capabilityId) 
      ? capabilities.get(capabilityId)! 
      : null;
  }
  
  /**
   * Find agents with specific capabilities
   */
  findAgentsWithCapabilities(options: CapabilitySearchOptions): CapabilityMatch[] {
    const matches: CapabilityMatch[] = [];
    
    // Check all registered agents
    for (const [agentId, entry] of Array.from(this.agentCapabilities.entries())) {
      // Skip unavailable agents unless specified
      if (!options.includeUnavailableAgents) {
        const isAvailable = AgentHealthChecker.isAvailable(agentId);
        if (!isAvailable) continue;
      }
      
      // Check required capabilities
      const missingCapabilities: string[] = [];
      const matchedCapabilities: string[] = [];
      const levelMismatches: Array<{
        id: string;
        requested: CapabilityLevel;
        available: CapabilityLevel;
      }> = [];
      
      // Check required capabilities
      for (const capId of options.requiredCapabilities) {
        if (entry.capabilities.has(capId)) {
          matchedCapabilities.push(capId);
          
          // Check level requirement if specified
          if (options.requiredLevels && options.requiredLevels[capId]) {
            const requiredLevel = options.requiredLevels[capId];
            const availableLevel = entry.capabilities.get(capId)!;
            
            // Convert levels to numeric values for comparison
            const levelValues: Record<CapabilityLevel, number> = {
              [CapabilityLevel.BASIC]: 1,
              [CapabilityLevel.INTERMEDIATE]: 2,
              [CapabilityLevel.ADVANCED]: 3,
              [CapabilityLevel.EXPERT]: 4
            };
            
            // If available level is lower than required, add to mismatches
            if (levelValues[availableLevel] < levelValues[requiredLevel]) {
              levelMismatches.push({
                id: capId,
                requested: requiredLevel,
                available: availableLevel
              });
            }
          }
        } else {
          missingCapabilities.push(capId);
        }
      }
      
      // Calculate match score
      let matchScore = options.requiredCapabilities.length > 0 
        ? matchedCapabilities.length / options.requiredCapabilities.length 
        : 0;
      
      // Adjust score for level mismatches
      if (levelMismatches.length > 0) {
        const mismatchPenalty = levelMismatches.length / matchedCapabilities.length * 0.5;
        matchScore = Math.max(0, matchScore - mismatchPenalty);
      }
      
      // Bonus for preferred capabilities
      if (options.preferredCapabilities && options.preferredCapabilities.length > 0) {
        const preferredMatches = options.preferredCapabilities.filter(capId => 
          entry.capabilities.has(capId)
        ).length;
        
        const preferredBonus = preferredMatches / options.preferredCapabilities.length * 0.2;
        matchScore = Math.min(1, matchScore + preferredBonus);
      }
      
      // Bonus for preferred domain
      if (options.preferredDomain && entry.preferredDomains.includes(options.preferredDomain)) {
        matchScore = Math.min(1, matchScore + 0.1);
      }
      
      // Check required roles
      if (options.requiredRoles && options.requiredRoles.length > 0) {
        const hasRequiredRole = options.requiredRoles.some(role => 
          entry.primaryRoles.includes(role)
        );
        
        if (!hasRequiredRole) {
          // If no required role, significantly reduce score
          matchScore *= 0.3;
        }
      }
      
      // Skip if below minimum score threshold
      if (options.minMatchScore !== undefined && matchScore < options.minMatchScore) {
        continue;
      }
      
      // Add to matches
      matches.push({
        agentId,
        matchScore,
        matchedCapabilities,
        missingCapabilities,
        levelMismatches
      });
    }
    
    // Sort by match score (descending)
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    // Limit results if specified
    if (options.limit && matches.length > options.limit) {
      return matches.slice(0, options.limit);
    }
    
    return matches;
  }
  
  /**
   * Find the best agent for a specific task
   */
  findBestAgentForTask(options: CapabilitySearchOptions): string | null {
    const matches = this.findAgentsWithCapabilities({
      ...options,
      limit: 1
    });
    
    return matches.length > 0 ? matches[0].agentId : null;
  }
  
  /**
   * Get capability information
   */
  getCapability(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }
  
  /**
   * Get all registered capabilities
   */
  getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }
  
  /**
   * Get capabilities by type
   */
  getCapabilitiesByType(type: CapabilityType): Capability[] {
    return Array.from(this.capabilities.values())
      .filter(cap => cap.type === type);
  }
  
  /**
   * Get all agents with a specific capability
   */
  getAgentsWithCapability(capabilityId: string): string[] {
    const agents: string[] = [];
    
    for (const [agentId, entry] of Array.from(this.agentCapabilities.entries())) {
      if (entry.capabilities.has(capabilityId)) {
        agents.push(agentId);
      }
    }
    
    return agents;
  }
  
  /**
   * Get all agents with a specific role
   */
  getAgentsWithRole(role: string): string[] {
    const agents: string[] = [];
    
    for (const [agentId, entry] of Array.from(this.agentCapabilities.entries())) {
      if (entry.primaryRoles.includes(role)) {
        agents.push(agentId);
      }
    }
    
    return agents;
  }
  
  /**
   * Get all agents specializing in a domain
   */
  getAgentsInDomain(domain: string): string[] {
    const agents: string[] = [];
    
    for (const [agentId, entry] of Array.from(this.agentCapabilities.entries())) {
      if (entry.preferredDomains.includes(domain)) {
        agents.push(agentId);
      }
    }
    
    return agents;
  }
  
  /**
   * Suggest fallback capabilities when exact match is not found
   */
  suggestAlternativeCapabilities(requiredCapabilities: string[]): Capability[] {
    const suggestions: Capability[] = [];
    
    // For each required capability, find capabilities that might be related
    for (const capId of requiredCapabilities) {
      const capability = this.capabilities.get(capId);
      
      if (!capability) continue;
      
      // Search for capabilities with similar names or in the same domain
      const similarCapabilities = Array.from(this.capabilities.values())
        .filter(c => 
          c.id !== capId && 
          (c.type === capability.type || 
           (c.name.includes(capability.name) || capability.name.includes(c.name)) ||
           (c.description && capability.description && 
            (c.description.includes(capability.description) || 
             capability.description.includes(c.description)))))
        .slice(0, 3); // Limit to top 3 similar capabilities
      
      suggestions.push(...similarCapabilities);
    }
    
    // Return unique suggestions
    return Array.from(new Map(suggestions.map(cap => [cap.id, cap])).values());
  }
  
  /**
   * Clear all registrations (mostly for testing)
   */
  clear(): void {
    this.capabilities.clear();
    this.agentCapabilities.clear();
  }
} 