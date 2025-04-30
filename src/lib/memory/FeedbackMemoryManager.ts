/**
 * FeedbackMemoryManager
 * 
 * Monitors execution outcomes and memory signals
 * Automatically escalates repeat issues or useful insights
 * Supports priority-based memory surfacing
 */

import { ChloeMemoryType, ImportanceLevel, MemorySource } from '../../constants/memory';
import { MessageType } from '../../constants/message';
import { storeInternalMessageToMemory } from './storeInternalMessageToMemory';

export interface MemoryItem {
  id?: string;
  content: string;
  category?: string;
  importance?: string;
  created?: string;
  metadata?: Record<string, any>;
}

export interface FeedbackItem {
  id: string;
  content: string;
  type: MessageType;
  category: string;
  timestamp: Date;
  importance: ImportanceLevel;
  relatedTaskId?: string;
  occurrenceCount: number;
  lastOccurrence: Date;
  metadata?: Record<string, any>;
}

export class FeedbackMemoryManager {
  private memoryManager: any;
  private feedbackItems: Map<string, FeedbackItem> = new Map();
  private threshold: number = 3; // Number of similar issues to trigger escalation
  
  constructor(memoryManager: any, options: { threshold?: number } = {}) {
    this.memoryManager = memoryManager;
    this.threshold = options.threshold || 3;
  }
  
  /**
   * Initialize the feedback memory manager
   */
  async initialize(): Promise<void> {
    console.log('Initializing FeedbackMemoryManager...');
    // Load existing feedback items from memory
    await this.loadFeedbackItems();
  }
  
