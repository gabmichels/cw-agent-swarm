import * as serverQdrant from '../../../server/qdrant';
import { DateTime } from 'luxon';
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

// Extended memory types
export type MemoryEmotion = 'neutral' | 'positive' | 'negative' | 'surprise' | 'fear' | 'joy' | 'sadness' | 'anger';
export type ImportanceLevel = 'low' | 'medium' | 'high';
export type ExtendedImportanceLevel = ImportanceLevel | 'critical';

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
      
      // Calculate importance with extended levels
      const extendedImportance = metadata.importance || this.calculateImportance(content, emotions);
      
      // Map extended importance to standard importance for base MemoryEntry compatibility
      const standardImportance: ImportanceLevel = 
        extendedImportance === 'critical' ? 'high' : extendedImportance as ImportanceLevel;
      
      // Create extended metadata
      const episodicMetadata = {
        ...metadata,
        episodeId,
        sequence,
        emotions,
        importance: standardImportance,
        // Store critical level separately if applicable
        criticalityLevel: extendedImportance === 'critical' ? 'critical' : null,
        retrievalCount: 0,
        decayFactor: 1.0, // Start with no decay
        type: 'episodic'
      };
      
      // Add to memory
      const memoryId = await super.addMemory(content, episodicMetadata, 'document');
      
      // Add to working memory if important enough
      if (extendedImportance === 'high' || extendedImportance === 'critical') {
        this.addToWorkingMemory({
          id: memoryId,
          content,
          addedAt: new Date(),
          priority: extendedImportance === 'critical' ? 3 : 2,
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
      
      // Search for memories to consolidate
      const recentMemories = await serverQdrant.searchMemory(
        'document',
        '',
        {
          filter: {
            created: { $gte: cutoffDate.toISOString() }
          },
          limit: 100
        }
      );
      
      if (!recentMemories || recentMemories.length === 0) {
        console.log('No memories to consolidate');
        return 0;
      }
      
      console.log(`Found ${recentMemories.length} memories to consider for consolidation`);
      
      let consolidatedCount = 0;
      
      // Process each memory
      for (const memory of recentMemories) {
        // Update decay factor based on usage
        const retrievalCount = memory.metadata?.retrievalCount || 0;
        let importance = memory.metadata?.importance || 'medium';
        
        // Check for critical level
        if (memory.metadata?.criticalityLevel === 'critical') {
          importance = 'critical';
        }
        
        // Calculate new decay factor - important and frequently accessed memories decay slower
        const importanceFactor = 
          importance === 'critical' ? 0.1 :
          importance === 'high' ? 0.3 :
          importance === 'medium' ? 0.6 : 
          1.0;
        
        const usageFactor = Math.max(0.2, 1.0 - (retrievalCount * 0.1));
        const newDecayFactor = Math.min(1.0, (memory.metadata?.decayFactor || 1.0) * importanceFactor * usageFactor);
        
        // Update memory metadata
        // In a real implementation, we would need a function to update memory metadata directly
        // For now, we'll just log what we would do
        console.log(`Memory ${memory.id} - New decay factor: ${newDecayFactor.toFixed(2)}`);
        
        // If decay factor is below threshold, memory would be archived or deleted
        if (newDecayFactor < 0.3) {
          if (importance === 'low') {
            console.log(`Memory ${memory.id} would be removed due to low importance and high decay`);
            // In production: await this.removeMemory(memory.id);
          } else {
            console.log(`Memory ${memory.id} would be archived (reduced embedding dimensions)`);
            // In production: await this.archiveMemory(memory.id);
          }
        }
        
        consolidatedCount++;
      }
      
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
  private calculateImportance(content: string, emotions: MemoryEmotion[]): ExtendedImportanceLevel {
    // Default importance
    let importance: ExtendedImportanceLevel = 'medium';
    
    // Check for critical keywords
    if (/urgent|critical|immediate|emergency|crucial/i.test(content)) {
      importance = 'critical';
    } 
    // Check for high importance keywords
    else if (/important|significant|key|essential|necessary/i.test(content)) {
      importance = 'high';
    }
    // Check for low importance keywords
    else if (/minor|trivial|secondary|whenever convenient/i.test(content)) {
      importance = 'low';
    }
    
    // Adjust based on emotions
    const strongEmotions: MemoryEmotion[] = ['fear', 'anger', 'surprise'];
    if (emotions.some(e => strongEmotions.includes(e))) {
      // Strong emotions increase importance by one level unless already critical
      if (importance !== 'critical') {
        importance = importance === 'high' ? 'critical' : 
                     importance === 'medium' ? 'high' : 'medium';
      }
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
      const memories = await serverQdrant.searchMemory(
        'document',
        '',
        {
          filter: {
            emotions: emotion
          },
          limit
        }
      );
      
      return memories || [];
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