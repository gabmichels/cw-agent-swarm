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
import { StrategicInsight } from '../../../lib/shared/types/agent';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { logger } from '../../../lib/logging';

export interface MemoryManagerOptions {
  agentId: string;
  useOpenAI?: boolean;
}

/**
 * Manages all memory systems for the Chloe agent
 */
export class MemoryManager {
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

  constructor(options: MemoryManagerOptions) {
    this.agentId = options.agentId;
    
    // Initialize enhanced memory systems
    this.enhancedMemory = new EnhancedMemory({
      namespace: this.agentId
    });
    
    this.cognitiveMemory = new CognitiveMemory({ 
      namespace: this.agentId,
      workingMemoryCapacity: 9, 
      consolidationInterval: 12
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
      logger.info('Initializing memory systems...');

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
        agentMemory: this.memory,
        importanceThreshold: 0.7
      });

      // Initialize enhanced memory systems
      try {
        await this.enhancedMemory.initialize();
        await this.cognitiveMemory.initialize();
        await this.knowledgeGraph.load();
        logger.info('Enhanced memory systems initialized successfully');
        
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
        logger.error('Error initializing enhanced memory systems:', error);
      }

      this.initialized = true;
      logger.info('Memory systems initialized successfully');
    } catch (error) {
      logger.error('Error initializing memory systems:', error);
      throw error;
    }
  }

  /**
   * Add a memory entry with proper tagging
   */
  async addMemory(
    content: string,
    category: string,
    importance: 'low' | 'medium' | 'high' = 'medium',
    source: 'user' | 'chloe' | 'system' = 'system',
    context?: string,
    tags?: string[]
  ): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    return this.chloeMemory.addMemory(content, category, importance, source, context, tags);
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
    
    return this.chloeMemory.getRelevantMemories(query, limit);
  }

  /**
   * Add a strategic insight to the memory
   */
  async addStrategicInsight(
    insight: string, 
    tags: string[], 
    category: string = 'general', 
    source: string = 'system'
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
      
      // Create a timestamp
      const timestamp = new Date().toISOString();
      
      // Create a payload with all the data
      const payload = {
        insight,
        source,
        tags,
        timestamp,
        category
      };
      
      // Add to Qdrant collection
      await serverQdrant.addToCollection(this.strategicInsightsCollection, embedding, payload);
      
      // Also add to normal memory with high importance
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          insight,
          'strategic_insight',
          'high',
          'system',
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

  isInitialized(): boolean {
    return this.initialized;
  }
} 