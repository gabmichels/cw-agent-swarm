/**
 * BasicOpportunityManager.ts
 * 
 * Implements the OpportunityManager interface to orchestrate the opportunity management system.
 */

import { ulid } from 'ulid';
import { 
  Opportunity, 
  OpportunityCreationOptions, 
  OpportunityFilter, 
  OpportunityOrderOptions,
  OpportunityStatus 
} from '../models/opportunity.model';
import { 
  OpportunityManager, 
  OpportunityManagerConfig,
  OpportunityManagerStatus 
} from '../interfaces/OpportunityManager.interface';
import { 
  OpportunityDetector, 
  TriggerDetectionOptions, 
  OpportunityDetectionResult 
} from '../interfaces/OpportunityDetector.interface';
import { 
  OpportunityRegistry 
} from '../interfaces/OpportunityRegistry.interface';
import { 
  OpportunityEvaluator, 
  EvaluationResult,
  OpportunityEvaluation
} from '../interfaces/OpportunityEvaluator.interface';
import { 
  OpportunityProcessor, 
  ProcessingResult, 
  BatchProcessingResult 
} from '../interfaces/OpportunityProcessor.interface';
import { OpportunityManagerError } from '../errors/OpportunityError';

/**
 * Basic implementation of the OpportunityManager
 */
export class BasicOpportunityManager implements OpportunityManager {
  private id: string;
  private initialized: boolean = false;
  private lastActivity: Date = new Date();
  private pollingInterval: NodeJS.Timeout | null = null;
  private config: Required<OpportunityManagerConfig> = {
    detector: {},
    evaluator: {},
    processor: {},
    autoProcessing: {
      enabled: false,
      minScoreThreshold: 0.7,
      minPriorityThreshold: 'high'
    },
    polling: {
      enabled: false,
      intervalMs: 60000, // 1 minute
      sources: []
    }
  };
  
  /**
   * Constructor for the BasicOpportunityManager
   */
  constructor(
    private readonly registry: OpportunityRegistry,
    private readonly detector: OpportunityDetector,
    private readonly evaluator: OpportunityEvaluator,
    private readonly processor: OpportunityProcessor
  ) {
    this.id = ulid();
  }
  
  /**
   * Get the unique ID of this opportunity manager
   */
  getId(): string {
    return this.id;
  }
  
