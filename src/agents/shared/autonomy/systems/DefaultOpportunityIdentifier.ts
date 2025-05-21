/**
 * DefaultOpportunityIdentifier.ts
 * 
 * Implementation of opportunity identification and trigger detection for autonomous agents.
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../base/AgentBase.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { MemoryManager } from '../../base/managers/MemoryManager';
import { KnowledgeManager, KnowledgeEntry } from '../../base/managers/KnowledgeManager.interface';
import { ReflectionManager } from '../../base/managers/ReflectionManager.interface';
import { 
  OpportunityIdentifier, OpportunityType, OpportunityPriority,
  OpportunityTrigger, OpportunityContext, IdentifiedOpportunity,
  TriggerDetectionOptions, OpportunityDetectionResult
} from '../../autonomy/interfaces/OpportunityIdentification.interface';

/**
 * Error class for opportunity identification
 */
class OpportunityIdentificationError extends Error {
  constructor(message: string, public readonly code: string = 'OPPORTUNITY_ERROR') {
    super(message);
    this.name = 'OpportunityIdentificationError';
  }
}

/**
 * Default implementation of the OpportunityIdentifier interface
 */
export class DefaultOpportunityIdentifier implements OpportunityIdentifier {
  private agent: AgentBase;
  private initialized: boolean = false;
  private opportunities: Map<string, IdentifiedOpportunity> = new Map();
  private activeTriggers: Set<string> = new Set();
  private triggerPatterns: Map<string, RegExp> = new Map();

  constructor(agent: AgentBase) {
    this.agent = agent;
    this.initializeTriggerPatterns();
  }

  /**
   * Initialize trigger patterns for detection
   */
  private initializeTriggerPatterns(): void {
    this.triggerPatterns.set('task_completion', /completed|finished|done/i);
    this.triggerPatterns.set('error_occurrence', /error|failed|exception/i);
    this.triggerPatterns.set('resource_change', /resource|capacity|availability/i);
    this.triggerPatterns.set('user_request', /request|ask|help|assist/i);
    this.triggerPatterns.set('schedule_event', /schedule|deadline|due/i);
    this.triggerPatterns.set('knowledge_gap', /unknown|unclear|unsure|missing/i);
    this.triggerPatterns.set('performance_issue', /slow|inefficient|bottleneck/i);
    this.triggerPatterns.set('optimization', /improve|optimize|enhance/i);
  }

