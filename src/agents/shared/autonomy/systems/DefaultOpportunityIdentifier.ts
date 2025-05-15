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
      // Verify required managers are available
      const memoryManager = this.agent.getManager<MemoryManager>(ManagerType.MEMORY);
      const knowledgeManager = this.agent.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
      const reflectionManager = this.agent.getManager<ReflectionManager>(ManagerType.REFLECTION);

      if (!memoryManager || !knowledgeManager || !reflectionManager) {
        throw new OpportunityIdentificationError(
          'Required managers not available',
          'MANAGERS_NOT_AVAILABLE'
        );
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing opportunity identifier:', error);
      return false;
    }
  }

  /**
   * Detect triggers in content
   */
  async detectTriggers(
    content: string,
    options: TriggerDetectionOptions = {}
  ): Promise<OpportunityTrigger[]> {
    this.ensureInitialized();

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
    this.ensureInitialized();

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
      // Get relevant memories if available
      const memoryManager = this.agent.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        const recentMemories = await memoryManager.getRecentMemories(5);
        context.recentMemories = recentMemories;
      }

      // Get relevant knowledge if available
      const knowledgeManager = this.agent.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
      if (knowledgeManager) {
        const content = typeof trigger.context.content === 'string' ? trigger.context.content : '';
        const searchResults = await knowledgeManager.searchKnowledge(content, { limit: 3 });
        // Extract entries from search results
        context.relevantKnowledge = searchResults.map(result => result.entry);
      }
    } catch (error) {
      console.error('Error gathering opportunity context:', error);
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
    this.ensureInitialized();

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
    this.ensureInitialized();

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
    this.ensureInitialized();

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