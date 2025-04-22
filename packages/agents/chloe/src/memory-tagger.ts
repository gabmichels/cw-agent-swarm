import { AgentMemory } from '@crowd-wisdom/memory';

export interface TaggedMemory {
  content: string;
  timestamp: string;
  importance: number;
  tags: string[];
  source: string;
  contextId?: string;
}

export interface MemoryTaggerOptions {
  agentMemory: AgentMemory;
  importanceThreshold?: number;
}

/**
 * MemoryTagger is responsible for determining the importance of memories
 * and tagging them appropriately for future retrieval
 */
export class MemoryTagger {
  private agentMemory: AgentMemory;
  private importanceThreshold: number;
  private memories: Map<string, TaggedMemory> = new Map();

  constructor(options: MemoryTaggerOptions) {
    this.agentMemory = options.agentMemory;
    this.importanceThreshold = options.importanceThreshold || 0.7;
  }

  /**
   * Analyze text to determine its importance and appropriate tags
   */
  async tagMemory(content: string, source: string, contextId?: string): Promise<TaggedMemory> {
    // Calculate importance based on content characteristics
    const importance = this.calculateImportance(content);
    
    // Generate tags based on content
    const tags = this.generateTags(content);
    
    const memory: TaggedMemory = {
      content,
      timestamp: new Date().toISOString(),
      importance,
      tags,
      source,
      contextId
    };
    
    // Store the memory with a unique ID based on content hash
    const memoryId = this.hashContent(content);
    this.memories.set(memoryId, memory);
    
    // If the memory is important enough, add it to long-term memory
    if (importance >= this.importanceThreshold) {
      await this.storeImportantMemory(memory);
    }
    
    return memory;
  }

  /**
   * Calculate importance score based on various heuristics
   * Returns a value between 0 and 1
   */
  private calculateImportance(content: string): number {
    let score = 0;
    
    // Simple heuristics for importance (can be improved with more complex logic or ML)
    
    // 1. Length - longer content might contain more important information
    const normalizedLength = Math.min(content.length / 1000, 1) * 0.2;
    score += normalizedLength;
    
    // 2. Contains certain keywords that indicate importance
    const importantKeywords = [
      'important', 'critical', 'essential', 'remember', 'don\'t forget',
      'crucial', 'vital', 'significant', 'key', 'priority',
      'deadline', 'urgent', 'asap', 'immediately'
    ];
    
    const keywordCount = importantKeywords.reduce(
      (count, keyword) => 
        count + (content.toLowerCase().includes(keyword) ? 1 : 0), 
      0
    );
    
    const keywordScore = Math.min(keywordCount / 3, 1) * 0.3;
    score += keywordScore;
    
    // 3. Contains personal information or preferences
    const personalKeywords = [
      'my name is', 'i am', 'i like', 'i don\'t like', 'i prefer',
      'i need', 'i want', 'my project', 'my work', 'my job',
      'my company', 'my team', 'my family', 'my hobby'
    ];
    
    const personalCount = personalKeywords.reduce(
      (count, keyword) => 
        count + (content.toLowerCase().includes(keyword) ? 1 : 0), 
      0
    );
    
    const personalScore = Math.min(personalCount / 2, 1) * 0.3;
    score += personalScore;
    
    // 4. Emotional content might be important to remember
    const emotionalKeywords = [
      'happy', 'sad', 'angry', 'excited', 'worried',
      'anxious', 'frustrated', 'disappointed', 'pleased', 'proud',
      'loved', 'hated', 'afraid', 'confident', 'uncomfortable'
    ];
    
    const emotionalCount = emotionalKeywords.reduce(
      (count, keyword) => 
        count + (content.toLowerCase().includes(keyword) ? 1 : 0), 
      0
    );
    
    const emotionalScore = Math.min(emotionalCount / 2, 1) * 0.2;
    score += emotionalScore;
    
    return Math.min(score, 1);
  }

  /**
   * Generate appropriate tags for the memory based on content
   */
  private generateTags(content: string): string[] {
    const tags: string[] = [];
    const lowercaseContent = content.toLowerCase();
    
    // Add category tags
    if (lowercaseContent.includes('project') || 
        lowercaseContent.includes('task') || 
        lowercaseContent.includes('work')) {
      tags.push('work');
    }
    
    if (lowercaseContent.includes('like') || 
        lowercaseContent.includes('prefer') || 
        lowercaseContent.includes('enjoy')) {
      tags.push('preference');
    }
    
    if (lowercaseContent.includes('dislike') || 
        lowercaseContent.includes('hate') || 
        lowercaseContent.includes('don\'t like')) {
      tags.push('aversion');
    }
    
    if (lowercaseContent.includes('name') || 
        lowercaseContent.includes('called') || 
        lowercaseContent.includes('my name')) {
      tags.push('identity');
    }
    
    if (lowercaseContent.includes('deadline') || 
        lowercaseContent.includes('by tomorrow') || 
        lowercaseContent.includes('next week') ||
        lowercaseContent.includes('schedule') ||
        lowercaseContent.includes('calendar')) {
      tags.push('time-sensitive');
    }
    
    // Add emotional tags
    if (lowercaseContent.includes('happy') || 
        lowercaseContent.includes('excited') || 
        lowercaseContent.includes('glad')) {
      tags.push('positive-emotion');
    }
    
    if (lowercaseContent.includes('sad') || 
        lowercaseContent.includes('upset') || 
        lowercaseContent.includes('frustrated')) {
      tags.push('negative-emotion');
    }
    
    return tags;
  }

  /**
   * Store important memories in the agent's long-term memory
   */
  private async storeImportantMemory(memory: TaggedMemory): Promise<void> {
    try {
      // Create a formatted memory entry with metadata
      const formattedMemory = `
IMPORTANCE: ${memory.importance.toFixed(2)}
TAGS: ${memory.tags.join(', ')}
SOURCE: ${memory.source}
TIMESTAMP: ${memory.timestamp}
${memory.contextId ? `CONTEXT: ${memory.contextId}` : ''}

${memory.content}
      `.trim();
      
      // Add the memory to the agent's memory system
      await this.agentMemory.addMemory(formattedMemory);
      
      console.log(`Added important memory to long-term storage: "${memory.content.substring(0, 50)}..."`);
    } catch (error) {
      console.error('Failed to store important memory:', error);
    }
  }

  /**
   * Get all memories that match specific tags
   */
  getMemoriesByTags(tags: string[]): TaggedMemory[] {
    return Array.from(this.memories.values())
      .filter(memory => 
        tags.some(tag => memory.tags.includes(tag))
      );
  }

  /**
   * Get all memories with importance above a threshold
   */
  getImportantMemories(threshold = 0.7): TaggedMemory[] {
    return Array.from(this.memories.values())
      .filter(memory => memory.importance >= threshold)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Simple content hashing for memory identification
   */
  private hashContent(content: string): string {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString() + Date.now().toString(36);
  }
} 