  /**
   * Load existing feedback items from memory storage
   */
  private async loadFeedbackItems(): Promise<void> {
    try {
      // Get feedback-related memories
      const feedbackMemories = await this.memoryManager.getMemoriesByType(
        ChloeMemoryType.THOUGHT, 
        10, 
        { tags: ['feedback', 'improvement'] }
      );
      
      // Process and add to feedback items map
      feedbackMemories.forEach((memory: MemoryItem) => {
        const feedbackItem: FeedbackItem = {
          id: memory.id || `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          content: memory.content,
          type: MessageType.THOUGHT,
          category: memory.category || 'general',
          timestamp: new Date(memory.created || new Date()),
          importance: (memory.importance as unknown as ImportanceLevel) || ImportanceLevel.MEDIUM,
          relatedTaskId: memory.metadata?.taskId,
          occurrenceCount: memory.metadata?.occurrenceCount || 1,
          lastOccurrence: new Date(memory.metadata?.lastOccurrence || memory.created || new Date()),
          metadata: memory.metadata
        };
        
        this.feedbackItems.set(feedbackItem.id, feedbackItem);
      });
      
      console.log(`Loaded ${this.feedbackItems.size} feedback items from memory`);
    } catch (error) {
      console.error('Error loading feedback items:', error);
    }
  }
  
  /**
   * Add a new feedback item to the manager
   */
  async addFeedback(
    content: string,
    type: MessageType.THOUGHT | MessageType.REFLECTION,
    category: string,
    importance: ImportanceLevel = ImportanceLevel.MEDIUM,
    metadata: Record<string, any> = {}
  ): Promise<FeedbackItem> {
    // Create a new feedback item
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const feedbackItem: FeedbackItem = {
      id,
      content,
      type,
      category,
      timestamp: new Date(),
      importance,
      relatedTaskId: metadata.taskId,
      occurrenceCount: 1,
      lastOccurrence: new Date(),
      metadata
    };
    
    // Find similar feedback items
    const similarKey = this.findSimilarFeedbackKey(content);
    
    if (similarKey) {
      // Update existing feedback item
      const existingItem = this.feedbackItems.get(similarKey)!;
      existingItem.occurrenceCount += 1;
      existingItem.lastOccurrence = new Date();
      existingItem.importance = this.calculateEscalatedImportance(existingItem);
      
      // Check if we've reached the threshold for escalation
      if (existingItem.occurrenceCount >= this.threshold) {
        await this.escalateFeedback(existingItem);
      }
      
      // Update in memory
      await this.updateFeedbackInMemory(existingItem);
      
      return existingItem;
    } else {
      // Store new feedback item
      this.feedbackItems.set(id, feedbackItem);
      
      // Store in memory system
      await storeInternalMessageToMemory(
        content,
        type,
        this.memoryManager,
        {
          category,
          importance,
          tags: ['feedback', 'improvement', category],
          taskId: metadata.taskId,
          occurrenceCount: 1,
          lastOccurrence: new Date().toISOString(),
          ...metadata
        }
      );
      
      return feedbackItem;
    }
  }
  
  /**
   * Find a similar feedback item based on content
   */
  private findSimilarFeedbackKey(content: string): string | null {
    // Simple implementation - would be improved with embedding similarity in production
    const normalizedContent = content.toLowerCase().trim();
    let foundKey: string | null = null;
    
    // Use forEach instead of for...of to avoid linter errors
    this.feedbackItems.forEach((item, key) => {
      const itemContent = item.content.toLowerCase().trim();
      
      // Check for substantial overlap
      if (this.calculateTextSimilarity(normalizedContent, itemContent) > 0.7) {
        foundKey = key;
      }
    });
    
    return foundKey;
  }
  
  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // This is a simple implementation - would use embeddings in production
    // Count shared words
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    let sharedWords = 0;
    
    // Use Array.from to avoid for...of loop
    Array.from(words1).forEach(word => {
      if (words2.has(word)) {
        sharedWords++;
      }
    });
    
    // Calculate Jaccard similarity
    const unionSize = words1.size + words2.size - sharedWords;
    return unionSize === 0 ? 0 : sharedWords / unionSize;
  }
  
  /**
   * Calculate escalated importance based on occurrence count
   */
  private calculateEscalatedImportance(item: FeedbackItem): ImportanceLevel {
    if (item.occurrenceCount >= this.threshold * 2) {
      return ImportanceLevel.CRITICAL;
    } else if (item.occurrenceCount >= this.threshold) {
      return ImportanceLevel.HIGH;
    }
    
    return item.importance;
  }
  
  /**
   * Escalate feedback when it reaches threshold
   */
  private async escalateFeedback(item: FeedbackItem): Promise<void> {
    // Create an escalated reflection
    const escalationContent = `
IMPORTANT RECURRING FEEDBACK: This issue has occurred ${item.occurrenceCount} times and requires attention:

${item.content}

Category: ${item.category}
Last Occurrence: ${item.lastOccurrence.toISOString()}
Related Task: ${item.relatedTaskId || 'N/A'}
    `.trim();
    
    // Store as a high importance reflection
    await storeInternalMessageToMemory(
      escalationContent,
      MessageType.REFLECTION,
      this.memoryManager,
      {
        category: item.category,
        importance: ImportanceLevel.HIGH,
        tags: ['escalated', 'feedback', 'improvement', item.category],
        taskId: item.relatedTaskId,
        occurrenceCount: item.occurrenceCount,
        originalFeedbackId: item.id,
        lastOccurrence: item.lastOccurrence.toISOString(),
        ...item.metadata
      }
    );
    
    console.log(`Escalated feedback: ${item.id} with ${item.occurrenceCount} occurrences`);
  }
  
  /**
   * Update an existing feedback item in memory
   */
  private async updateFeedbackInMemory(item: FeedbackItem): Promise<void> {
    // Update the memory entry with the new occurrence count and importance
    await this.memoryManager.updateMemory(
      item.id,
      {
        content: item.content,
        importance: item.importance,
        metadata: {
          ...item.metadata,
          occurrenceCount: item.occurrenceCount,
          lastOccurrence: item.lastOccurrence.toISOString()
        }
      }
    );
  }
  
  /**
   * Get high priority feedback for planning
   */
  async getHighPriorityFeedback(limit: number = 3): Promise<FeedbackItem[]> {
    // Convert map to array and sort by importance and occurrence count
    const allFeedback = Array.from(this.feedbackItems.values());
    
    return allFeedback
      .sort((a, b) => {
        // Sort by importance first
        const importanceOrder = {
          [ImportanceLevel.CRITICAL]: 3,
          [ImportanceLevel.HIGH]: 2,
          [ImportanceLevel.MEDIUM]: 1,
          [ImportanceLevel.LOW]: 0
        };
        
        const importanceDiff = 
          importanceOrder[b.importance] - importanceOrder[a.importance];
        
        if (importanceDiff !== 0) return importanceDiff;
        
        // Then by occurrence count
        return b.occurrenceCount - a.occurrenceCount;
      })
      .slice(0, limit);
  }
} 