  /**
   * Initialize the opportunity identifier
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      const agentId = this.agent.getAgentId();
      
      // Log initialization start for debugging
      console.log(`[OpportunityIdentifier] Initializing for agent ${agentId}`);
      
      // Get list of all available managers
      const allManagers = Array.isArray(this.agent.getManagers) ? this.agent.getManagers() : [];
      console.log(`[OpportunityIdentifier] Agent has ${allManagers.length} total managers`);
      
      // Check for managers but make them optional
      const hasManager = (type: ManagerType): boolean => {
        return this.agent.hasManager ? this.agent.hasManager(type) : false;
      };
      
      // Log all available managers for debugging
      const availableManagerTypes = allManagers
        .filter(m => m && m.managerType)
        .map(m => m.managerType);
      
      console.log(`[OpportunityIdentifier] Available manager types: ${JSON.stringify(availableManagerTypes)}`);
      
      // Get optional managers - we'll operate with limited functionality if they're missing
      const memoryManager = hasManager(ManagerType.MEMORY) ? 
        this.agent.getManager<MemoryManager>(ManagerType.MEMORY) : null;
      
      const knowledgeManager = hasManager(ManagerType.KNOWLEDGE) ? 
        this.agent.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE) : null;
      
      const reflectionManager = hasManager(ManagerType.REFLECTION) ? 
        this.agent.getManager<ReflectionManager>(ManagerType.REFLECTION) : null;

      // Log which managers are available for debugging
      console.log(`[OpportunityIdentifier] Memory Manager available: ${!!memoryManager}`);
      console.log(`[OpportunityIdentifier] Knowledge Manager available: ${!!knowledgeManager}`);
      console.log(`[OpportunityIdentifier] Reflection Manager available: ${!!reflectionManager}`);
      
      // We'll initialize even if some managers are missing, but with reduced functionality
      if (!memoryManager || !knowledgeManager || !reflectionManager) {
        console.warn(`[OpportunityIdentifier] Some managers are missing. Opportunity identification will have limited functionality.`);
      }

      this.initialized = true;
      console.log(`[OpportunityIdentifier] Successfully initialized for agent ${agentId}`);
      return true;
    } catch (error) {
      console.error('[OpportunityIdentifier] Error initializing opportunity identifier:', error);
      // Initialize anyway to avoid blocking the agent's operation
      this.initialized = true;
      return true;
    }
  }

  /**
   * Detect triggers in content
   */
  async detectTriggers(
    content: string,
    options: TriggerDetectionOptions = {}
  ): Promise<OpportunityTrigger[]> {
    // Initialize if not already initialized
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('[OpportunityIdentifier] Auto-initializing during trigger detection:', error);
        this.initialized = true; // Force initialized to avoid blocking
      }
    }

    const triggers: OpportunityTrigger[] = [];
    const now = new Date();

    // Check each pattern for matches
    for (const [type, pattern] of Array.from(this.triggerPatterns.entries())) {
      if (pattern.test(content)) {
        const triggerId = uuidv4();
        const trigger: OpportunityTrigger = {
          id: triggerId,
          type,
          source: options.source || 'content-analysis',
          timestamp: now,
          confidence: this.calculateTriggerConfidence(content, type),
          context: {
            content,
            matchedPattern: pattern.source,
            ...options.context
          }
        };

        triggers.push(trigger);
        this.activeTriggers.add(triggerId);
      }
    }

    return triggers;
  }

  /**
   * Calculate confidence score for a trigger
   */
  private calculateTriggerConfidence(content: string, triggerType: string): number {
    // Basic implementation - could be enhanced with ML/more sophisticated analysis
    const pattern = this.triggerPatterns.get(triggerType);
    if (!pattern) {
      return 0;
    }

    const matches = content.match(pattern) || [];
    return Math.min(matches.length * 0.2, 0.9); // Cap at 0.9
  }

  /**
   * Identify opportunities based on triggers
   */
  async identifyOpportunities(
    triggers: OpportunityTrigger[]
  ): Promise<OpportunityDetectionResult> {
    // Initialize if not already initialized
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('[OpportunityIdentifier] Auto-initializing during opportunity identification:', error);
        this.initialized = true; // Force initialized to avoid blocking
      }
    }

    const opportunities: IdentifiedOpportunity[] = [];
    const now = new Date();

    for (const trigger of triggers) {
      try {
        const opportunity = await this.createOpportunityFromTrigger(trigger);
        if (opportunity) {
          opportunities.push(opportunity);
          this.opportunities.set(opportunity.id, opportunity);
        }
      } catch (error) {
        console.error(`Error processing trigger ${trigger.id}:`, error);
      }
    }

    return {
      opportunities,
      timestamp: now,
      source: 'opportunity-identifier',
      triggerCount: triggers.length,
      successfulIdentifications: opportunities.length
    };
  }

  /**
   * Create an opportunity from a trigger
   */
  private async createOpportunityFromTrigger(
    trigger: OpportunityTrigger
  ): Promise<IdentifiedOpportunity | null> {
    const opportunityType = this.mapTriggerToOpportunityType(trigger.type);
    if (!opportunityType) {
      return null;
    }

    const now = new Date();
    const opportunity: IdentifiedOpportunity = {
      id: uuidv4(),
      type: opportunityType,
      trigger,
      priority: this.calculateOpportunityPriority(trigger),
      context: await this.gatherOpportunityContext(trigger),
      detectedAt: now,
      status: 'pending',
      validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      confidence: trigger.confidence
    };

    return opportunity;
  }

  /**
   * Map trigger type to opportunity type
   */
  private mapTriggerToOpportunityType(triggerType: string): OpportunityType | null {
    const mappings: Record<string, OpportunityType> = {
      'task_completion': OpportunityType.TASK_OPTIMIZATION,
      'error_occurrence': OpportunityType.ERROR_PREVENTION,
      'resource_change': OpportunityType.RESOURCE_OPTIMIZATION,
      'user_request': OpportunityType.USER_ASSISTANCE,
      'schedule_event': OpportunityType.SCHEDULE_OPTIMIZATION,
      'knowledge_gap': OpportunityType.KNOWLEDGE_ACQUISITION,
      'performance_issue': OpportunityType.PERFORMANCE_OPTIMIZATION,
      'optimization': OpportunityType.SYSTEM_OPTIMIZATION
    };

    return mappings[triggerType] || null;
  }

  /**
   * Calculate opportunity priority
   */
  private calculateOpportunityPriority(trigger: OpportunityTrigger): OpportunityPriority {
    const priorityMappings: Record<string, OpportunityPriority> = {
      'error_occurrence': OpportunityPriority.HIGH,
      'user_request': OpportunityPriority.HIGH,
      'performance_issue': OpportunityPriority.MEDIUM,
      'knowledge_gap': OpportunityPriority.MEDIUM,
      'resource_change': OpportunityPriority.MEDIUM,
      'schedule_event': OpportunityPriority.MEDIUM,
      'task_completion': OpportunityPriority.LOW,
      'optimization': OpportunityPriority.LOW
    };

    return priorityMappings[trigger.type] || OpportunityPriority.LOW;
  }

  /**
   * Gather context for an opportunity
   */
  private async gatherOpportunityContext(
    trigger: OpportunityTrigger
  ): Promise<OpportunityContext> {
    const context: OpportunityContext = {
      trigger: trigger.context,
      timestamp: new Date(),
      source: trigger.source
    };

    try {
      // Safely get managers if available, and provide fallbacks if they're not
      
      // Get relevant memories if available
      try {
        if (this.agent.hasManager && this.agent.hasManager(ManagerType.MEMORY)) {
          const memoryManager = this.agent.getManager<MemoryManager>(ManagerType.MEMORY);
          if (memoryManager) {
            try {
              const recentMemories = await memoryManager.getRecentMemories(5);
              context.recentMemories = recentMemories;
            } catch (err: any) {
              console.warn(`[OpportunityIdentifier] Error getting recent memories: ${err.message}`);
              context.recentMemories = [];
            }
          } else {
            context.recentMemories = [];
          }
        } else {
          context.recentMemories = [];
        }
      } catch (memErr) {
        console.warn(`[OpportunityIdentifier] Memory manager access error: ${memErr}`);
        context.recentMemories = [];
      }

      // Get relevant knowledge if available
      try {
        if (this.agent.hasManager && this.agent.hasManager(ManagerType.KNOWLEDGE)) {
          const knowledgeManager = this.agent.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
          if (knowledgeManager) {
            try {
              const content = typeof trigger.context.content === 'string' ? trigger.context.content : '';
              const searchResults = await knowledgeManager.searchKnowledge(content, { limit: 3 });
              // Extract entries from search results
              context.relevantKnowledge = searchResults.map(result => result.entry);
            } catch (err: any) {
              console.warn(`[OpportunityIdentifier] Error searching knowledge: ${err.message}`);
              context.relevantKnowledge = [];
            }
          } else {
            context.relevantKnowledge = [];
          }
        } else {
          context.relevantKnowledge = [];
        }
      } catch (knowledgeErr) {
        console.warn(`[OpportunityIdentifier] Knowledge manager access error: ${knowledgeErr}`);
        context.relevantKnowledge = [];
      }
    } catch (error) {
      console.error('[OpportunityIdentifier] Error gathering opportunity context:', error);
      // Provide empty arrays as fallbacks
      context.recentMemories = context.recentMemories || [];
      context.relevantKnowledge = context.relevantKnowledge || [];
    }

    return context;
  }

  /**
   * Get all identified opportunities
   */
  async getOpportunities(
    filter?: {
      type?: OpportunityType;
      priority?: OpportunityPriority;
      status?: string;
    }
  ): Promise<IdentifiedOpportunity[]> {
    // Initialize if not already initialized
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('[OpportunityIdentifier] Auto-initializing during get opportunities:', error);
        this.initialized = true; // Force initialized to avoid blocking
      }
    }

    let opportunities = Array.from(this.opportunities.values());

    if (filter) {
      opportunities = opportunities.filter(opp => {
        if (filter.type && opp.type !== filter.type) return false;
        if (filter.priority && opp.priority !== filter.priority) return false;
        if (filter.status && opp.status !== filter.status) return false;
        return true;
      });
    }

    return opportunities;
  }

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(
    opportunityId: string,
    status: string,
    result?: Record<string, unknown>
  ): Promise<boolean> {
    // Initialize if not already initialized
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('[OpportunityIdentifier] Auto-initializing during status update:', error);
        this.initialized = true; // Force initialized to avoid blocking
      }
    }

    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      return false;
    }

    opportunity.status = status;
    if (result) {
      opportunity.result = result;
    }
    opportunity.lastUpdated = new Date();

    this.opportunities.set(opportunityId, opportunity);
    return true;
  }

  /**
   * Clear expired opportunities
   */
  async clearExpiredOpportunities(): Promise<number> {
    // Initialize if not already initialized
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('[OpportunityIdentifier] Auto-initializing during clear expired:', error);
        this.initialized = true; // Force initialized to avoid blocking
      }
    }

    const now = new Date();
    let cleared = 0;

    for (const [id, opportunity] of Array.from(this.opportunities.entries())) {
      if (opportunity.validUntil && opportunity.validUntil < now) {
        this.opportunities.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Ensure the identifier is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityIdentificationError(
        'Opportunity identifier not initialized',
        'NOT_INITIALIZED'
      );
    }
  }
} 