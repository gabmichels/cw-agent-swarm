import { AgentMemory } from '../../lib/memory';

/**
 * TaggedMemory interface for the output of the memory tagger
 */
export interface TaggedMemory {
  id: string;
  content: string;
  importance: number; // Keep this as number only for calculations
  importanceLevel: 'low' | 'medium' | 'high'; // Add a string representation for display
  category: string;
  tags: string[];
  sentiment?: string;
  entities?: string[];
  created: Date;
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
  async tagMemory(content: string, source?: string, contextId?: string): Promise<TaggedMemory> {
    // Default source to 'system' if not provided
    const sourceValue = source || 'system';

    try {
      // Calculate importance based on content characteristics
      const importance = this.calculateImportance(content);
      
      // Generate tags based on content
      const tags = this.generateTags(content);
      
      const memory: TaggedMemory = {
        id: this.hashContent(content),
        content,
        importance,
        importanceLevel: this.determineImportanceLevel(importance),
        category: this.determineCategory(content),
        tags,
        sentiment: this.determineSentiment(content),
        entities: this.extractEntities(content),
        created: new Date()
      };
      
      // Store the memory with a unique ID based on content hash
      this.memories.set(memory.id, memory);
      
      // If the memory is important enough, add it to long-term memory
      if (this.shouldAddToMemory(importance)) {
        await this.storeImportantMemory(memory);
      }
      
      return memory;
    } catch (error) {
      console.error('Failed to tag memory:', error);
      throw error;
    }
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
   * Process a memory entry and extract tags
   */
  async processEntry(text: string): Promise<string[]> {
    // Extract relevant keywords
    const tags: Set<string> = new Set();
    
    // Add tags for files
    if (text.includes('file uploaded') || text.includes('added to memory')) {
      tags.add('file');
    }
    
    if (text.toLowerCase().includes('.pdf') || text.toLowerCase().includes('pdf')) {
      tags.add('pdf');
    }
    
    if (text.toLowerCase().includes('.docx') || text.toLowerCase().includes('word document')) {
      tags.add('document');
    }
    
    if (text.toLowerCase().includes('.jpg') || text.toLowerCase().includes('.png') || 
        text.toLowerCase().includes('.jpeg') || text.toLowerCase().includes('image')) {
      tags.add('image');
    }
    
    if (text.toLowerCase().includes('.txt') || text.toLowerCase().includes('text file')) {
      tags.add('text');
    }
    
    return Array.from(tags);
  }

  /**
   * Store important memories in the agent's long-term memory
   */
  private async storeImportantMemory(memory: TaggedMemory): Promise<void> {
    try {
      // Create a formatted memory entry with metadata
      const formattedMemory = `
IMPORTANCE: ${memory.importance.toFixed(2)} (${memory.importanceLevel})
TAGS: ${memory.tags.join(', ')}
SOURCE: ${memory.category}
TIMESTAMP: ${memory.created.toISOString()}
${memory.sentiment ? `SENTIMENT: ${memory.sentiment}` : ''}
${memory.entities ? `ENTITIES: ${memory.entities.join(', ')}` : ''}

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

  private determineCategory(content: string): string {
    // Implement category determination logic based on content
    return 'Uncategorized';
  }

  private determineSentiment(content: string): string | undefined {
    // Implement sentiment determination logic based on content
    return undefined;
  }

  private extractEntities(content: string): string[] | undefined {
    // Implement entity extraction logic based on content
    return undefined;
  }

  private determineImportanceLevel(importance: number): 'low' | 'medium' | 'high' {
    if (importance < 0.3) return 'low';
    if (importance < 0.7) return 'medium';
    return 'high';
  }

  private shouldAddToMemory(importance: number): boolean {
    return importance >= this.importanceThreshold;
  }

  private logMemory(memory: TaggedMemory) {
    console.log(`
MEMORY TAGGED:
ID: ${memory.id}
IMPORTANCE: ${memory.importance.toFixed(2)} (${memory.importanceLevel})
TAGS: ${memory.tags.join(', ')}
SOURCE: ${memory.category}
TIMESTAMP: ${memory.created.toISOString()}
${memory.sentiment ? `SENTIMENT: ${memory.sentiment}` : ''}
${memory.entities ? `ENTITIES: ${memory.entities.join(', ')}` : ''}

${memory.content}
    `);
  }
} 