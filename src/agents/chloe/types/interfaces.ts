/**
 * Type definitions for the ChloeAgent configuration
 */

import { AgentBaseConfig, AgentBaseOptions, AgentCapabilityLevel } from "../../shared/base/AgentBase";

/**
 * Chloe-specific configuration options that extend the base agent config
 */
export interface ChloeAgentConfig extends AgentBaseConfig {
  /**
   * Marketing department designation
   */
  department: string;
  
  /**
   * Chloe-specific knowledge paths
   */
  knowledgePaths?: string[];
  
  /**
   * Custom marketing capabilities configuration
   */
  marketingCapabilities?: {
    /**
     * Growth strategy proficiency level
     */
    growthStrategy: string;
    
    /**
     * Content marketing proficiency level
     */
    contentMarketing: string;
    
    /**
     * User acquisition proficiency level
     */
    userAcquisition: string;
    
    /**
     * Viral marketing proficiency level
     */
    viralMarketing: string;
  };
}

/**
 * Options for initializing a ChloeAgent instance
 */
export interface ChloeAgentOptions {
  /**
   * Chloe-specific configuration
   */
  config: ChloeAgentConfig & { agentId: string };
  
  /**
   * Capability level of the agent
   */
  capabilityLevel?: AgentCapabilityLevel;
  
  /**
   * List of tool permissions granted to the agent
   */
  toolPermissions?: string[];
} 