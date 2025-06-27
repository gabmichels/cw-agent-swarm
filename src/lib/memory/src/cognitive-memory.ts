import { ImportanceLevel } from '@/server/memory/config/types';
import { DateTime } from 'luxon';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
import { getMemoryServices } from '../../../server/memory/services';
import { createCognitiveMemoryMetadata, updateWithDecayInfo } from '../../../server/memory/services/helpers/metadata-helpers';
import { ImportanceCalculationMode, ImportanceCalculatorService } from '../../../services/importance/ImportanceCalculatorService';
import { CognitiveMemoryMetadata, MemoryEmotion } from '../../../types/metadata';
import { EnhancedMemory, MemoryEntry } from './enhanced-memory';

/**
 * CognitiveMemory System
 * 
 * Extends EnhancedMemory with advanced cognitive features:
 * - Episodic memory for event sequences
 * - Memory consolidation and forgetting
 * - Knowledge graph relationships
 * - Emotional context for memories
 * - Working memory constraints
 * - Memory reconsolidation
 */

// Extended memory types (use the type from metadata.ts)

export interface EpisodicMemory extends MemoryEntry {
  episodeId: string;
  sequence: number;
  emotions: MemoryEmotion[];
  // Keep the base importance compatible with MemoryEntry
  importance: ImportanceLevel;
  // Add a separate field for extended importance levels
  criticalityLevel?: 'critical' | null;
  retrievalCount: number;
  lastRetrieved?: Date;
  decayFactor: number;
}

export interface WorkingMemoryItem {
  id: string;
  content: string;
  addedAt: Date;
  priority: number;
  source: 'episodic' | 'semantic' | 'procedural' | 'external';
  relatedIds: string[];
}

export interface CognitiveMemoryOptions {
  namespace?: string;
  config?: Record<string, any>;
  workingMemoryCapacity?: number;
  consolidationInterval?: number;
  decayRate?: number;
}

/**
 * Cognitive Memory system with human-like memory processes
 */
export class CognitiveMemory extends EnhancedMemory {
  private workingMemory: WorkingMemoryItem[] = [];
  private workingMemoryCapacity: number = 100;
  private lastConsolidation: Date = new Date();
  private emotionDetectionEnabled: boolean = true;
  private consolidationInterval: number = 3600000; // 1 hour
  private decayRate: number = 0.05; // 5% per day for unused memories

  constructor(
    private readonly importanceCalculator: ImportanceCalculatorService,
    options: CognitiveMemoryOptions = {}
  ) {
    super(options);

    if (options.workingMemoryCapacity) {
      this.workingMemoryCapacity = options.workingMemoryCapacity;
    }

    if (options.consolidationInterval) {
      this.consolidationInterval = options.consolidationInterval;
    }

    if (options.decayRate) {
      this.decayRate = options.decayRate;
    }

    // Schedule memory consolidation
    if (typeof window === 'undefined') {
      // Server-side only
      this.scheduleMemoryConsolidation();
    }
  }

  /**
   * Create a new episodic memory
   */
  async addEpisodicMemory(
    content: string,
    metadata: Partial<CognitiveMemoryMetadata> = {},
    emotions: MemoryEmotion[] = ['neutral']
  ): Promise<string> {
    try {
      // Generate episode ID if not part of existing episode
      const episodeId = metadata.episodeId || `episode_${Date.now()}`;
      const sequence = metadata.sequence || 0;

      // Detect emotions if not provided
      if (emotions.length === 1 && emotions[0] === 'neutral' && this.emotionDetectionEnabled) {
        emotions = await this.detectEmotions(content);
      }

      // Calculate importance
      const importance = await this.calculateImportance(content, emotions);

      // Create extended metadata using the helper function
      const episodicMetadata = createCognitiveMemoryMetadata({
        episodeId,
        sequence,
        emotions,
        importance,
        source: "episodic",
        tags: metadata.tags || [],
        timestamp: new Date().toISOString(),
        ...metadata
      });

      // Add to memory
      const memoryId = await super.addMemory(content, episodicMetadata, StandardMemoryType.DOCUMENT);

      // Add to working memory if important enough
      if (importance === ImportanceLevel.HIGH || importance === ImportanceLevel.CRITICAL) {
        this.addToWorkingMemory({
          id: memoryId,
          content,
          addedAt: new Date(),
          priority: importance === ImportanceLevel.CRITICAL ? 3 : 2,
          source: 'episodic',
          relatedIds: []
        });
      }

      return memoryId;
    } catch (error) {
      console.error('Error adding episodic memory:', error);
      throw error;
    }
  }

