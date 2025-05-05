import { ChloeMemory } from '../memory';
import { MemoryTagger } from '../memory-tagger';
import { EnhancedMemory } from '../../../lib/memory/src/enhanced-memory';
import { CognitiveMemory } from '../../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../../lib/memory/src/knowledge-graph';
import { FeedbackLoopSystem } from '../../../lib/memory/src/feedback-loop';
import { IntegrationLayer } from '../../../lib/memory/src/integration-layer';
import { SelfImprovementMechanism } from '../../../lib/memory/src/self-improvement';
import { StrategicInsight, IManager, BaseManagerOptions, MemoryManagerOptions } from '../../../lib/shared/types/agentTypes';
// Comment out the missing module
// import { KnowledgeFlaggingService } from '../../../lib/memory/src/knowledge-flagging';
import { logger } from '../../../lib/logging';
import { TaskLogger } from '../task-logger';
import { 
  ImportanceLevel, 
  MemorySource 
} from '../../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
// Import standardized memory services
import { getMemoryServices } from '../../../server/memory/services';

// Create a simple stub for the KnowledgeFlaggingService class to fix the missing module issue
class KnowledgeFlaggingService {
  constructor(knowledgeGraph: any) {
    // Stub constructor
  }
  
  async load(): Promise<void> {
    // Stub implementation
    return Promise.resolve();
  }
}

/**
 * Manages all memory systems for the Chloe agent
 */
export class MemoryManager implements IManager {
  private agentId: string;
  private chloeMemory: ChloeMemory | null = null;
  private memoryTagger: MemoryTagger | null = null;
  private enhancedMemory: EnhancedMemory;
  private cognitiveMemory: CognitiveMemory;
  private knowledgeGraph: KnowledgeGraph;
  private feedbackLoop!: FeedbackLoopSystem;
  private integrationLayer!: IntegrationLayer;
  private selfImprovement!: SelfImprovementMechanism;
  private knowledgeFlaggingService: KnowledgeFlaggingService;
  private strategicInsightsCollection: string = 'strategic_insights';
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;

  constructor(options: MemoryManagerOptions) {
    this.agentId = options.agentId;
    this.taskLogger = options.logger || null;
    
    // Initialize enhanced memory systems
    this.enhancedMemory = new EnhancedMemory({
      namespace: this.agentId
    });
    
    this.cognitiveMemory = new CognitiveMemory({ 
      namespace: this.agentId,
      workingMemoryCapacity: options.workingMemoryCapacity || 9, 
      consolidationInterval: options.consolidationInterval || 12
    });
    
    this.knowledgeGraph = new KnowledgeGraph('marketing');
    
    // Create the knowledge flagging service
    this.knowledgeFlaggingService = new KnowledgeFlaggingService(this.knowledgeGraph);
  }

  /**
   * Initialize all memory systems
   */
  async initialize(useOpenAI: boolean = false): Promise<void> {
    try {
      this.logAction('Initializing memory systems');

      // Get standardized memory services
      const memoryServices = await getMemoryServices();
      
      // Initialize Chloe-specific memory system with the standardized memory system
      this.chloeMemory = new ChloeMemory({
        agentId: this.agentId,
        useOpenAI: useOpenAI
      });
      await this.chloeMemory.initialize();
      
      // Initialize memory tagger
      this.memoryTagger = new MemoryTagger({
        memory: this.chloeMemory
      });
      
      // Initialize enhanced memory systems
      try {
        await this.enhancedMemory.initialize();
        await this.cognitiveMemory.initialize();
        // Replace the problematic load() call with initialize() if available, or comment it out
        // await this.knowledgeGraph.load();
        this.logAction('Enhanced memory systems initialized successfully');
        
        // Initialize feedback loop system
        this.feedbackLoop = new FeedbackLoopSystem(this.enhancedMemory);
        await this.feedbackLoop.initialize();
        
        // Initialize integration layer
        this.integrationLayer = new IntegrationLayer(
          this.enhancedMemory,
          this.feedbackLoop
        );
        await this.integrationLayer.initialize();
        
        // Initialize self-improvement mechanism
        this.selfImprovement = new SelfImprovementMechanism(
          this.feedbackLoop,
          this.enhancedMemory,
          this.integrationLayer
        );
        await this.selfImprovement.initialize();
        
        // Initialize knowledge flagging service
        await this.knowledgeFlaggingService.load();
        
      } catch (error) {
        this.logAction('Error initializing enhanced memory systems', { error: String(error) });
      }

      this.initialized = true;
      this.logAction('Memory systems initialized successfully');
    } catch (error) {
      this.logAction('Error initializing memory systems', { error: String(error) });
      throw error;
    }
  }