  /**
   * Initialize the opportunity manager
   */
  async initialize(config?: OpportunityManagerConfig): Promise<boolean> {
    try {
      // Merge config with defaults
      if (config) {
        this.config = {
          detector: config.detector || {},
          evaluator: config.evaluator || {},
          processor: config.processor || {},
          autoProcessing: {
            enabled: config.autoProcessing?.enabled ?? this.config.autoProcessing.enabled,
            minScoreThreshold: config.autoProcessing?.minScoreThreshold ?? this.config.autoProcessing.minScoreThreshold,
            minPriorityThreshold: config.autoProcessing?.minPriorityThreshold ?? this.config.autoProcessing.minPriorityThreshold
          },
          polling: {
            enabled: config.polling?.enabled ?? this.config.polling.enabled,
            intervalMs: config.polling?.intervalMs ?? this.config.polling.intervalMs,
            sources: config.polling?.sources ?? this.config.polling.sources
          }
        };
      }
      
      // Initialize components
      await this.registry.initialize();
      await this.detector.initialize(this.config.detector);
      await this.evaluator.initialize(this.config.evaluator);
      await this.processor.initialize(this.config.processor);
      
      // Start polling if enabled
      if (this.config.polling.enabled) {
        await this.startPolling();
      }
      
      this.initialized = true;
      this.updateLastActivity();
      
      return true;
    } catch (error) {
      throw new OpportunityManagerError(
        `Failed to initialize opportunity manager: ${error instanceof Error ? error.message : String(error)}`,
        'INITIALIZATION_FAILED',
        { config }
      );
    }
  }
  
  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityManagerError(
        'Opportunity manager not initialized',
        'NOT_INITIALIZED',
        { id: this.id }
      );
    }
    
    this.updateLastActivity();
  }
  
  /**
   * Update the last activity timestamp
   */
  private updateLastActivity(): void {
    this.lastActivity = new Date();
  }
  
  /**
   * Get the current system status
   */
  async getStatus(): Promise<OpportunityManagerStatus> {
    this.ensureInitialized();
    
    // Get count of opportunities by status
    const statusCounts: Record<OpportunityStatus, number> = {} as Record<OpportunityStatus, number>;
    
    // Initialize all status counts to 0
    Object.values(OpportunityStatus).forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count opportunities for each status
    for (const status of Object.values(OpportunityStatus)) {
      statusCounts[status] = await this.registry.countOpportunities({
        statuses: [status]
      });
    }
    
    // Get total count
    const opportunityCount = await this.registry.countOpportunities();
    
    // Get health status from all components
    const [
      registryHealth,
      detectorHealth,
      evaluatorHealth,
      processorHealth
    ] = await Promise.all([
      this.registry.getHealth(),
      this.detector.getHealth(),
      this.evaluator.getHealth(),
      this.processor.getHealth()
    ]);
    
    // Get active strategies
    const activeStrategies = await this.detector.getAvailableStrategies();
    
    return {
      initialized: this.initialized,
      lastActivity: this.lastActivity,
      opportunityCount,
      statusCounts,
      activeStrategies,
      health: {
        registry: {
          isHealthy: registryHealth.isHealthy,
          lastCheck: registryHealth.lastCheck
        },
        detector: {
          isHealthy: detectorHealth.isHealthy,
          lastCheck: detectorHealth.lastCheck
        },
        evaluator: {
          isHealthy: evaluatorHealth.isHealthy,
          lastCheck: evaluatorHealth.lastCheck
        },
        processor: {
          isHealthy: processorHealth.isHealthy,
          lastCheck: processorHealth.lastCheck
        }
      }
    };
  }
  
  /**
   * Create a new opportunity
   */
  async createOpportunity(options: OpportunityCreationOptions): Promise<Opportunity> {
    this.ensureInitialized();
    
    const opportunity = await this.registry.createOpportunity(options);
    
    // Auto-evaluate if appropriate
    if (opportunity) {
      try {
        await this.evaluateOpportunity(opportunity.id);
      } catch (error) {
        // Log error but don't fail the creation
        console.error(`Failed to auto-evaluate opportunity ${opportunity.id}:`, error);
      }
    }
    
    return opportunity;
  }
  
  /**
   * Create an opportunity for a specific agent
   */
  async createOpportunityForAgent(
    options: OpportunityCreationOptions,
    agentId: string
  ): Promise<Opportunity> {
    // Set agent ID in context
    const optionsWithAgent: OpportunityCreationOptions = {
      ...options,
      context: {
        ...options.context,
        agentId
      }
    };
    
    return this.createOpportunity(optionsWithAgent);
  }
  
  /**
   * Get an opportunity by ID
   */
  async getOpportunityById(id: string): Promise<Opportunity | null> {
    this.ensureInitialized();
    return this.registry.getOpportunityById(id);
  }
  
  /**
   * Update an opportunity
   */
  async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> {
    this.ensureInitialized();
    return this.registry.updateOpportunity(id, updates);
  }
  
  /**
   * Delete an opportunity
   */
  async deleteOpportunity(id: string): Promise<boolean> {
    this.ensureInitialized();
    return this.registry.deleteOpportunity(id);
  }
  
  /**
   * Find opportunities matching a filter
   */
  async findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    return this.registry.findOpportunities(filter, orderBy, limit, offset);
  }
  
  /**
   * Find opportunities for a specific agent
   */
  async findOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    return this.registry.findOpportunitiesForAgent(agentId, filter, orderBy, limit, offset);
  }
  
  /**
   * Detect opportunities from content
   */
  async detectOpportunities(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityDetectionResult> {
    this.ensureInitialized();
    
    // Detect triggers
    const triggers = await this.detector.detectTriggers(content, options);
    
    // Convert triggers to opportunities
    const detectionResult = await this.detector.detectOpportunities(
      triggers,
      options.agentId
    );
    
    // Auto-evaluate and process if enabled
    if (detectionResult.opportunities.length > 0 && this.config.autoProcessing.enabled) {
      try {
        const evaluationPromises = detectionResult.opportunities.map(opp => 
          this.evaluateOpportunity(opp.id)
        );
        
        await Promise.all(evaluationPromises);
      } catch (error) {
        console.error('Error during auto-evaluation:', error);
      }
    }
    
    return detectionResult;
  }
  
  /**
   * Evaluate an opportunity
   */
  async evaluateOpportunity(opportunityId: string): Promise<EvaluationResult> {
    this.ensureInitialized();
    
    // Get the opportunity
    const opportunity = await this.registry.getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new OpportunityManagerError(
        `Opportunity with ID ${opportunityId} not found`,
        'OPPORTUNITY_NOT_FOUND',
        { opportunityId }
      );
    }
    
    // Update status to evaluating
    await this.registry.updateOpportunityStatus(
      opportunityId,
      OpportunityStatus.EVALUATING
    );
    
    // Evaluate the opportunity
    const evaluationResult = await this.evaluator.evaluateOpportunity(opportunity);
    
    if (evaluationResult.success) {
      // Update the opportunity with evaluation results
      const evaluation = evaluationResult.evaluation!;
      
      await this.registry.updateOpportunity(opportunityId, {
        score: evaluation.score,
        priority: evaluation.recommendedPriority,
        timeSensitivity: evaluation.recommendedTimeSensitivity,
        evaluatedAt: evaluation.evaluatedAt,
        status: OpportunityStatus.PENDING
      });
      
      // Auto-process if enabled and meets criteria
      if (
        this.config.autoProcessing.enabled &&
        // @ts-ignore - we know this is valid since we've checked evaluationResult.success
        evaluation.score!.overall >= this.config.autoProcessing.minScoreThreshold
      ) {
        try {
          await this.processOpportunity(opportunityId);
        } catch (error) {
          console.error(`Failed to auto-process opportunity ${opportunityId}:`, error);
        }
      }
    } else {
      // Update status to reflect evaluation failure
      await this.registry.updateOpportunityStatus(
        opportunityId,
        OpportunityStatus.FAILED,
        {
          errorMessage: evaluationResult.error,
          errorTimestamp: new Date()
        }
      );
    }
    
    return evaluationResult;
  }
  
  /**
   * Process an opportunity into tasks
   */
  async processOpportunity(opportunityId: string): Promise<ProcessingResult> {
    this.ensureInitialized();
    
    // Get the opportunity
    const opportunity = await this.registry.getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new OpportunityManagerError(
        `Opportunity with ID ${opportunityId} not found`,
        'OPPORTUNITY_NOT_FOUND',
        { opportunityId }
      );
    }
    
    // Update status to in progress
    await this.registry.updateOpportunityStatus(
      opportunityId,
      OpportunityStatus.IN_PROGRESS
    );
    
    // Process the opportunity
    const processingResult = await this.processor.processOpportunity(opportunity);
    
    // Status gets updated by the processor if auto-complete is enabled
    
    return processingResult;
  }
  
  /**
   * Process all opportunities for an agent that meet criteria
   */
  async processOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    limit?: number
  ): Promise<BatchProcessingResult> {
    this.ensureInitialized();
    
    // Create combined filter with agent ID
    const combinedFilter: OpportunityFilter = {
      ...filter,
      agentIds: [agentId]
    };
    
    // Process matching opportunities
    return this.processor.processMatchingOpportunities(combinedFilter, limit);
  }
  
  /**
   * Update the status of an opportunity
   */
  async updateOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    result?: Record<string, unknown>
  ): Promise<Opportunity | null> {
    this.ensureInitialized();
    return this.registry.updateOpportunityStatus(id, status, result);
  }
  
  /**
   * Start background polling for opportunities
   */
  async startPolling(): Promise<boolean> {
    this.ensureInitialized();
    
    if (!this.config.polling.enabled) {
      return false;
    }
    
    // Stop existing polling if any
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Set up polling
    this.pollingInterval = setInterval(
      () => this.pollForOpportunities(),
      this.config.polling.intervalMs
    );
    
    return true;
  }
  
  /**
   * Stop background polling
   */
  async stopPolling(): Promise<boolean> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      return true;
    }
    
    return false;
  }
  
  /**
   * Poll for opportunities from configured sources
   */
  private async pollForOpportunities(): Promise<void> {
    if (!this.initialized || !this.config.polling.enabled) {
      return;
    }
    
    try {
      // Currently, polling is not implemented
      // This would be a place to integrate with external sources,
      // scheduled checks, etc.
      
      // Example implementation would:
      // 1. Check each configured source
      // 2. For each source, fetch new data/content
      // 3. Pass content to detectOpportunities with appropriate options
      
      // This is a placeholder for future implementation
    } catch (error) {
      console.error('Error during opportunity polling:', error);
    }
  }
  
  /**
   * Clear expired opportunities
   */
  async clearExpiredOpportunities(before?: Date): Promise<number> {
    this.ensureInitialized();
    return this.registry.clearExpiredOpportunities(before);
  }
  
  /**
   * Get health status for all components
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    components: {
      registry: { isHealthy: boolean; lastCheck: Date };
      detector: { isHealthy: boolean; lastCheck: Date };
      evaluator: { isHealthy: boolean; lastCheck: Date };
      processor: { isHealthy: boolean; lastCheck: Date };
    };
  }> {
    const now = new Date();
    
    try {
      // Get health status from each component
      const [
        registryHealth,
        detectorHealth,
        evaluatorHealth,
        processorHealth
      ] = await Promise.all([
        this.registry.getHealth(),
        this.detector.getHealth(),
        this.evaluator.getHealth(),
        this.processor.getHealth()
      ]);
      
      // Determine overall health
      const isHealthy = 
        this.initialized &&
        registryHealth.isHealthy &&
        detectorHealth.isHealthy &&
        evaluatorHealth.isHealthy &&
        processorHealth.isHealthy;
      
      return {
        isHealthy,
        lastCheck: now,
        components: {
          registry: {
            isHealthy: registryHealth.isHealthy,
            lastCheck: registryHealth.lastCheck
          },
          detector: {
            isHealthy: detectorHealth.isHealthy,
            lastCheck: detectorHealth.lastCheck
          },
          evaluator: {
            isHealthy: evaluatorHealth.isHealthy,
            lastCheck: evaluatorHealth.lastCheck
          },
          processor: {
            isHealthy: processorHealth.isHealthy,
            lastCheck: processorHealth.lastCheck
          }
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: now,
        components: {
          registry: { isHealthy: false, lastCheck: now },
          detector: { isHealthy: false, lastCheck: now },
          evaluator: { isHealthy: false, lastCheck: now },
          processor: { isHealthy: false, lastCheck: now }
        }
      };
    }
  }
} 