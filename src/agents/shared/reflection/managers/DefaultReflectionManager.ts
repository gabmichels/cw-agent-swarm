/**
 * Default Reflection Manager Implementation
 * 
 * This file implements the default reflection manager that handles agent
 * self-reflection, learning, and improvement.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ReflectionManager, 
  ReflectionManagerConfig,
  ReflectionTrigger,
  Reflection,
  KnowledgeGap,
  PerformanceMetrics,
  ReflectionStrategy,
  ReflectionResult
} from '../../base/managers/ReflectionManager.interface';
import { ManagerHealth } from '../../base/managers/ManagerHealth';
import { AgentBase } from '../../base/AgentBase.interface';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { createConfigFactory } from '../../config';
import { ReflectionManagerConfigSchema } from '../config/ReflectionManagerConfigSchema';
import { ManagerType } from '../../base/managers/ManagerType';
import { VisualizationService, ThinkingVisualization } from '../../../../services/thinking/visualization/types';

/**
 * Error class for reflection-related errors
 */
class ReflectionError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'REFLECTION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ReflectionError';
    this.code = code;
    this.context = context;
  }
}

// Update the base ReflectionInsight interface
interface ReflectionInsightMetadata extends Record<string, unknown> {
  source: string;
  applicationStatus: 'pending' | 'applied' | 'rejected';
  category: 'error_handling' | 'knowledge_gap' | 'improvement' | 'tool' | 'general';
  relatedInsights: string[];
  appliedAt?: Date;
}

interface LocalReflectionInsight {
  id: string;
  type: 'error' | 'learning' | 'pattern' | 'improvement' | 'warning';
  content: string;
  timestamp: Date;
  reflectionId: string;
  confidence: number;
  metadata: ReflectionInsightMetadata;
}

interface ImprovementAction {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  sourceInsightId: string;
  status: 'suggested' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetArea: 'tools' | 'planning' | 'learning' | 'knowledge' | 'execution' | 'interaction';
  expectedImpact: number;
  difficulty: number;
  implementationSteps: Array<{
    description: string;
    status: 'pending' | 'completed' | 'failed';
  }>;
}

/**
 * Default implementation of the ReflectionManager interface
 */
export class DefaultReflectionManager extends AbstractBaseManager implements ReflectionManager {
  // Private members specific to this manager
  private configFactory = createConfigFactory(ReflectionManagerConfigSchema);
  private reflections: Map<string, Reflection> = new Map();
  private insights: Map<string, LocalReflectionInsight> = new Map();
  private lastReflectionTime: Date | null = null;
  private metrics: Record<string, number> = {};
  
  // Override config type to use specific config type
  protected config!: ReflectionManagerConfig & Record<string, unknown>;

  // Track error recovery reflections for learning
  private errorRecoveryReflections: Map<string, {
    taskId: string,
    errorCategory: string,
    reflectionId: string,
    insights: string[],
    timestamp: Date,
    recoverySuccessful: boolean
  }[]> = new Map();