  /**
   * Add item to working memory, respecting capacity limits
   */
  private addToWorkingMemory(item: WorkingMemoryItem): void {
    // Check if already in working memory
    const existingIndex = this.workingMemory.findIndex(wm => wm.id === item.id);
    if (existingIndex >= 0) {
      // Update existing item
      this.workingMemory[existingIndex] = {
        ...this.workingMemory[existingIndex],
        priority: Math.max(this.workingMemory[existingIndex].priority, item.priority),
        addedAt: new Date() // Reset the age
      };
      return;
    }

    // Add new item, potentially removing least important if at capacity
    if (this.workingMemory.length >= this.workingMemoryCapacity) {
      // Sort by priority (ascending)
      this.workingMemory.sort((a, b) => a.priority - b.priority);
      // Remove least important item
      this.workingMemory.shift();
    }

    // Add new item
    this.workingMemory.push(item);
  }

  /**
   * Get current working memory contents
   */
  getWorkingMemory(): WorkingMemoryItem[] {
    return [...this.workingMemory];
  }

  /**
   * Add an item to working memory from external source
   * This is a public wrapper for the private addToWorkingMemory method
   */
  addItemToWorkingMemory(item: WorkingMemoryItem): void {
    this.addToWorkingMemory(item);
  }

  /**
   * Run memory consolidation process (longer-term storage)
   */
  async consolidateMemories(): Promise<number> {
    try {
      console.log('Running memory consolidation process...');
      this.lastConsolidation = new Date();

      // Get all memories from the past consolidation interval
      const cutoffDate = DateTime.now().minus({ hours: this.consolidationInterval }).toJSDate();

      // Search for memories to consolidate using the new memory services API
      const { searchService, memoryService } = await getMemoryServices();

      // Use the filter to find memories created after cutoff date
      const recentMemoriesResults = await searchService.search('', {
        types: [StandardMemoryType.DOCUMENT],
        filter: {
          must: [
            {
              key: "timestamp",
              range: {
                gte: cutoffDate.toISOString()
              }
            }
          ]
        },
        limit: 100
      });

      if (!recentMemoriesResults || recentMemoriesResults.length === 0) {
        console.log('No memories found for consolidation');
        return 0;
      }

      let consolidatedCount = 0;

      // Process each memory
      for (const result of recentMemoriesResults) {
        const memory = result.point;
        const memoryId = memory.id;

        // Get current decay factor with proper typing
        const metadata = memory.payload.metadata as CognitiveMemoryMetadata;
        const decayFactor = metadata.decayFactor ?? 1.0;
        const retrievalCount = metadata.retrievalCount ?? 0;

        // Calculate new decay factor based on retrieval and time
        const adjustedDecayRate = this.decayRate * (retrievalCount === 0 ? 1.2 : 0.8);
        const currentDecayFactor = Math.max(0, decayFactor - adjustedDecayRate);

        // Get importance level with proper typing
        const importanceValue = metadata.importance ?? ImportanceLevel.MEDIUM;

        // Apply forgetting curve - delete low importance memories that have decayed significantly
        if (String(importanceValue) === ImportanceLevel.LOW && currentDecayFactor > 0.85) {
          // Delete the memory, using proper deletion approach with is_deleted flag
          await memoryService.updateMemory({
            id: memoryId,
            type: StandardMemoryType.DOCUMENT,
            metadata: {
              is_deleted: true,
              deletion_time: new Date().toISOString()
            }
          });
          console.log(`Marked decayed memory as deleted: ${memoryId}`);
        } else {
          // Update the memory with new decay factor using helper function
          await memoryService.updateMemory({
            id: memoryId,
            type: StandardMemoryType.DOCUMENT,
            metadata: updateWithDecayInfo(
              { schemaVersion: metadata.schemaVersion || '1.0.0' },
              currentDecayFactor,
              retrievalCount
            )
          });
          consolidatedCount++;
        }
      }

      console.log(`Consolidated ${consolidatedCount} memories`);
      return consolidatedCount;
    } catch (error) {
      console.error('Error during memory consolidation:', error);
      return 0;
    }
  }

