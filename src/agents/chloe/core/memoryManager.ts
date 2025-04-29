import { AgentMemory } from '../../../lib/memory';
import { ChloeMemory } from '../memory';
import { MemoryTagger } from '../memory-tagger';
import { EnhancedMemory } from '../../../lib/memory/src/enhanced-memory';
import { CognitiveMemory } from '../../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';
import { FeedbackLoopSystem } from '../../../lib/memory/src/feedback-loop';
import { IntegrationLayer } from '../../../lib/memory/src/integration-layer';
import { SelfImprovementMechanism } from '../../../lib/memory/src/self-improvement';
import * as serverQdrant from '../../../server/qdrant';
import { StrategicInsight, IManager, BaseManagerOptions, MemoryManagerOptions } from '../../../lib/shared/types/agentTypes';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { logger } from '../../../lib/logging';
import { TaskLogger } from '../task-logger';
import { 
  MemoryType, 
  ChloeMemoryType, 
  ImportanceLevel, 
  MemorySource 
} from '../../../constants/memory';

/**
 * Manages all memory systems for the Chloe agent
 */
export class MemoryManager implements IManager {
  private agentId: string;
  private memory: AgentMemory | null = null;
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
   * Get the agent ID this manager belongs to
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`MemoryManager: ${action}`, metadata);
    } else {
      logger.info(`MemoryManager: ${action}`, metadata);
    }
  }

  /**
   * Initialize all memory systems
   */
  async initialize(useOpenAI: boolean = false): Promise<void> {
    try {
      this.logAction('Initializing memory systems');

      // Initialize base memory system with OpenAI embeddings if configured
      this.memory = new AgentMemory({
        namespace: this.agentId,
        config: {
          defaultNamespace: this.agentId,
          embeddingModel: 'text-embedding-3-small'
        }
      });
      
      await this.memory.initialize();
      
      // Initialize Chloe-specific memory system
      this.chloeMemory = new ChloeMemory({
        agentId: this.agentId,
        useExternalMemory: true,
        externalMemory: this.memory,
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
        await this.knowledgeGraph.load();
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
    tags?: string[]
  ): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    // Map category string to a valid ChloeMemoryType
    let memoryType: string = MemoryType.DOCUMENT;
    
    // Determine the appropriate memory type based on the category
    if (Object.values(ChloeMemoryType).includes(category as any)) {
      memoryType = category;
    } else {
      // Default mapping for other categories
      memoryType = MemoryType.DOCUMENT;
    }
    
    // Add memory with the determined type
    return this.chloeMemory.addMemory(
      content,
      memoryType,
      importance,
      source,
      context,
      tags
    );
  }

  /**
   * Get memories that match the query
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    // Convert MemoryEntry[] to string[]
    const memories = await this.chloeMemory.getRelevantMemories(query, limit);
    return memories.map(memory => typeof memory === 'string' ? memory : memory.content);
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
      
      // Get embeddings for the insight
      const embeddingResponse = await serverQdrant.getEmbedding(insight);
      if (!embeddingResponse || !embeddingResponse.embedding) {
        console.error('Failed to get embedding for strategic insight');
        return false;
      }
      
      const embedding = embeddingResponse.embedding;
      
      // Create metadata payload
      const payload = {
        insight,
        category,
        tags,
        source: source || MemorySource.SYSTEM,
        timestamp: new Date().toISOString()
      };
      
      // Add to Qdrant collection
      await serverQdrant.addToCollection(this.strategicInsightsCollection, embedding, payload);
      
      // Also add to normal memory with high importance
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          insight,
          ChloeMemoryType.STRATEGIC_INSIGHT,
          ImportanceLevel.HIGH,
          source as MemorySource,
          `Strategic insight in category: ${category}`,
          tags
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

      // Get embeddings for the query
      const embeddingResponse = await serverQdrant.getEmbedding(query);
      if (!embeddingResponse || !embeddingResponse.embedding) {
        console.error('Failed to get embedding for strategic insight query');
        return [];
      }

      const embedding = embeddingResponse.embedding;
      
      // Get limit from options or use default
      const limit = options?.limit || 5;
      
      // Search for insights
      const results = await serverQdrant.search(
        this.strategicInsightsCollection,
        embedding,
        limit
      );
      
      if (!results || results.length === 0) {
        return [];
      }
      
      // Convert to proper format
      return results.map(result => ({
        id: result.id.toString(),
        insight: result.payload.insight || '',
        category: result.payload.category || 'general',
        tags: result.payload.tags || [],
        source: result.payload.source || 'system',
        timestamp: result.payload.timestamp || new Date().toISOString()
      }));
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

      // Use search with no specific query to get recent items
      const results = await serverQdrant.getRecentPoints(this.strategicInsightsCollection, limit);
      
      if (!results || results.length === 0) {
        return [];
      }
      
      // Convert to proper format
      return results.map(result => ({
        id: result.id.toString(),
        insight: result.payload.insight || '',
        category: result.payload.category || 'general',
        tags: result.payload.tags || [],
        source: result.payload.source || 'system',
        timestamp: result.payload.timestamp || new Date().toISOString()
      }));
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

  getMemory(): AgentMemory | null {
    return this.memory;
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