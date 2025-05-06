/**
 * Knowledge Gaps Manager
 * 
 * Standardized implementation of a manager for identifying and tracking knowledge gaps
 * in the Chloe agent system. Follows the manager standardization guidelines.
 */
import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';
import {
  createDocumentMetadata,
  createMessageMetadata,
  createThreadInfo
} from '../../../server/memory/services/helpers/metadata-helpers';
import {
  createUserId,
  createAgentId,
  createChatId
} from '../../../types/structured-id';
import { DocumentSource } from '../../../types/metadata';

/**
 * Options for initializing the knowledge gaps manager
 */
export interface KnowledgeGapsManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  logger?: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
}

/**
 * Interface for knowledge gap results
 */
export interface KnowledgeGapResult {
  gaps: string[];
  confidence: number;
  timestamp: string;
}

/**
 * Interface for a detected knowledge gap
 */
export interface KnowledgeGap {
  id: string;
  gap: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  created: Date;
  status: 'open' | 'in_progress' | 'resolved';
  resolution?: string;
  resolvedDate?: Date;
}

/**
 * Standardized knowledge gaps manager implementation
 * Handles identification and tracking of knowledge gaps
 */
export class KnowledgeGapsManager implements IManager {
  // Required core properties
  private agentId: string;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
  // Manager-specific properties
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private notifyFunction?: (message: string) => Promise<void>;
  private readonly knowledgeGapsCollection = 'knowledge_gaps';