  /**
   * Detect emotions in text content
   */
  private async detectEmotions(content: string): Promise<MemoryEmotion[]> {
    // Simple rule-based emotion detection
    // In production, this would use a more sophisticated NLP model
    const emotions: MemoryEmotion[] = ['neutral'];

    const emotionPatterns: Record<MemoryEmotion, RegExp[]> = {
      positive: [/great|excellent|amazing|wonderful|happy|delighted|pleased/i],
      negative: [/bad|terrible|awful|horrible|disappointed|upset/i],
      surprise: [/wow|unexpected|surprised|shocking|astonishing/i],
      fear: [/afraid|scared|terrified|worried|anxious/i],
      joy: [/joy|delighted|thrilled|ecstatic|excited/i],
      sadness: [/sad|unhappy|depressed|miserable|down/i],
      anger: [/angry|mad|furious|outraged|annoyed/i],
      neutral: []
    };

    // Check for each emotion
    const detectedEmotions: MemoryEmotion[] = [];

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          detectedEmotions.push(emotion as MemoryEmotion);
          break;
        }
      }
    }

    return detectedEmotions.length > 0 ? detectedEmotions : ['neutral'];
  }

  /**
   * Calculate importance for content
   */
  private async calculateImportance(content: string, emotions: MemoryEmotion[]): Promise<ImportanceLevel> {
    const result = await this.importanceCalculator.calculateImportance({
      content,
      contentType: 'memory',
      source: 'cognitive',
      tags: emotions,
      userContext: 'Emotional memory with detected emotions'
    }, ImportanceCalculationMode.HYBRID);

    return result.importance_level;
  }

  /**
   * Schedule regular memory consolidation
   */
  private scheduleMemoryConsolidation(): void {
    // Check if we're running server-side
    if (typeof window !== 'undefined') return;

    // Schedule consolidation every 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        const count = await this.consolidateMemories();
        console.log(`Memory consolidation complete. Processed ${count} memories.`);
      } catch (error) {
        console.error('Error in scheduled memory consolidation:', error);
      }
    }, ONE_DAY);
  }

  /**
   * Get memories by emotional context
   */
  async getMemoriesByEmotion(
    emotion: MemoryEmotion,
    limit: number = 5
  ): Promise<any[]> {
    try {
      // Search for memories with specific emotion
      const { searchService } = await getMemoryServices();
      const emotionResults = await searchService.search('', {
        types: [StandardMemoryType.DOCUMENT],
        filter: {
          must: [
            {
              key: "metadata.emotions",
              match: {
                value: emotion
              }
            }
          ]
        },
        limit
      });

      return emotionResults.map((result: any) => result.point) || [];
    } catch (error) {
      console.error(`Error retrieving memories by emotion ${emotion}:`, error);
      return [];
    }
  }

  /**
   * Update existing memory with new information (reconsolidation)
   */
  async reconsolidateMemory(memoryId: string, newContent: string): Promise<boolean> {
    try {
      // Get memory services
      const { memoryService } = await getMemoryServices();

      // Use proper memory service update functionality with helper function
      await memoryService.updateMemory({
        id: memoryId,
        type: StandardMemoryType.DOCUMENT,
        content: newContent,
        metadata: updateWithDecayInfo(
          { schemaVersion: '1.0.0' },
          1.0, // Reset decay factor to full strength
          1    // Increment retrieval count
        )
      });

      return true;
    } catch (error) {
      console.error('Error reconsolidating memory:', error);
      return false;
    }
  }
}

// Export factory function
export const createCognitiveMemory = (
  importanceCalculator: ImportanceCalculatorService,
  options: {
    workingMemoryCapacity?: number,
    consolidationInterval?: number,
    decayRate?: number
  } = {}
): CognitiveMemory => {
  return new CognitiveMemory(importanceCalculator, options);
}; 