  /**
   * Log action for tracing, implementing IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(action, metadata);
    } else {
      if (metadata?.error) {
        logger.error(`MemoryManager: ${action}`, metadata);
      } else {
        logger.debug(`MemoryManager: ${action}`, metadata);
      }
    }
  }

  /**
   * Get the memory instance
   */
  getMemory() {
    return null; // MemoryManager no longer uses AgentMemory
  }

  /**
   * Get the agent ID this manager belongs to
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down memory systems');
      
      // Close any open connections or save any pending data
      if (this.chloeMemory) {
        const memoryWithClose = this.chloeMemory as unknown as { close?: () => Promise<void> };
        if (typeof memoryWithClose.close === 'function') {
          await memoryWithClose.close();
        }
      }
      
      // Additional cleanup as needed
      
      this.logAction('Memory systems shutdown complete');
    } catch (error) {
      this.logAction('Error during memory systems shutdown', { error: String(error) });
      throw error;
    }
  }

  /**
   * Add a memory entry with proper tagging
   */
  async addMemory(
    content: string,
    category: string,
    importance: ImportanceLevel = ImportanceLevel.MEDIUM,
    source: MemorySource = MemorySource.SYSTEM,
    context?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    // Map category string to a valid StandardMemoryType
    let memoryType: string = StandardMemoryType.DOCUMENT;
    
    // Determine the appropriate memory type based on the category
    if (Object.values(StandardMemoryType).includes(category as any)) {
      memoryType = category;
    } else {
      // Default mapping for other categories
      memoryType = StandardMemoryType.DOCUMENT;
    }
    
    // Add memory with the determined type and metadata if provided
    return this.chloeMemory.addMemory(
      content,
      memoryType as any, // Use type assertion to fix incompatibility
      importance,
      source,
      context,
      tags,
      metadata
    );
  }

  /**
   * Get memories that match the query
   * Automatically extracts contextual tags from the query to prioritize tag-matched memories
   * 
   * @param query The search query
   * @param limit Maximum number of results to return
   * @param contextTags Optional explicit tags to prioritize (if not provided, will be extracted from query)
   * @returns Array of memory strings
   */
  async getRelevantMemories(
    query: string, 
    limit: number = 5, 
    contextTags?: string[]
  ): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    // Extract potential tags from the query if explicit tags aren't provided
    const extractedTags = contextTags || this.extractTagsFromQuery(query);
    
    // Convert MemoryEntry[] to string[]
    const memories = await this.chloeMemory.getRelevantMemories(
      query, 
      limit, 
      undefined, // Use default types
      extractedTags
    );
    