  constructor(options: KnowledgeGapsManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.logger || null;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Get the agent ID this manager belongs to
   * Required by IManager interface
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   * Required by IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`KnowledgeGapsManager: ${action}`, metadata);
    } else {
      logger.info(`KnowledgeGapsManager: ${action}`, metadata);
    }
  }

  /**
   * Initialize the knowledge gaps system
   * Required by IManager interface
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing knowledge gaps system');
      this.initialized = true;
      this.logAction('Knowledge gaps system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error initializing knowledge gaps system', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   * Optional but recommended method in IManager interface
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down knowledge gaps system');
      
      // Add cleanup logic here if needed
      
      this.logAction('Knowledge gaps system shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during knowledge gaps system shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   * Required by IManager interface
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Identify knowledge gaps based on recent interactions and memories
   */
  async identifyKnowledgeGaps(): Promise<KnowledgeGapResult> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Identifying knowledge gaps');
      
      // Get recent interactions and memories
      const recentInteractions = await this.memory.getRelevantMemories('user interaction', 20);
      const recentTasks = await this.memory.getRelevantMemories('task', 20);
      
      // Create a prompt for gap analysis
      const prompt = `As Chloe, the Chief Marketing Officer AI, analyze these recent interactions and tasks to identify potential knowledge gaps or areas where I need more information:

RECENT INTERACTIONS:
${recentInteractions.join('\n\n')}

RECENT TASKS:
${recentTasks.join('\n\n')}

Please identify specific knowledge gaps in these areas:
1. Marketing Strategy
2. Industry Knowledge
3. Technical Skills
4. Data Analysis
5. Communication

For each gap, provide:
- A clear description of what I need to learn
- Why this knowledge is important
- How it would improve my performance

Format each gap as a separate item with these sections.`;
      
      // Generate the gap analysis
      const response = await this.model.invoke(prompt);
      const analysis = response.content.toString();
      
      // Parse the gaps from the analysis
      const gaps = this.parseKnowledgeGaps(analysis);
      
      // Store the gaps in memory
      await this.memory.addMemory(
        `Knowledge Gaps Analysis: ${analysis.substring(0, 200)}...`,
        MemoryType.KNOWLEDGE_GAP,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        undefined,
        ['knowledge_gaps', 'learning_needs'],
        createDocumentMetadata(
          DocumentSource.AGENT,
          {
            title: "Knowledge Gaps Analysis",
            contentType: 'knowledge_gap_analysis',
            tags: ['knowledge_gaps', 'learning_needs'],
            importance: ImportanceLevel.HIGH,
            agentId: createAgentId(this.agentId),
            userId: createUserId("default")
          }
        )
      );
      
      // Create the result object
      const result: KnowledgeGapResult = {
        gaps,
        confidence: 0.8, // Placeholder confidence score
        timestamp: new Date().toISOString()
      };
      
      // Notify about the gaps if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`Identified ${gaps.length} knowledge gaps that need attention`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error identifying knowledge gaps', { error: errorMessage });
      
      if (this.notifyFunction) {
        await this.notifyFunction(`Error in knowledge gaps analysis: ${errorMessage}`);
      }
      
      return {
        gaps: [],
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse knowledge gaps from analysis text
   */
  private parseKnowledgeGaps(analysis: string): string[] {
    try {
      const gaps: string[] = [];
      
      // Split the analysis into sections
      const sections = analysis.split(/\d\.\s+/).filter(Boolean);
      
      // Process each section
      for (const section of sections) {
        // Look for clear gap descriptions
        const lines = section.split('\n').filter(line => line.trim().length > 0);
        
        for (const line of lines) {
          // Skip section headers
          if (line.match(/^(Marketing Strategy|Industry Knowledge|Technical Skills|Data Analysis|Communication):/i)) {
            continue;
          }
          
          // Extract the gap description
          const gapMatch = line.match(/^[-*]\s*(.*?)(?=\s*[-*]|$)/);
          if (gapMatch) {
            const gap = gapMatch[1].trim();
            if (gap.length > 0) {
              gaps.push(gap);
            }
          }
        }
      }
      
      return gaps;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error parsing knowledge gaps', { error: errorMessage });
      return [];
    }
  }

  /**
   * Track a specific knowledge gap
   */
  async trackKnowledgeGap(gap: string, category: string = 'general'): Promise<boolean> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Tracking knowledge gap', { gap, category });
      
      // Create structured IDs
      const agentId = createAgentId(this.agentId);
      const userId = createUserId("default");
      
      // Create document metadata for the knowledge gap
      const metadata = createDocumentMetadata(
        DocumentSource.AGENT,
        {
          title: `Knowledge Gap: ${gap}`,
          contentType: 'knowledge_gap',
          tags: ['knowledge_gap', 'learning_opportunity', category.toLowerCase()],
          importance: ImportanceLevel.HIGH,
          agentId,
          userId
        }
      );
      
      // Add to memory with high importance
      await this.memory.addMemory(
        `Knowledge Gap: ${gap}`,
        MemoryType.KNOWLEDGE_GAP,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        'Identified Knowledge Gap',
        ['knowledge_gap', 'learning_opportunity', category.toLowerCase()],
        metadata
      );
      
      // Notify about the gap if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`New knowledge gap identified: ${gap}`);
      }
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error tracking knowledge gap', { error: errorMessage });
      return false;
    }
  }

  /**
   * Get all tracked knowledge gaps
   */
  async getTrackedGaps(): Promise<string[]> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Retrieving tracked knowledge gaps');
      
      // Get all knowledge gap memories
      const gaps = await this.memory.getRelevantMemories('knowledge_gap', 50);
      
      // Extract the gap descriptions
      return gaps.map(gap => {
        const content = typeof gap === 'string' ? gap : gap.content || '';
        const match = content.match(/Knowledge Gap: (.*)/);
        return match ? match[1] : content;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error retrieving tracked gaps', { error: errorMessage });
      return [];
    }
  }

  /**
   * Process a conversation to identify knowledge gaps
   */
  async processConversation({ messages }: { messages: any[] }): Promise<boolean> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Processing conversation for knowledge gaps');
      
      // Convert messages to a single string for analysis
      const conversationText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      // Analyze the conversation
      const result = await this.identifyKnowledgeGaps();
      
      // Track any identified gaps
      for (const gap of result.gaps) {
        await this.trackKnowledgeGap(gap);
      }
      
      return result.gaps.length > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error processing conversation', { error: errorMessage });
      return false;
    }
  }

  /**
   * Get unresolved knowledge gaps
   */
  async getUnresolvedKnowledgeGaps(): Promise<string[]> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Retrieving unresolved knowledge gaps');
      
      // Get all knowledge gap memories
      const gaps = await this.memory.getRelevantMemories('knowledge_gap', 50);
      
      // Filter out resolved gaps and extract descriptions
      return gaps
        .filter(gap => {
          const content = typeof gap === 'string' ? gap : gap.content || '';
          return !content.includes('RESOLVED');
        })
        .map(gap => {
          const content = typeof gap === 'string' ? gap : gap.content || '';
          const match = content.match(/Knowledge Gap: (.*)/);
          return match ? match[1] : content;
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error retrieving unresolved gaps', { error: errorMessage });
      return [];
    }
  }

  /**
   * Generate a summary of knowledge gaps
   */
  async generateKnowledgeGapSummary(): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Generating knowledge gap summary');
      
      // Get all knowledge gaps
      const gaps = await this.getTrackedGaps();
      
      if (gaps.length === 0) {
        return 'No knowledge gaps identified at this time.';
      }
      
      // Create a prompt for summarization
      const prompt = `As Chloe, the Chief Marketing Officer AI, summarize the following knowledge gaps that need to be addressed:

${gaps.join('\n\n')}

Please provide a concise summary that:
1. Groups similar gaps together
2. Highlights the most critical gaps
3. Suggests a learning priority order
4. Identifies any patterns or themes`;

      // Generate the summary
      const response = await this.model.invoke(prompt);
      return response.content.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error generating knowledge gap summary', { error: errorMessage });
      return 'Error generating knowledge gap summary.';
    }
  }

  /**
   * Resolve a knowledge gap
   */
  async resolveKnowledgeGap(gapId: string, resolution: string): Promise<boolean> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Resolving knowledge gap', { gapId, resolution });
      
      // Get the gap content
      const gaps = await this.memory.getRelevantMemories(`knowledge_gap ${gapId}`, 1);
      
      if (gaps.length === 0) {
        this.logAction('Knowledge gap not found', { gapId });
        return false;
      }
      
      const gapContent = typeof gaps[0] === 'string' ? gaps[0] : gaps[0].content || '';
      
      // Add resolution to memory
      await this.memory.addMemory(
        `Knowledge Gap: ${gapContent} | RESOLVED: ${resolution}`,
        MemoryType.KNOWLEDGE_GAP_RESOLUTION,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        'Resolved Knowledge Gap',
        ['knowledge_gap_resolution', 'learning_completion', gapId]
      );
      
      // Notify about the resolution if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`Knowledge gap resolved: ${gapId}`);
      }
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error resolving knowledge gap', { error: errorMessage });
      return false;
    }
  }

  /**
   * Analyze knowledge gaps in the agent's understanding
   */
  async analyzeGaps(): Promise<void> {
    try {
      this.logAction('Starting knowledge gaps analysis');

      // Implement knowledge gaps analysis logic here
      // This could include:
      // - Analyzing conversation history for unanswered questions
      // - Identifying areas where the agent lacks confidence
      // - Reviewing failed tasks for patterns
      // - Comparing current knowledge with expected knowledge

      this.logAction('Knowledge gaps analysis completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Knowledge gaps analysis failed', { error: errorMessage });
      throw error;
    }
  }
} 