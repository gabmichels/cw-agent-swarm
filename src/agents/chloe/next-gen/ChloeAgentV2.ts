/**
 * ChloeAgentV2.ts - Refactored implementation of ChloeAgent using the AgentBase architecture
 * This version demonstrates how Chloe can be implemented using the generic agent architecture
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentBase, AgentBaseConfig, AgentBaseOptions, AgentCapabilityLevel } from '../../shared/base/AgentBase';
import { CapabilityRegistry } from '../../shared/capability-system';
import { 
  ChloeCapabilityConfig, 
  registerChloeCapabilities, 
  registerChloeAgentCapabilities 
} from './ChloeCapabilities';

// Define a fallback system prompt since we can't import it
const DEFAULT_SYSTEM_PROMPT = 
  "You are Chloe, the CMO of Crowd Wisdom. You provide marketing expertise and strategy advice.";

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
}

/**
 * Options for initializing a ChloeAgent instance
 */
export interface ChloeAgentOptions {
  /**
   * Chloe-specific configuration
   */
  config?: Partial<ChloeAgentConfig>;
  
  /**
   * Capability level of the agent
   */
  capabilityLevel?: AgentCapabilityLevel;
  
  /**
   * List of tool permissions granted to the agent
   */
  toolPermissions?: string[];
}

/**
 * ChloeAgentV2 class implements a marketing assistant agent using the AgentBase architecture
 */
export class ChloeAgentV2 extends AgentBase {
  private department: string;
  
  /**
   * Create a new Chloe agent instance
   */
  constructor(options: ChloeAgentOptions = {}) {
    // Prepare default Chloe-specific configuration
    const chloeConfig: AgentBaseConfig = {
      agentId: 'chloe',
      name: 'Chloe',
      description: 'CMO of Crowd Wisdom focused on marketing strategy',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      model: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4000,
      // Use capability configuration from ChloeCapabilities
      capabilities: {
        skills: ChloeCapabilityConfig.skills,
        domains: ChloeCapabilityConfig.domains,
        roles: ChloeCapabilityConfig.roles
      },
      ...(options.config || {})
    };
    
    // Initialize AgentBase with Chloe's configuration
    super({
      config: chloeConfig,
      capabilityLevel: options.capabilityLevel || AgentCapabilityLevel.ADVANCED,
      toolPermissions: options.toolPermissions || [
        'web_search', 'document_creation', 'social_media_analysis'
      ]
    });
    
    // Store Chloe-specific properties
    this.department = options.config?.department || 'marketing';
  }
  
  /**
   * Initialize the agent with necessary services and resources
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`Initializing ChloeAgentV2 with ID: ${this.getAgentId()}`);
      
      // Register Chloe-specific capabilities with the registry
      const registry = CapabilityRegistry.getInstance();
      registerChloeCapabilities(registry);
      
      // Call parent initialization (which will register agent capabilities)
      const initialized = await super.initialize();
      if (!initialized) {
        console.error('Failed to initialize AgentBase');
        return false;
      }
      
      // Chloe-specific initialization
      const marketingKnowledgePaths = [
        `data/knowledge/domains/${this.department}`,
        `data/knowledge/agents/${this.getAgentId()}`
      ];
      
      console.log(`ChloeAgentV2 initialized successfully with department: ${this.department}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize ChloeAgentV2:', error);
      return false;
    }
  }
  
  /**
   * Get the department this agent belongs to
   */
  getDepartment(): string {
    return this.department;
  }
  
  /**
   * Set the department for this agent
   */
  setDepartment(department: string): void {
    this.department = department;
  }
  
  /**
   * Get knowledge paths specific to this department
   */
  getDepartmentKnowledgePaths(): string[] {
    return [
      'data/knowledge/company',
      `data/knowledge/agents/${this.getAgentId()}`,
      'data/knowledge/agents/shared',
      `data/knowledge/domains/${this.department}`
    ];
  }
  
  /**
   * Perform a marketing analysis - Chloe-specific functionality
   */
  async performMarketingAnalysis(topic: string): Promise<string> {
    // This would use the AgentBase capabilities but add Chloe-specific logic
    // For now just return a placeholder
    return `Marketing analysis for ${topic} would be performed here`;
  }
} 