  /**
   * Create a new DefaultReflectionManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<ReflectionManagerConfig> = {}
  ) {
    super(
      `reflection-manager-${uuidv4()}`,
      ManagerType.REFLECTION,
      agent,
      { enabled: true }
    );
    
    // Create default configuration with required fields
    const defaultConfig: ReflectionManagerConfig & Record<string, unknown> = {
      enabled: true,
      reflectionDepth: 'standard',
      adaptiveBehavior: true,
      adaptationRate: 0.3,
      reflectionFrequency: {
        minIntervalMs: 60000, // 1 minute
        interval: 3600000, // 1 hour
        afterEachInteraction: false,
        afterErrors: true
      },
      persistReflections: true,
      maxHistoryItems: 100,
      improvementGoals: [],
      metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors']
    };
    
    // Merge with provided config
    this.config = {
      ...defaultConfig,
      ...config
    };
    
    // Initialize metrics
    this.initializeMetrics();
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    // Initialize metrics based on configured metrics to track
    const metricsToTrack = this.config.metricsToTrack || [];
    
    for (const metric of metricsToTrack) {
      this.metrics[metric] = 0;
    }
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ReflectionManagerConfig>(config: Partial<T>): T {
    // Merge with current config
    this.config = {
      ...this.config,
      ...config
    };
    
    // Reinitialize metrics if they changed
    if ('metricsToTrack' in config) {
      this.initializeMetrics();
    }
    
    return this.config as unknown as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // Load persisted reflections if enabled
    if (this.config.persistReflections) {
      try {
        await this.loadPersistedReflections();
      } catch (error) {
        console.warn('Failed to load persisted reflections:', error);
      }
    }
    
    this._initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Persist reflections if enabled
    if (this.config.persistReflections) {
      try {
        await this.persistReflections();
      } catch (error) {
        console.warn('Failed to persist reflections during shutdown:', error);
      }
    }
    
    this._initialized = false;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    
    // Clear all reflections and insights
    this.reflections.clear();
    this.insights.clear();
    this.lastReflectionTime = null;
    
    // Reset metrics
    this.initializeMetrics();
    
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Manager not initialized',
            detectedAt: new Date()
          }]
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          reflectionCount: this.reflections.size,
          insightCount: this.insights.size,
          metrics: this.metrics,
          lastReflectionTime: this.lastReflectionTime
        }
      }
    };
  }

  /**
   * Reflect on the agent's performance, operations, or a specific topic
   */
  async reflect(
    trigger: ReflectionTrigger,
    context?: Record<string, unknown>
  ): Promise<ReflectionResult> {
    if (!this._initialized) {
      throw new ReflectionError(
        'Cannot reflect: Manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // Check if reflection frequency allows reflection
    if (!this.canReflectNow(trigger)) {
      return {
        success: false,
        id: '',
        insights: [],
        message: 'Reflection skipped due to frequency constraints'
      };
    }

    // Extract visualization context if provided
    const visualization = context?.visualization as ThinkingVisualization | undefined;
    const visualizer = context?.visualizer as VisualizationService | undefined;
    let reflectionNodeId: string | undefined;

    try {
      // Create reflection record
      const reflectionId = uuidv4();
      const reflection: Reflection = {
        id: reflectionId,
        timestamp: new Date(),
        trigger,
        context: context || {},
        depth: this.config.reflectionDepth || 'standard',
        insights: [],
        metrics: { ...this.metrics }
      };

      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create a reflection visualization node
          reflectionNodeId = visualizer.addNode(
            visualization,
            'reflection', // VisualizationNodeType.REFLECTION
            `Agent Reflection (${trigger})`,
            {
              reflectionId,
              trigger,
              depth: reflection.depth,
              timestamp: reflection.timestamp.getTime(),
              contextType: context?.type || 'general'
            },
            'in_progress'
          );

          // Store the node ID in the reflection context for reference
          if (reflectionNodeId) {
            reflection.context.visualizationNodeId = reflectionNodeId;
          }
        } catch (visualizationError) {
          console.error('Error creating reflection visualization node:', visualizationError);
        }
      }

      // Add to reflections map
      this.reflections.set(reflectionId, reflection);
      this.lastReflectionTime = reflection.timestamp;

      // Generate insights based on reflection depth and trigger type
      const insights = await this.generateInsights(reflection);
      reflection.insights = insights.map(insight => insight.id);

      // For error-triggered reflections, track them for learning
      if (trigger === ReflectionTrigger.ERROR && context) {
        await this.trackErrorRecoveryReflection(reflectionId, context, insights);
      }

      // Apply insights if adaptive behavior is enabled
      if (this.config.adaptiveBehavior) {
        await this.applyInsights(insights);
      }

      // Update metrics
      this.updateMetrics(reflection, insights);

      // Update visualization node with results if available
      if (visualization && visualizer && reflectionNodeId) {
        try {
          // Create insight nodes for each insight
          const insightNodeIds: string[] = [];
          
          for (const insight of insights) {
            // Add insight node
            const insightNodeId = visualizer.addNode(
              visualization,
              'insight', // VisualizationNodeType.INSIGHT
              `Insight: ${insight.type}`,
              {
                insightId: insight.id,
                type: insight.type,
                content: insight.content,
                confidence: insight.confidence,
                timestamp: insight.timestamp.getTime(),
                metadata: insight.metadata,
              },
              'completed'
            );
            
            insightNodeIds.push(insightNodeId);
            
            // Add edge from reflection to insight
            visualizer.addEdge(
              visualization,
              reflectionNodeId,
              insightNodeId,
              'child', // VisualizationEdgeType.CHILD
              'generated'
            );
          }
          
          // Update the reflection node
          visualizer.updateNode(
            visualization,
            reflectionNodeId,
            {
              status: 'completed',
              data: {
                reflectionId,
                trigger,
                depth: reflection.depth,
                timestamp: reflection.timestamp.getTime(),
                insightCount: insights.length,
                insightTypes: Array.from(new Set(insights.map(i => i.type))),
                insightNodeIds,
                adaptiveBehavior: this.config.adaptiveBehavior,
                metrics: { ...this.metrics }
              }
            }
          );
        } catch (visualizationError) {
          console.error('Error updating reflection visualization:', visualizationError);
        }
      }

      // Clean up old reflections if needed
      await this.cleanupOldReflections();

      // Persist reflections if enabled
      if (this.config.persistReflections) {
        await this.persistReflections();
      }

      return {
        success: true,
        id: reflectionId,
        insights: insights,
        message: `Reflection complete with ${insights.length} insights`
      };
    } catch (error) {
      console.error('Error during reflection:', error);
      
      // Update visualization with error if enabled
      if (visualization && visualizer && reflectionNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            reflectionNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined
              }
            }
          );
        } catch (visualizationError) {
          console.error('Error updating reflection visualization with error:', visualizationError);
        }
      }
      
      return {
        success: false,
        id: '',
        insights: [],
        message: `Reflection failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Track error recovery reflections for learning patterns
   */
  private async trackErrorRecoveryReflection(
    reflectionId: string,
    context: Record<string, unknown>,
    insights: LocalReflectionInsight[]
  ): Promise<void> {
    try {
      // Extract error recovery context
      const recoveryContext = context.recoveryContext as Record<string, unknown> | undefined;
      if (!recoveryContext || !recoveryContext.taskId) {
        return;
      }

      const taskId = String(recoveryContext.taskId);
      const errorCategory = recoveryContext.errorCategory ? String(recoveryContext.errorCategory) : 'unknown';
      
      // Extract recovery result
      const recoveryResult = context.recoveryResult as Record<string, unknown> | undefined;
      const recoverySuccessful = recoveryResult ? Boolean(recoveryResult.success) : false;

      // Create entry
      const entry = {
        taskId,
        errorCategory,
        reflectionId,
        insights: insights.map(i => i.id),
        timestamp: new Date(),
        recoverySuccessful
      };

      // Extract visualization context if provided
      const visualization = context.visualization as ThinkingVisualization | undefined;
      const visualizer = context.visualizer as VisualizationService | undefined;
      
      // Add error recovery visualization if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Get the parent reflection node ID if available
          const parentNodeId = context.visualizationNodeId as string | undefined;
          
          // Create an error recovery tracking node
          const recoveryNodeId = visualizer.addNode(
            visualization,
            'error_recovery',
            `Error Recovery (${errorCategory})`,
            {
              taskId,
              errorCategory,
              reflectionId,
              timestamp: entry.timestamp.getTime(),
              recoverySuccessful,
              insightCount: insights.length
            },
            recoverySuccessful ? 'completed' : 'error'
          );
          
          // Add edge from parent reflection node if available
          if (parentNodeId) {
            visualizer.addEdge(
              visualization,
              parentNodeId,
              recoveryNodeId,
              'child',
              'error_recovery'
            );
          }
        } catch (visualizationError) {
          console.error('Error creating error recovery visualization:', visualizationError);
        }
      }

      // Get existing entries for this task or create new array
      const existingEntries = this.errorRecoveryReflections.get(taskId) || [];
      existingEntries.push(entry);
      
      // Update map
      this.errorRecoveryReflections.set(taskId, existingEntries);
      
      // If we have multiple reflections for the same task, analyze patterns
      if (existingEntries.length >= 2) {
        await this.analyzeErrorRecoveryPatterns(taskId, existingEntries, context);
      }
    } catch (error) {
      console.error('Error tracking error recovery reflection:', error);
    }
  }

  /**
   * Analyze patterns in error recoveries for a task to improve future handling
   */
  private async analyzeErrorRecoveryPatterns(
    taskId: string,
    entries: {
      taskId: string,
      errorCategory: string,
      reflectionId: string,
      insights: string[],
      timestamp: Date,
      recoverySuccessful: boolean
    }[],
    context: Record<string, unknown>
  ): Promise<void> {
    try {
      // Get details for all reflections
      const reflectionDetails = entries.map(entry => {
        const reflection = this.reflections.get(entry.reflectionId);
        return {
          ...entry,
          context: reflection?.context || {},
          fullReflection: reflection
        };
      });
      
      // Extract visualization context if provided
      const visualization = context.visualization as ThinkingVisualization | undefined;
      const visualizer = context.visualizer as VisualizationService | undefined;
      let patternNodeId: string | undefined;
      
      // Create a new reflection about the patterns in error recovery
      const metaReflectionId = uuidv4();
      const metaReflection: Reflection = {
        id: metaReflectionId,
        timestamp: new Date(),
        trigger: ReflectionTrigger.INSIGHT,
        context: {
          taskId,
          reflectionType: 'error_recovery_pattern_analysis',
          recoveryAttempts: entries.length,
          successfulRecoveries: entries.filter(e => e.recoverySuccessful).length,
          errorCategories: Array.from(new Set(entries.map(e => e.errorCategory))),
          ...context
        },
        depth: 'deep',
        insights: [],
        metrics: { ...this.metrics }
      };
      
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create a pattern analysis visualization node
          patternNodeId = visualizer.addNode(
            visualization,
            'pattern_analysis',
            `Error Recovery Pattern Analysis (Task: ${taskId})`,
            {
              taskId,
              metaReflectionId,
              timestamp: metaReflection.timestamp.getTime(),
              recoveryAttempts: entries.length,
              successfulRecoveries: entries.filter(e => e.recoverySuccessful).length,
              errorCategories: Array.from(new Set(entries.map(e => e.errorCategory)))
            },
            'in_progress'
          );
          
          // Connect to all related reflection nodes
          for (const entry of entries) {
            const reflectionNodeId = this.reflections.get(entry.reflectionId)?.context.visualizationNodeId;
            if (reflectionNodeId && patternNodeId) {
              visualizer.addEdge(
                visualization,
                reflectionNodeId as string,
                patternNodeId,
                'influence',
                'contributes_to_pattern'
              );
            }
          }
          
          // Store the node ID in the meta-reflection context
          if (patternNodeId) {
            metaReflection.context.visualizationNodeId = patternNodeId;
          }
        } catch (visualizationError) {
          console.error('Error creating pattern analysis visualization node:', visualizationError);
        }
      }
      
      // Generate meta-insights about error recovery patterns
      const metaInsights = await this.generateErrorRecoveryInsights(reflectionDetails, metaReflection);
      metaReflection.insights = metaInsights.map(insight => insight.id);
      
      // Store the meta-reflection
      this.reflections.set(metaReflectionId, metaReflection);
      
      // Update visualization with insights if visualization is enabled
      if (visualization && visualizer && patternNodeId) {
        try {
          // Create insight nodes for each meta-insight
          const insightNodeIds: string[] = [];
          
          for (const insight of metaInsights) {
            // Add insight node
            const insightNodeId = visualizer.addNode(
              visualization,
              'insight',
              `Pattern Insight: ${insight.type}`,
              {
                insightId: insight.id,
                type: insight.type,
                content: insight.content,
                confidence: insight.confidence,
                timestamp: insight.timestamp.getTime(),
                metadata: insight.metadata
              },
              'completed'
            );
            
            insightNodeIds.push(insightNodeId);
            
            // Add edge from pattern node to insight
            visualizer.addEdge(
              visualization,
              patternNodeId,
              insightNodeId,
              'child',
              'generated'
            );
          }
          
          // Update the pattern node
          visualizer.updateNode(
            visualization,
            patternNodeId,
            {
              status: 'completed',
              data: {
                insightCount: metaInsights.length,
                insightTypes: Array.from(new Set(metaInsights.map(i => i.type))),
                insightNodeIds
              }
            }
          );
        } catch (visualizationError) {
          console.error('Error updating pattern analysis visualization:', visualizationError);
        }
      }
      
      // If adaptive behavior is enabled, apply these meta-insights
      if (this.config.adaptiveBehavior) {
        await this.applyInsights(metaInsights, true); // true = higher priority for adaptation
      }
    } catch (error) {
      console.error('Error analyzing error recovery patterns:', error);
      
      // Update visualization with error if enabled
      if (context.visualization && context.visualizer && context.patternNodeId) {
        try {
          (context.visualizer as VisualizationService).updateNode(
            context.visualization as ThinkingVisualization,
            context.patternNodeId as string,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined
              }
            }
          );
        } catch (visualizationError) {
          console.error('Error updating pattern analysis visualization with error:', visualizationError);
        }
      }
    }
  }

  /**
   * Generate insights about error recovery patterns
   */
  private async generateErrorRecoveryInsights(
    reflectionDetails: Array<{
      taskId: string,
      errorCategory: string,
      reflectionId: string,
      insights: string[],
      timestamp: Date,
      recoverySuccessful: boolean,
      context: Record<string, unknown>,
      fullReflection?: Reflection
    }>,
    metaReflection: Reflection
  ): Promise<LocalReflectionInsight[]> {
    const insights: LocalReflectionInsight[] = [];
    
    try {
      // Extract all previous insights for reference
      const allPreviousInsights = reflectionDetails
        .flatMap(rd => rd.insights)
        .map(insightId => this.insights.get(insightId))
        .filter(Boolean) as LocalReflectionInsight[];
      
      // Get error categories as string array
      const errorCategories = Array.from(new Set(reflectionDetails.map(rd => rd.errorCategory)));
      
      // 1. Create insight about common error patterns
      const commonErrorInsight: LocalReflectionInsight = {
        id: uuidv4(),
        type: 'pattern',
        content: `Task ${metaReflection.context.taskId} experienced ${reflectionDetails.length} error recovery attempts, with patterns in error categories: ${errorCategories.join(', ')}`,
        timestamp: new Date(),
        reflectionId: metaReflection.id,
        confidence: 0.8,
        metadata: {
          source: 'error_pattern_analysis',
          applicationStatus: 'pending',
          category: 'error_handling',
          relatedInsights: allPreviousInsights.map(i => i.id)
        }
      };
      
      insights.push(commonErrorInsight);
      this.insights.set(commonErrorInsight.id, commonErrorInsight);
      
      // 2. Create insight about successful vs failed recovery approaches
      const successfulRecoveries = reflectionDetails.filter(rd => rd.recoverySuccessful);
      const failedRecoveries = reflectionDetails.filter(rd => !rd.recoverySuccessful);
      
      if (successfulRecoveries.length > 0 && failedRecoveries.length > 0) {
        const recoveryComparisonInsight: LocalReflectionInsight = {
          id: uuidv4(),
          type: 'learning',
          content: `Analysis of successful vs. failed recovery approaches for task ${metaReflection.context.taskId}. ${successfulRecoveries.length} successful and ${failedRecoveries.length} failed recovery attempts.`,
          timestamp: new Date(),
          reflectionId: metaReflection.id,
          confidence: 0.75,
          metadata: {
            source: 'recovery_comparison',
            applicationStatus: 'pending',
            category: 'error_handling',
            relatedInsights: [commonErrorInsight.id]
          }
        };
        
        insights.push(recoveryComparisonInsight);
        this.insights.set(recoveryComparisonInsight.id, recoveryComparisonInsight);
      }
      
      // 3. Create an action recommendation insight
      const actionRecommendationInsight: LocalReflectionInsight = {
        id: uuidv4(),
        type: 'improvement',
        content: `Based on ${reflectionDetails.length} error recovery attempts for task ${metaReflection.context.taskId}, recommend improving error handling for error categories: ${errorCategories.join(', ')}`,
        timestamp: new Date(),
        reflectionId: metaReflection.id,
        confidence: 0.7,
        metadata: {
          source: 'error_recovery_learning',
          applicationStatus: 'pending',
          category: 'improvement',
          relatedInsights: insights.map(i => i.id)
        }
      };
      
      insights.push(actionRecommendationInsight);
      this.insights.set(actionRecommendationInsight.id, actionRecommendationInsight);
      
    } catch (error) {
      console.error('Error generating error recovery insights:', error);
    }
    
    return insights;
  }

  /**
   * Apply insights to agent behavior
   */
  private async applyInsights(
    insights: LocalReflectionInsight[], 
    highPriority = false
  ): Promise<void> {
    // Here we'll implement more sophisticated insight application
    try {
      for (const insight of insights) {
        // Mark the insight as applied if metadata exists
        if (insight.metadata) {
          insight.metadata.applicationStatus = 'applied';
          insight.metadata.appliedAt = new Date();
          this.insights.set(insight.id, insight);
        }
        
        // If it's an error handling insight, create improvement actions
        const category = insight.metadata?.category as string | undefined;
        const source = insight.metadata?.source as string | undefined;
        
        if (category === 'error_handling' || 
            (source && (source.includes('error') || source.includes('recovery')))) {
          await this.createImprovementActionFromInsight(insight, highPriority);
        }
      }
    } catch (error) {
      console.error('Error applying insights:', error);
    }
  }

  /**
   * Create an improvement action from an insight
   */
  private async createImprovementActionFromInsight(
    insight: LocalReflectionInsight,
    highPriority = false
  ): Promise<string | null> {
    try {
      const actionId = uuidv4();
      
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      
      if (highPriority) {
        priority = insight.confidence > 0.8 ? 'critical' : 'high';
      } else {
        priority = insight.confidence > 0.8 ? 'high' : 
                  insight.confidence > 0.6 ? 'medium' : 'low';
      }
      
      let targetArea: 'tools' | 'planning' | 'learning' | 'knowledge' | 'execution' | 'interaction' = 'execution';
      
      if (insight.metadata.category === 'knowledge_gap') {
        targetArea = 'knowledge';
      } else if (insight.metadata.category === 'improvement') {
        targetArea = 'learning';
      } else if (insight.metadata.category === 'tool') {
        targetArea = 'tools';
      }
      
      const action: ImprovementAction = {
        id: actionId,
        title: `Improvement from ${insight.type} insight`,
        description: insight.content,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: insight.id,
        status: 'suggested',
        priority,
        targetArea,
        expectedImpact: insight.confidence,
        difficulty: 3,
        implementationSteps: [
          {
            description: `Apply learning from insight: ${insight.content}`,
            status: 'pending'
          }
        ]
      };
      
      return actionId;
    } catch (error) {
      console.error('Error creating improvement action:', error);
      return null;
    }
  }

  /**
   * Check if the agent can reflect now based on frequency settings
   */
  private canReflectNow(trigger: ReflectionTrigger): boolean {
    // Check trigger-based rules
    if (trigger === 'error' && this.config.reflectionFrequency?.afterErrors) {
      // Allow reflection after errors if configured
      return true;
    }

    if (trigger === 'interaction' && this.config.reflectionFrequency?.afterEachInteraction) {
      // Allow reflection after interactions if configured
      return true;
    }

    // Check time-based rules
    const now = new Date();
    
    if (this.lastReflectionTime) {
      const elapsed = now.getTime() - this.lastReflectionTime.getTime();
      
      // If minimum interval hasn't passed, don't reflect
      if (elapsed < (this.config.reflectionFrequency?.minIntervalMs || 60000)) {
        return false;
      }
      
      // If regular interval has passed, allow reflection
      if (elapsed >= (this.config.reflectionFrequency?.interval || 3600000)) {
        return true;
      }
    } else {
      // No previous reflection, allow it
      return true;
    }

    // For manual trigger, always allow
    return trigger === 'manual';
  }

  /**
   * Generate insights for a reflection with enhanced error handling support
   */
  private async generateInsights(reflection: Reflection): Promise<LocalReflectionInsight[]> {
    const insights: LocalReflectionInsight[] = [];
    
    const insightCount = this.getInsightCountForDepth(reflection.depth as 'light' | 'standard' | 'deep');
    
    try {
      if (reflection.trigger === ReflectionTrigger.ERROR) {
        return await this.generateErrorReflectionInsights(reflection);
      }
      
      for (let i = 0; i < insightCount; i++) {
        const insight: LocalReflectionInsight = {
          id: uuidv4(),
          type: 'learning',
          content: `Insight ${i + 1} from ${reflection.trigger} reflection`,
          timestamp: new Date(),
          reflectionId: reflection.id,
          confidence: 0.7 + (Math.random() * 0.3),
          metadata: {
            source: reflection.trigger,
            applicationStatus: 'pending',
            category: 'general',
            relatedInsights: []
          }
        };
        
        insights.push(insight);
        this.insights.set(insight.id, insight);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }
    
    return insights;
  }

  /**
   * Generate specialized insights for error-triggered reflections
   */
  private async generateErrorReflectionInsights(reflection: Reflection): Promise<LocalReflectionInsight[]> {
    const insights: LocalReflectionInsight[] = [];
    
    try {
      // Extract error and recovery context
      const error = reflection.context.error as Record<string, unknown> | undefined;
      const recoveryContext = reflection.context.recoveryContext as Record<string, unknown> | undefined;
      const recoveryResult = reflection.context.recoveryResult as Record<string, unknown> | undefined;
      
      if (!error || !recoveryContext) {
        // If missing critical context, generate general error insights
        const generalInsight: LocalReflectionInsight = {
          id: uuidv4(),
          type: 'learning',
          content: `An error occurred related to task ${recoveryContext?.taskId || 'unknown'}`,
          timestamp: new Date(),
          reflectionId: reflection.id,
          confidence: 0.7,
          metadata: {
            source: 'error_reflection',
            applicationStatus: 'pending',
            category: 'error_handling',
            relatedInsights: []
          }
        };
        
        insights.push(generalInsight);
        this.insights.set(generalInsight.id, generalInsight);
        
        return insights;
      }
      
      // 1. Generate insight about the error itself
      const errorInsight: LocalReflectionInsight = {
        id: uuidv4(),
        type: 'learning',
        content: `Analysis of error "${error.message || 'unknown error'}" of type ${error.name || 'unknown'} in task ${recoveryContext.taskId}`,
        timestamp: new Date(),
        reflectionId: reflection.id,
        confidence: 0.85,
        metadata: {
          source: 'error_analysis',
          applicationStatus: 'pending',
          category: 'error_handling',
          relatedInsights: []
        }
      };
      
      insights.push(errorInsight);
      this.insights.set(errorInsight.id, errorInsight);
      
      // 2. Generate insight about the recovery attempt
      const recoveryInsight: LocalReflectionInsight = {
        id: uuidv4(),
        type: 'learning',
        content: `Recovery attempt ${recoveryContext.attemptCount || 1} for error category ${recoveryContext.errorCategory || 'unknown'} was ${recoveryResult?.success ? 'successful' : 'unsuccessful'}`,
        timestamp: new Date(),
        reflectionId: reflection.id,
        confidence: 0.8,
        metadata: {
          source: 'recovery_analysis',
          applicationStatus: 'pending',
          category: 'error_handling',
          relatedInsights: [errorInsight.id]
        }
      };
      
      insights.push(recoveryInsight);
      this.insights.set(recoveryInsight.id, recoveryInsight);
      
      // 3. Generate recommendation insight
      const recommendationInsight: LocalReflectionInsight = {
        id: uuidv4(),
        type: 'improvement',
        content: `Recommendation for handling ${recoveryContext.errorCategory || 'unknown'} errors in future tasks similar to ${recoveryContext.taskId}`,
        timestamp: new Date(),
        reflectionId: reflection.id,
        confidence: 0.75,
        metadata: {
          source: 'error_recommendation',
          applicationStatus: 'pending',
          category: 'improvement',
          relatedInsights: [errorInsight.id, recoveryInsight.id]
        }
      };
      
      insights.push(recommendationInsight);
      this.insights.set(recommendationInsight.id, recommendationInsight);
      
      // If there are previous recovery attempts, generate comparative insight
      if (recoveryContext.previousActions && Array.isArray(recoveryContext.previousActions) && recoveryContext.previousActions.length > 0) {
        const patternInsight: LocalReflectionInsight = {
          id: uuidv4(),
          type: 'pattern',
          content: `Pattern detected in multiple recovery attempts for task ${recoveryContext.taskId}`,
          timestamp: new Date(),
          reflectionId: reflection.id,
          confidence: 0.7,
          metadata: {
            source: 'error_pattern',
            applicationStatus: 'pending',
            category: 'error_handling',
            relatedInsights: insights.map(i => i.id)
          }
        };
        
        insights.push(patternInsight);
        this.insights.set(patternInsight.id, patternInsight);
      }
    } catch (error) {
      console.error('Error generating error reflection insights:', error);
    }
    
    return insights;
  }

  /**
   * Get the number of insights to generate based on reflection depth
   */
  private getInsightCountForDepth(depth: 'light' | 'standard' | 'deep'): number {
    switch (depth) {
      case 'light':
        return 1 + Math.floor(Math.random() * 2); // 1-2
      case 'standard':
        return 2 + Math.floor(Math.random() * 3); // 2-4
      case 'deep':
        return 3 + Math.floor(Math.random() * 5); // 3-7
      default:
        return 2; // Default
    }
  }

  /**
   * Update metrics based on reflection and insights
   */
  private updateMetrics(reflection: Reflection, insights: LocalReflectionInsight[]): void {
    // Update success metric if tracked
    if ('success' in this.metrics) {
      this.metrics.success = (this.metrics.success + (insights.length > 0 ? 1 : 0)) / 2;
    }
    
    // Update efficiency metric if tracked
    if ('efficiency' in this.metrics) {
      this.metrics.efficiency = (this.metrics.efficiency + 0.8) / 2; // Placeholder
    }
    
    // Update other metrics as needed
  }

  /**
   * Clean up old reflections if over the maximum limit
   */
  private async cleanupOldReflections(): Promise<void> {
    const maxItems = this.config.maxHistoryItems || 100;
    
    if (this.reflections.size <= maxItems) {
      return;
    }
    
    // Get all reflections sorted by timestamp (oldest first)
    const sortedReflections = Array.from(this.reflections.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate how many to remove
    const removeCount = this.reflections.size - maxItems;
    
    // Remove oldest reflections and their insights
    for (let i = 0; i < removeCount; i++) {
      const reflection = sortedReflections[i];
      
      // Remove associated insights
      for (const insightId of reflection.insights) {
        this.insights.delete(insightId);
      }
      
      // Remove reflection
      this.reflections.delete(reflection.id);
    }
  }

  /**
   * Load persisted reflections from storage
   */
  private async loadPersistedReflections(): Promise<void> {
    // In a real implementation, this would load from persistent storage
    console.log('Loading persisted reflections');
  }

  /**
   * Persist reflections to storage
   */
  private async persistReflections(): Promise<void> {
    // In a real implementation, this would save to persistent storage
    console.log('Persisting reflections');
  }

  /**
   * Get a reflection by ID
   */
  async getReflection(id: string): Promise<Reflection | null> {
    return this.reflections.get(id) || null;
  }

  /**
   * Get all reflections, optionally filtered and sorted
   */
  async getReflections(options: {
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<Reflection[]> {
    let reflections = Array.from(this.reflections.values());
    
    // Sort reflections
    if (options.sortBy) {
      reflections = reflections.sort((a, b) => {
        if (options.sortBy === 'timestamp') {
          return options.sortDirection === 'desc'
            ? b.timestamp.getTime() - a.timestamp.getTime()
            : a.timestamp.getTime() - b.timestamp.getTime();
        } else {
          return options.sortDirection === 'desc'
            ? b.trigger.localeCompare(a.trigger)
            : a.trigger.localeCompare(b.trigger);
        }
      });
    } else {
      // Default sort by timestamp descending (newest first)
      reflections = reflections.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    }
    
    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || reflections.length;
      reflections = reflections.slice(offset, offset + limit);
    }
    
    return reflections;
  }

  /**
   * Get an insight by ID
   */
  async getInsight(id: string): Promise<LocalReflectionInsight | null> {
    return this.insights.get(id) || null;
  }

  /**
   * Get all insights, optionally filtered and sorted
   */
  async getInsights(options: {
    reflectionId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'confidence' | 'type';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<LocalReflectionInsight[]> {
    let insights = Array.from(this.insights.values());
    
    // Filter by reflection ID if specified
    if (options.reflectionId) {
      insights = insights.filter(
        insight => insight.reflectionId === options.reflectionId
      );
    }
    
    // Sort insights
    if (options.sortBy) {
      insights = insights.sort((a, b) => {
        if (options.sortBy === 'timestamp') {
          return options.sortDirection === 'desc'
            ? b.timestamp.getTime() - a.timestamp.getTime()
            : a.timestamp.getTime() - b.timestamp.getTime();
        } else if (options.sortBy === 'confidence') {
          return options.sortDirection === 'desc'
            ? b.confidence - a.confidence
            : a.confidence - b.confidence;
        } else {
          return options.sortDirection === 'desc'
            ? b.type.localeCompare(a.type)
            : a.type.localeCompare(b.type);
        }
      });
    } else {
      // Default sort by timestamp descending (newest first)
      insights = insights.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    }
    
    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || insights.length;
      insights = insights.slice(offset, offset + limit);
    }
    
    return insights;
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<Record<string, number>> {
    return { ...this.metrics };
  }

  /**
   * Set improvement goals
   */
  async setImprovementGoals(goals: string[]): Promise<boolean> {
    this.config.improvementGoals = [...goals];
    return true;
  }

  /**
   * Get improvement goals
   */
  async getImprovementGoals(): Promise<string[]> {
    return [...(this.config.improvementGoals || [])];
  }

  /**
   * Create a new reflection
   */
  async createReflection(reflection: Omit<Reflection, 'id' | 'timestamp'>): Promise<Reflection> {
    const id = uuidv4();
    const timestamp = new Date();
    
    const newReflection: Reflection = {
      ...reflection,
      id,
      timestamp
    };
    
    this.reflections.set(id, newReflection);
    return newReflection;
  }
  
  /**
   * List reflections with optional filtering
   */
  async listReflections(options: {
    trigger?: ReflectionTrigger[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<Reflection[]> {
    // This is a more comprehensive implementation of getReflections
    let reflections = Array.from(this.reflections.values());
    
    // Apply filters
    if (options.trigger?.length) {
      reflections = reflections.filter(r => 
        options.trigger?.includes(r.trigger)
      );
    }
    
    if (options.fromDate) {
      reflections = reflections.filter(r => 
        r.timestamp >= options.fromDate!
      );
    }
    
    if (options.toDate) {
      reflections = reflections.filter(r => 
        r.timestamp <= options.toDate!
      );
    }
    
    // Sort reflections
    if (options.sortBy) {
      reflections = reflections.sort((a, b) => {
        if (options.sortBy === 'timestamp') {
          return options.sortDirection === 'desc'
            ? b.timestamp.getTime() - a.timestamp.getTime()
            : a.timestamp.getTime() - b.timestamp.getTime();
        } else {
          return options.sortDirection === 'desc'
            ? b.trigger.localeCompare(a.trigger)
            : a.trigger.localeCompare(b.trigger);
        }
      });
    } else {
      // Default sort by timestamp descending (newest first)
      reflections = reflections.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    }
    
    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || reflections.length;
      reflections = reflections.slice(offset, offset + limit);
    }
    
    return reflections;
  }
  
  // Implement the remaining required methods with stub implementations
  
  /**
   * Create an improvement action
   */
  async createImprovementAction(
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImprovementAction> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Get an improvement action by ID
   */
  async getImprovementAction(actionId: string): Promise<ImprovementAction | null> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Update an improvement action
   */
  async updateImprovementAction(
    actionId: string,
    updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImprovementAction> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * List improvement actions
   */
  async listImprovementActions(options?: {
    status?: ImprovementAction['status'][];
    targetArea?: ImprovementAction['targetArea'][];
    priority?: ImprovementAction['priority'][];
    minExpectedImpact?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'priority' | 'expectedImpact' | 'difficulty';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ImprovementAction[]> {
    return [];
  }
  
  /**
   * Register a reflection strategy
   */
  async registerReflectionStrategy(
    strategy: Omit<ReflectionStrategy, 'id'>
  ): Promise<ReflectionStrategy> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Get a reflection strategy by ID
   */
  async getReflectionStrategy(strategyId: string): Promise<ReflectionStrategy | null> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Update a reflection strategy
   */
  async updateReflectionStrategy(
    strategyId: string,
    updates: Partial<Omit<ReflectionStrategy, 'id'>>
  ): Promise<ReflectionStrategy> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * List reflection strategies
   */
  async listReflectionStrategies(options?: {
    trigger?: ReflectionTrigger[];
    enabled?: boolean;
    sortBy?: 'priority' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionStrategy[]> {
    return [];
  }
  
  /**
   * Enable or disable a reflection strategy
   */
  async setReflectionStrategyEnabled(
    strategyId: string,
    enabled: boolean
  ): Promise<ReflectionStrategy> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Identify knowledge gaps
   */
  async identifyKnowledgeGaps(options?: {
    fromRecentInteractions?: boolean;
    fromReflectionIds?: string[];
    maxGaps?: number;
    minImpactLevel?: number;
  }): Promise<KnowledgeGap[]> {
    return [];
  }
  
  /**
   * Get a knowledge gap by ID
   */
  async getKnowledgeGap(gapId: string): Promise<KnowledgeGap | null> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Update a knowledge gap
   */
  async updateKnowledgeGap(
    gapId: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'identifiedAt'>>
  ): Promise<KnowledgeGap> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * List knowledge gaps
   */
  async listKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'][];
    priority?: KnowledgeGap['priority'][];
    minImpactLevel?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'identifiedAt' | 'priority' | 'impactLevel';
    sortDirection?: 'asc' | 'desc';
  }): Promise<KnowledgeGap[]> {
    return [];
  }
  
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(options?: {
    fromDate?: Date;
    toDate?: Date;
    compareToPrevious?: boolean;
    include?: string[];
  }): Promise<PerformanceMetrics> {
    throw new ReflectionError('Method not implemented', 'NOT_IMPLEMENTED');
  }
  
  /**
   * Adapt agent behavior based on reflections
   */
  async adaptBehavior(): Promise<boolean> {
    try {
      // Find all pending improvement actions
      const pendingActions = Array.from(this.errorRecoveryReflections.values())
        .flat()
        .filter(entry => entry.recoverySuccessful)
        .slice(0, 10); // Limit to 10 most recent successful recoveries
      
      if (pendingActions.length === 0) {
        return false;
      }
      
      // For now, just log that adaptation would happen
      console.log(`[${this.managerId}] Adapting behavior based on ${pendingActions.length} error recovery reflections`);
      
      return true;
    } catch (error) {
      console.error('Error adapting behavior:', error);
      return false;
    }
  }
  
  /**
   * Get statistics about the reflection process
   */
  async getStats(): Promise<Record<string, unknown>> {
    return {
      totalReflections: this.reflections.size,
      reflectionsByType: {},
      totalImprovementActions: 0,
      actionsByStatus: {},
      totalKnowledgeGaps: 0,
      gapsByStatus: {},
      lastReflectionTime: this.lastReflectionTime,
      topInsightTags: []
    };
  }
} 