import { getMemoryServices } from '../../../server/memory/services';
import { DateTime } from 'luxon';
import { EnhancedMemory, MemoryEntry } from './enhanced-memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
import { SearchResult } from '../../../server/memory/services/search/types';
import { BaseMemorySchema } from '../../../server/memory/models';

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

// Extended memory types
export type MemoryEmotion = 'neutral' | 'positive' | 'negative' | 'surprise' | 'fear' | 'joy' | 'sadness' | 'anger';

// Define the memory metadata interface
export interface MemoryMetadataSchema {
  schemaVersion: string;
  decayFactor?: number;
  retrievalCount?: number;
  importance?: ImportanceLevel;
  emotions?: MemoryEmotion[];
  tags?: string[];
  [key: string]: unknown;
}

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

/**
 * Cognitive Memory system with human-like memory processes
 */
export class CognitiveMemory extends EnhancedMemory {
  private workingMemory: WorkingMemoryItem[] = [];
  private workingMemoryCapacity: number = 7; // Miller's Law - 7±2 items
  private lastConsolidation: Date = new Date();
  private emotionDetectionEnabled: boolean = true;
  private consolidationInterval: number = 24; // hours
  private decayRate: number = 0.05; // 5% per day for unused memories
  
  constructor(options: { 
    namespace?: string, 
    config?: Record<string, any>,
    workingMemoryCapacity?: number,
    consolidationInterval?: number,
    decayRate?: number
  }) {
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
    metadata: Record<string, any> = {},
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
      const importance = metadata.importance || this.calculateImportance(content, emotions);
      
      // Create extended metadata
      const episodicMetadata = {
        ...metadata,
        episodeId,
        sequence,
        emotions,
        importance,
        retrievalCount: 0,
        decayFactor: 1.0, // Start with no decay
        type: 'episodic'
      };
      
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
        const metadata = memory.payload.metadata as MemoryMetadataSchema;
        const decayFactor = metadata.decayFactor ?? 1.0;
        const retrievalCount = metadata.retrievalCount ?? 0;
        
        // Calculate new decay factor based on retrieval and time
        const adjustedDecayRate = this.decayRate * (retrievalCount === 0 ? 1.2 : 0.8);
        const currentDecayFactor = Math.max(0, decayFactor - adjustedDecayRate);
        
        // Get importance level with proper typing
        const importanceValue = metadata.importance ?? ImportanceLevel.MEDIUM;
        
        // Apply forgetting curve - delete low importance memories that have decayed significantly
        if (String(importanceValue) === ImportanceLevel.LOW && currentDecayFactor > 0.85) {
          // Delete the memory
          await memoryService.deleteMemory({
            id: memoryId,
            type: StandardMemoryType.DOCUMENT
          });
          console.log(`Removed decayed memory: ${memoryId}`);
        } else {
          // Update the memory with new decay factor
          await memoryService.updateMemory({
            id: memoryId,
            type: StandardMemoryType.DOCUMENT,
            metadata: {
              decayFactor: currentDecayFactor 
            }
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
   * Calculate importance based on content and emotions
   */
  private calculateImportance(content: string, emotions: MemoryEmotion[]): ImportanceLevel {
    // Default importance
    let importance: ImportanceLevel = ImportanceLevel.MEDIUM;
    
    // Check for critical keywords
    const criticalKeywords = [
      'urgent', 'critical', 'emergency', 'immediate', 'crucial', 'vital',
      'security', 'breach', 'violation', 'danger', 'threat', 'risk'
    ];
    
    // Check for high importance keywords
    const highImportanceKeywords = [
      'important', 'significant', 'key', 'essential', 'remember', 'priority',
      'deadline', 'required', 'necessary', 'needed', 'mandate'
    ];
    
    // Check for emotional significance
    const highEmotions = ['fear', 'surprise', 'anger'];
    
    // Check content for critical or high importance indicators
    if (criticalKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
      importance = ImportanceLevel.CRITICAL;
    } else if (
      highImportanceKeywords.some(keyword => content.toLowerCase().includes(keyword)) || 
      emotions.some(emotion => highEmotions.includes(emotion))
    ) {
      importance = ImportanceLevel.HIGH;
    } else if (content.length < 20 || content.split(' ').length < 5) {
      // Very short messages tend to be less important
      importance = ImportanceLevel.LOW;
    }
    
    // Emotional intensity can increase importance
    if (emotions.length > 2 && importance !== ImportanceLevel.CRITICAL) {
      importance = ImportanceLevel.HIGH;
    }
    
    return importance;
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
      
      return emotionResults.map(result => result.point) || [];
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
      // In a real implementation, we would need a function to update memory content directly
      // For now, we'll just log what we would do
      console.log(`Memory ${memoryId} would be reconsolidated with new content: ${newContent}`);
      
      // In production, we would:
      // 1. Retrieve the existing memory
      // 2. Merge old content with new content
      // 3. Create new embedding
      // 4. Update the memory record
      
      return true;
    } catch (error) {
      console.error('Error reconsolidating memory:', error);
      return false;
    }
  }
}

// Export factory function
export const createCognitiveMemory = (
  namespace: string = 'chloe',
  options: {
    workingMemoryCapacity?: number,
    consolidationInterval?: number,
    decayRate?: number
  } = {}
): CognitiveMemory => {
  return new CognitiveMemory({ 
    namespace,
    ...options
  });
}; 