    return memories.map(memory => typeof memory === 'string' ? memory : memory.content);
  }
  
  /**
   * Extract potential tags from a query
   * This helps identify topic tags that might be relevant to the query
   * 
   * @param query The query to extract tags from
   * @returns Array of potential tags
   */
  private extractTagsFromQuery(query: string): string[] {
    if (!query) return [];
    
    // Common domain/subject tags that might appear in queries
    const commonDomains = [
      'marketing', 'sales', 'finance', 'technology', 'development', 
      'design', 'research', 'strategy', 'operations', 'product', 
      'management', 'leadership', 'analytics', 'data', 'customer', 
      'support', 'service', 'social', 'media', 'content', 'email',
      'legal', 'compliance', 'hr', 'recruitment', 'training'
    ];
    
    // Extract key noun phrases as potential tags
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .split(/\s+/)              // Split on whitespace
      .filter(word => word.length > 3); // Only words longer than 3 chars
    
    // Start with common domains that appear in the query
    const domainTags = commonDomains.filter(domain => 
      words.includes(domain) || query.toLowerCase().includes(domain)
    );
    
    // Look for explicit tag markers like #tag or [tag]
    const explicitTags: string[] = [];
    
    // Match hashtag style tags #tag
    const hashtagMatches = query.match(/#(\w+)/g);
    if (hashtagMatches) {
      explicitTags.push(...hashtagMatches.map(tag => tag.substring(1).toLowerCase()));
    }
    
    // Match bracket style tags [tag]
    const bracketMatches = query.match(/\[(\w+)\]/g);
    if (bracketMatches) {
      explicitTags.push(...bracketMatches.map(tag => tag.substring(1, tag.length - 1).toLowerCase()));
    }
    
    // Combine all tag sources, deduplicate, and return
    return Array.from(new Set([...domainTags, ...explicitTags]));
  }

  /**
   * Add a strategic insight with the appropriate categorization
   */
  async addStrategicInsight(
    insight: string, 
    tags: string[], 
    category: string = 'general', 
    source: string = MemorySource.SYSTEM
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Create metadata payload
      const metadata = {
        category,
        tags,
        source: source || MemorySource.SYSTEM,
        importance: ImportanceLevel.HIGH,
        timestamp: new Date().toISOString()
      };
      
      // Add to memory system using standardized memory services
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          insight,
          StandardMemoryType.DOCUMENT,
          ImportanceLevel.HIGH,
          source as MemorySource,
          `Strategic insight in category: ${category}`,
          tags,
          metadata
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error adding strategic insight:', error);
      return false;
    }
  }

  /**
   * Get strategic insights relevant to a query
   */
  async searchStrategicInsights(
    query: string, 
    options?: { limit?: number; tags?: string[] }
  ): Promise<StrategicInsight[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get limit from options or use default
      const limit = options?.limit || 5;
      
      // Use ChloeMemory to search with specific type filter
      if (this.chloeMemory) {
        const filter = options?.tags ? { tags: options.tags } : undefined;
        const memories = await this.chloeMemory.getRelevantMemories(
          query,
          limit,
          [StandardMemoryType.DOCUMENT]
        );
        
        // Convert to proper format
        return memories.map(memory => ({
          id: memory.id,
          insight: memory.content || '',
          category: memory.category || 'general',
          tags: memory.tags || [],
          source: memory.source || 'system',
          timestamp: memory.created?.toISOString() || new Date().toISOString()
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error searching strategic insights:', error);
      return [];
    }
  }

  /**
   * Get the most recent strategic insights
   */
  async getRecentStrategicInsights(limit: number = 5): Promise<StrategicInsight[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.chloeMemory) {
        // Get memories of type STRATEGIC_INSIGHT sorted by recency
        const memoryResults = await this.chloeMemory.getRelevantMemoriesByType(
          '', // Empty query to get all memories of this type
          [StandardMemoryType.DOCUMENT],
          limit
        );
        
        // Sort by creation date (most recent first)
        const sortedMemories = memoryResults.entries.sort((a, b) => 
          (b.created?.getTime() || 0) - (a.created?.getTime() || 0)
        ).slice(0, limit);
        
        // Convert to proper format
        return sortedMemories.map(memory => ({
          id: memory.id,
          insight: memory.content || '',
          category: memory.category || 'general',
          tags: memory.tags || [],
          source: memory.source || 'system',
          timestamp: memory.created?.toISOString() || new Date().toISOString()
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting recent strategic insights:', error);
      return [];
    }
  }

  /**
   * Adapter method to get recent memories in the expected format
   * @param limit Maximum number of memories to return
   */
  async getRecentMemoriesAdapter(limit: number = 10): Promise<any[]> {
    // The actual implementation would fetch from the memory provider
    // This is a stub that returns an empty array
    return Promise.resolve([]);
  }

  getChloeMemory(): ChloeMemory | null {
    return this.chloeMemory;
  }

  getEnhancedMemory(): EnhancedMemory {
    return this.enhancedMemory;
  }

  getCognitiveMemory(): CognitiveMemory {
    return this.cognitiveMemory;
  }

  getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }

  getFeedbackLoop(): FeedbackLoopSystem {
    return this.feedbackLoop;
  }

  getIntegrationLayer(): IntegrationLayer {
    return this.integrationLayer;
  }

  getSelfImprovement(): SelfImprovementMechanism {
    return this.selfImprovement;
  }

  getKnowledgeFlaggingService(): KnowledgeFlaggingService {
    return this.knowledgeFlaggingService;
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Diagnose the memory system's health
   */
  async diagnose(): Promise<{
    status: string;
    messageCount: number;
  }> {
    try {
      const memory = this.getChloeMemory();
      if (!memory) {
        return {
          status: 'not_initialized',
          messageCount: 0
        };
      }

      const messageCount = await memory.getMessageCount();
      return {
        status: 'operational',
        messageCount
      };
    } catch (error) {
      console.error('Error diagnosing memory system:', error);
      return {
        status: 'error',
        messageCount: 0
      };
    }
  }
} 