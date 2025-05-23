/**
 * DefaultOpportunityIdentifier.ts
 * 
 * Implementation of opportunity identification and trigger detection for autonomous agents.
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../base/AgentBase.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { MemoryManager, MemoryEntry } from '../../base/managers/MemoryManager';
import { KnowledgeManager, KnowledgeEntry } from '../../base/managers/KnowledgeManager.interface';
import { ReflectionManager } from '../../base/managers/ReflectionManager.interface';
import { 
  OpportunityIdentifier, OpportunityType, OpportunityPriority,
  OpportunityTrigger, OpportunityContext, IdentifiedOpportunity,
  TriggerDetectionOptions, OpportunityDetectionResult
} from '../../autonomy/interfaces/OpportunityIdentification.interface';
// Import the new opportunity management system
import { 
  createOpportunitySystem, 
  OpportunityManager,
  OpportunitySystemConfig,
  OpportunityStorageType,
  Opportunity as NewOpportunity,
  OpportunityStatus
} from '../../../../lib/opportunity';

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
  // Add the opportunity manager from our new system
  private opportunityManager: OpportunityManager | null = null;

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

      // Initialize the opportunity management system
      const config: OpportunitySystemConfig = {
        storage: {
          type: OpportunityStorageType.MEMORY // Use in-memory storage for simplicity
        },
        autoEvaluate: true,
        managerConfig: {
          autoProcessing: {
            enabled: true,
            minScoreThreshold: 0.5
          }
        }
      };

      // Initialize the opportunity manager
      this.opportunityManager = createOpportunitySystem(config);
      await this.opportunityManager.initialize();

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

    // Make sure opportunity manager is available
    if (!this.opportunityManager) {
      console.error("Opportunity manager not initialized, falling back to internal implementation");
      
      // Fall back to the internal implementation if opportunity manager is not available
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
    } else {
      // Use the new opportunity management system
      for (const trigger of triggers) {
        try {
          // Convert the legacy trigger into a format suitable for the new system
          const opportunityType = this.mapTriggerToOpportunityType(trigger.type);
          if (!opportunityType) continue;
          
          const agentId = this.agent.getAgentId();
          const priority = this.calculateOpportunityPriority(trigger);
          
          // Create the opportunity using the new system
          const opportunity = await this.opportunityManager.createOpportunityForAgent({
            title: `${opportunityType} opportunity from ${trigger.source}`,
            description: typeof trigger.context.content === 'string' ? trigger.context.content : 'Opportunity detected',
            type: opportunityType, 
            priority: priority.toString().toLowerCase(),
            metadata: {
              trigger: trigger,
              confidence: trigger.confidence,
              agentId
            },
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
          }, agentId);
          
          // Convert to the legacy format for compatibility
          const legacyOpportunity: IdentifiedOpportunity = {
            id: opportunity.id,
            type: opportunityType,
            trigger,
            priority,
            context: await this.gatherOpportunityContext(trigger),
            detectedAt: opportunity.createdAt,
            status: 'pending',
            validUntil: opportunity.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
            confidence: trigger.confidence
          };
          
          opportunities.push(legacyOpportunity);
          this.opportunities.set(legacyOpportunity.id, legacyOpportunity);
        } catch (error) {
          console.error(`Error processing trigger ${trigger.id}:`, error);
        }
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
      'error_occurrence': OpportunityType.ERROR_RECOVERY,
      'resource_change': OpportunityType.RESOURCE_OPTIMIZATION,
      'user_request': OpportunityType.USER_ASSISTANCE,
      'schedule_event': OpportunityType.SCHEDULED_TASK,
      'knowledge_gap': OpportunityType.KNOWLEDGE_ACQUISITION,
      'performance_issue': OpportunityType.PERFORMANCE_OPTIMIZATION,
      'optimization': OpportunityType.SYSTEM_OPTIMIZATION
    };
    
    return mappings[triggerType] || null;
  }

  /**
   * Calculate priority for an opportunity
   */
  private calculateOpportunityPriority(trigger: OpportunityTrigger): OpportunityPriority {
    // Quick mapping of urgency by trigger type
    const typePriorities: Record<string, number> = {
      'error_occurrence': 0.9,
      'user_request': 0.8,
      'schedule_event': 0.7,
      'performance_issue': 0.6,
      'resource_change': 0.5,
      'task_completion': 0.4,
      'knowledge_gap': 0.3,
      'optimization': 0.2
    };
    
    const basePriority = typePriorities[trigger.type] || 0.5;
    const confidenceWeight = 0.3;
    
    // Calculate score based on base priority and confidence
    const score = (basePriority * (1 - confidenceWeight)) + (trigger.confidence * confidenceWeight);
    
    // Map score to priority level
    if (score >= 0.8) {
      return OpportunityPriority.HIGH;
    } else if (score >= 0.5) {
      return OpportunityPriority.MEDIUM;
    } else {
      return OpportunityPriority.LOW;
    }
  }

  /**
   * Gather additional context information for an opportunity
   */
  private async gatherOpportunityContext(
    trigger: OpportunityTrigger
  ): Promise<OpportunityContext> {
    const context: OpportunityContext = {
      trigger: trigger.context,
      timestamp: new Date(),
      source: 'opportunity-identifier',
      relevantMemories: [],
      relevantKnowledge: [],
      insights: [],
      metadata: {}
    };
    
    // Try to get relevant memories if memory manager is available
    try {
      if (this.agent.hasManager && this.agent.hasManager(ManagerType.MEMORY)) {
        const memoryManager = this.agent.getManager<MemoryManager>(ManagerType.MEMORY);
        if (memoryManager) {
          const relevantMemories = await memoryManager.searchMemories(
            typeof trigger.context.content === 'string' ? trigger.context.content : '',
            { limit: 5 }
          );
          
          context.relevantMemories = relevantMemories.map(memory => ({
            id: memory.id,
            content: memory.content,
            importance: (memory as any).importance || 0,
            metadata: memory.metadata || {},
            createdAt: memory.createdAt || new Date(),
            lastAccessedAt: memory.lastAccessedAt || new Date(),
            accessCount: memory.accessCount || 0
          } as MemoryEntry));
        }
      }
    } catch (error) {
      console.warn('[OpportunityIdentifier] Error fetching relevant memories:', error);
    }
    
    // Try to get relevant knowledge if knowledge manager is available
    try {
      if (this.agent.hasManager && this.agent.hasManager(ManagerType.KNOWLEDGE)) {
        const knowledgeManager = this.agent.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
        if (knowledgeManager && 'getRelevantKnowledge' in knowledgeManager) {
          const query = typeof trigger.context.content === 'string' ? trigger.context.content : '';
          const relevantKnowledge = await (knowledgeManager as any).getRelevantKnowledge(query, 3);
          
          context.relevantKnowledge = relevantKnowledge.map((knowledge: any) => ({
            id: knowledge.id,
            title: knowledge.title,
            content: knowledge.content
          }));
        }
      }
    } catch (error) {
      console.warn('[OpportunityIdentifier] Error fetching relevant knowledge:', error);
    }
    
    return context;
  }

  /**
   * Get opportunities matching filter criteria
   */
  async getOpportunities(
    filter?: {
      type?: OpportunityType;
      priority?: OpportunityPriority;
      status?: string;
    }
  ): Promise<IdentifiedOpportunity[]> {
    this.ensureInitialized();
    
    if (this.opportunityManager) {
      try {
        // Use the new opportunity system
        const agentId = this.agent.getAgentId();
        const newFilter: any = {};
        
        if (filter?.type) newFilter.types = [filter.type];
        if (filter?.priority) newFilter.priorities = [filter.priority.toString().toLowerCase()];
        if (filter?.status) {
          // Map the status
          const statusMap: Record<string, string> = {
            'pending': OpportunityStatus.PENDING,
            'in_progress': OpportunityStatus.IN_PROGRESS,
            'completed': OpportunityStatus.COMPLETED,
            'failed': OpportunityStatus.FAILED,
            'expired': OpportunityStatus.EXPIRED
          };
          
          newFilter.statuses = [statusMap[filter.status] || OpportunityStatus.PENDING];
        }
        
        // Retrieve opportunities for this agent using the new system
        const newOpportunities = await this.opportunityManager.findOpportunitiesForAgent(
          agentId,
          newFilter
        );
        
        // Convert to legacy format
        return newOpportunities.map(this.convertToLegacyOpportunity.bind(this));
      } catch (error) {
        console.error("Error retrieving opportunities from new system, falling back to internal storage:", error);
      }
    }
    
    // Fallback to internal storage if new system fails or isn't available
    let opportunities = Array.from(this.opportunities.values());
    
    if (filter) {
      if (filter.type !== undefined) {
        opportunities = opportunities.filter(o => o.type === filter.type);
      }
      
      if (filter.priority !== undefined) {
        opportunities = opportunities.filter(o => o.priority === filter.priority);
      }
      
      if (filter.status !== undefined) {
        opportunities = opportunities.filter(o => o.status === filter.status);
      }
    }
    
    return opportunities;
  }

  /**
   * Convert new opportunity format to legacy format
   */
  private convertToLegacyOpportunity(newOpp: NewOpportunity): IdentifiedOpportunity {
    // Extract trigger from metadata if available
    const trigger = (newOpp.metadata?.trigger as OpportunityTrigger) || {
      id: uuidv4(),
      type: 'unknown',
      source: 'system',
      timestamp: newOpp.createdAt,
      confidence: newOpp.metadata?.confidence as number || 0.5,
      context: {
        content: newOpp.description
      }
    };
    
    // Map priority from string to enum
    const priorityMap: Record<string, OpportunityPriority> = {
      'high': OpportunityPriority.HIGH,
      'medium': OpportunityPriority.MEDIUM,
      'low': OpportunityPriority.LOW
    };
    
    // Map opportunity type
    const typeMap: Record<string, OpportunityType> = {
      'task_optimization': OpportunityType.TASK_OPTIMIZATION,
      'error_recovery': OpportunityType.ERROR_RECOVERY,
      'resource_optimization': OpportunityType.RESOURCE_OPTIMIZATION,
      'user_assistance': OpportunityType.USER_ASSISTANCE,
      'scheduled_task': OpportunityType.SCHEDULED_TASK,
      'knowledge_acquisition': OpportunityType.KNOWLEDGE_ACQUISITION,
      'performance_optimization': OpportunityType.PERFORMANCE_OPTIMIZATION,
      'system_optimization': OpportunityType.SYSTEM_OPTIMIZATION
    };
    
    // Map status
    const statusMap: Record<string, string> = {
      [OpportunityStatus.PENDING]: 'pending',
      [OpportunityStatus.IN_PROGRESS]: 'in_progress',
      [OpportunityStatus.COMPLETED]: 'completed',
      [OpportunityStatus.FAILED]: 'failed',
      [OpportunityStatus.EXPIRED]: 'expired'
    };
    
    return {
      id: newOpp.id,
      type: typeMap[newOpp.type] || OpportunityType.TASK_OPTIMIZATION,
      trigger,
      priority: priorityMap[newOpp.priority] || OpportunityPriority.MEDIUM,
      context: {
        trigger: {},
        timestamp: new Date(),
        source: 'conversion',
        metadata: newOpp.metadata || {},
        relevantMemories: [],
        relevantKnowledge: [],
        insights: []
      },
      detectedAt: newOpp.createdAt,
      status: statusMap[newOpp.status] || 'pending',
      validUntil: newOpp.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      confidence: newOpp.metadata?.confidence as number || 0.5
    };
  }

  /**
   * Update the status of an opportunity
   */
  async updateOpportunityStatus(
    opportunityId: string,
    status: string,
    result?: Record<string, unknown>
  ): Promise<boolean> {
    this.ensureInitialized();
    
    if (this.opportunityManager) {
      try {
        // Map legacy status to new status
        const statusMap: Record<string, OpportunityStatus> = {
          'pending': OpportunityStatus.PENDING,
          'in_progress': OpportunityStatus.IN_PROGRESS,
          'completed': OpportunityStatus.COMPLETED,
          'failed': OpportunityStatus.FAILED,
          'expired': OpportunityStatus.EXPIRED
        };
        
        const newStatus = statusMap[status] || OpportunityStatus.PENDING;
        
        // Update status in the new system
        const updated = await this.opportunityManager.updateOpportunityStatus(
          opportunityId,
          newStatus,
          result
        );
        
        return !!updated;
      } catch (error) {
        console.error(`Error updating opportunity status in new system:`, error);
      }
    }
    
    // Fallback to internal storage
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      return false;
    }
    
    opportunity.status = status;
    if (result) {
      opportunity.result = result;
    }
    
    this.opportunities.set(opportunityId, opportunity);
    return true;
  }

  /**
   * Clear expired opportunities
   */
  async clearExpiredOpportunities(): Promise<number> {
    this.ensureInitialized();
    
    const now = new Date();
    let expiredCount = 0;
    
    if (this.opportunityManager) {
      try {
        // Use the new system to clear expired opportunities
        expiredCount = await this.opportunityManager.clearExpiredOpportunities(now);
      } catch (error) {
        console.error(`Error clearing expired opportunities in new system:`, error);
      }
    }
    
    // Always clear from internal storage as well
    const expiredIds: string[] = [];
    
    const opportunitiesArray = Array.from(this.opportunities.entries());
    for (const [id, opportunity] of opportunitiesArray) {
      if (opportunity.validUntil && opportunity.validUntil < now) {
        expiredIds.push(id);
      }
    }
    
    for (const id of expiredIds) {
      this.opportunities.delete(id);
    }
    
    return expiredCount || expiredIds.length;
  }

  /**
   * Ensure the system is initialized
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