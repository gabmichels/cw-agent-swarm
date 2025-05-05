import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChloeMemory } from './memory';
import { ImportanceLevel, MemorySource } from '../../constants/memory';
import { MemoryType } from '../../server/memory/config/types';

/**
 * Sentiment values for memory entries
 */
export type SentimentType = 'positive' | 'negative' | 'neutral';

/**
 * Interface for tagging results applied to memory
 */
export interface TaggingResult {
  tags: string[];
  importance: ImportanceLevel;
  sentiment?: SentimentType;
  entities?: string[];
  categories?: string[];
  confidence: number; // 0-1 scale
}

/**
 * Interface for a memory entry with tagged metadata
 */
export interface TaggedMemory {
  id: string;
  content: string;
  importance: ImportanceLevel;
  category: string;
  tags: string[];
  sentiment?: SentimentType;
  entities?: string[];
  created: Date;
  source: MemorySource;
  context?: string;
}

/**
 * Interface for entity extraction results
 */
export interface EntityExtractionResult {
  entities: Array<{
    name: string;
    type: string;
    relevance: number; // 0-1 scale
    context?: string;
  }>;
  confidence: number;
}

/**
 * Options for memory tagger initialization
 */
export interface MemoryTaggerOptions {
  model?: ChatOpenAI;
  memory?: ChloeMemory;
  verbose?: boolean;
}

/**
 * MemoryTagger adds metadata and tags to memory entries
 * to improve retrieval and organization
 */
export class MemoryTagger {
  private model: ChatOpenAI;
  private memory?: ChloeMemory;
  private verbose: boolean;
  private memories: Map<string, TaggedMemory> = new Map();
  
  constructor(options?: MemoryTaggerOptions) {
    this.model = options?.model || new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.2,
    });
    this.memory = options?.memory;
    this.verbose = options?.verbose || false;
  }

  /**
   * Analyze text to determine its importance and appropriate tags
   */
  async tagMemory(content: string, source?: string, contextId?: string): Promise<TaggedMemory> {
    // Default source to 'system' if not provided
    const sourceValue = source || 'system';

    try {
      // Calculate importance score 
      const importanceScore = this.calculateImportance(content);
      
      // Convert numeric score to ImportanceLevel enum
      const importance = this.scoreToImportanceLevel(importanceScore);
      
      // Generate tags based on content
      const tags = this.generateTags(content);
      
      const memory: TaggedMemory = {
        id: this.hashContent(content),
        content,
        importance,
        category: this.determineCategory(content),
        tags,
        sentiment: this.determineSentiment(content),
        entities: this.extractEntities(content),
        created: new Date(),
        source: this.determineSource(sourceValue),
        context: contextId
      };
      
      // Store the memory with a unique ID based on content hash
      this.memories.set(memory.id, memory);
      
      // If the memory is important enough, add it to long-term memory
      if (this.shouldAddToMemory(importanceScore)) {
        await this.storeImportantMemory(memory);
      }
      
      return memory;
    } catch (error) {
      console.error('Failed to tag memory:', error);
      throw error;
    }
  }

  /**
   * Convert numeric importance score to ImportanceLevel enum
   */
  private scoreToImportanceLevel(score: number): ImportanceLevel {
    if (score >= 0.6) return ImportanceLevel.HIGH;
    if (score >= 0.3) return ImportanceLevel.MEDIUM;
    return ImportanceLevel.LOW;
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
    
    // 5. NEW: Business goals and metrics are highly important
    const businessKeywords = [
      'goal', 'goals', 'target', 'targets', 'objective', 'objectives', 
      'mission', 'strategy', 'plan', 'roadmap', 'vision', 'milestone',
      'kpi', 'metric', 'metrics', 'measure', 'performance', 'success',
      'budget', 'cost', 'revenue', 'profit', 'sales', 'marketing', 'finance',
      'customer', 'user', 'employee', 'team', 'company', 'organization',
      'project', 'task', 'work', 'job', 'role', 'responsibility', 'deliverable',
      'requirement', 'need'
    ];
    
    const businessCount = businessKeywords.reduce(
      (count, keyword) => 
        count + (content.toLowerCase().includes(keyword) ? 1 : 0), 
      0
    );
    
    // Look for numeric metrics with units/percentages which indicate important goals
    const metricRegexes = [
      /\d+\s*%/i,                          // Percentages: 30%
      /\d+\s*([Kk]|thousand)/i,            // Thousands: 10K, 10k, 10 thousand
      /\d+\s*([Mm]|million)/i,             // Millions: 1M, 1m, 1 million
      /\d+\s*(MAU|DAU|users|customers)/i,  // User metrics: 10,000 MAU
      /\$\d+/i,                            // Dollar amounts: $5
      /[Kk](-|\s)?[Ff]actor/i,             // K-Factor
      /CAC/i,                              // Customer Acquisition Cost
    ];
    
    const hasMetrics = metricRegexes.some(regex => regex.test(content));
    
    // Business goals get a significant boost - particularly if metrics are present
    const businessScore = Math.min((businessCount / 2) + (hasMetrics ? 0.5 : 0), 1) * 0.4;
    score += businessScore;
    
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
   * Store important memory in the agent's memory system
   */
  private async storeImportantMemory(memory: TaggedMemory): Promise<void> {
    if (!this.memory) return;
    
    try {
      // Format memory for storage
      const formattedMemory = `
TAGGED MEMORY:
ID: ${memory.id}
IMPORTANCE: ${memory.importance}
TAGS: ${memory.tags.join(', ')}
SOURCE: ${memory.source}
TIMESTAMP: ${memory.created.toISOString()}
${memory.sentiment ? `SENTIMENT: ${memory.sentiment}` : ''}
${memory.entities ? `ENTITIES: ${memory.entities.join(', ')}` : ''}

${memory.content}
      `.trim();
      
      // Determine the appropriate MemoryType based on the memory category
      let memoryType: MemoryType;
      
      switch (memory.category.toLowerCase()) {
        case 'thought':
        case 'reflection':
        case 'reasoning':
          memoryType = MemoryType.THOUGHT;
          break;
        case 'correction':
        case 'feedback':
          memoryType = MemoryType.CORRECTION;
          break;
        case 'insight':
        case 'realization':
          memoryType = MemoryType.INSIGHT;
          break;
        case 'plan':
        case 'goal':
        case 'task':
          memoryType = MemoryType.TASK;
          break;
        case 'strategy':
          memoryType = MemoryType.STRATEGY;
          break;
        case 'file':
        case 'document':
          memoryType = MemoryType.DOCUMENT;
          break;
        case 'persona':
        case 'user':
          memoryType = MemoryType.PERSONA;
          break;
        case 'error':
        case 'warning':
          memoryType = MemoryType.ERROR_LOG;
          break;
        case 'maintenance':
        case 'system':
          memoryType = MemoryType.MAINTENANCE_LOG;
          break;
        default:
          memoryType = MemoryType.THOUGHT; // Default fallback
      }
      
      // Add the memory to the agent's memory system with all required parameters
      await this.memory?.addMemory(
        formattedMemory,
        memoryType,               // Use determined memory type
        memory.importance,        // Pass through the importance level
        memory.source,            // Pass through the memory source
        `Tagged memory: ${memory.category}`, // Add context
        memory.tags               // Pass through the tags
      );
      
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
    // Convert threshold to ImportanceLevel for comparison
    const thresholdLevel = this.scoreToImportanceLevel(threshold);
    
    // Define importance level values for comparison with better type safety
    const importanceValues: Record<string, number> = {
      [ImportanceLevel.LOW]: 0,
      [ImportanceLevel.MEDIUM]: 1,
      [ImportanceLevel.HIGH]: 2,
      [ImportanceLevel.CRITICAL]: 3
    };
    
    return Array.from(this.memories.values())
      .filter(memory => {
        // Convert memory.importance to string to ensure consistent comparison
        const importanceKey = String(memory.importance);
        const memoryImportanceValue = importanceValues[importanceKey] || 0;
        const thresholdImportanceValue = importanceValues[thresholdLevel] || 0;
        return memoryImportanceValue >= thresholdImportanceValue;
      })
      .sort((a, b) => {
        // Convert to string for consistent comparison
        const aKey = String(a.importance);
        const bKey = String(b.importance);
        const aValue = importanceValues[aKey] || 0;
        const bValue = importanceValues[bKey] || 0;
        return bValue - aValue; // Sort in descending order of importance
      });
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

  private determineSentiment(content: string): SentimentType | undefined {
    // Simple sentiment analysis
    const positiveWords = ['happy', 'good', 'excellent', 'great', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'hate', 'dislike', 'awful', 'angry'];
    
    const contentLower = content.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (contentLower.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (contentLower.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > 0 || negativeCount > 0) return 'neutral';
    
    return undefined;
  }

  private extractEntities(content: string): string[] | undefined {
    // Implement entity extraction logic based on content
    // Placeholder implementation
    const entities: string[] = [];
    
    // Find potential entities (very simplistic approach)
    const words = content.split(/\s+/);
    for (const word of words) {
      // Simple heuristic: capitalize words might be entities
      if (word.length > 1 && word[0] === word[0].toUpperCase() && word[1] === word[1].toLowerCase()) {
        entities.push(word.replace(/[.,;!?]$/, '')); // Remove trailing punctuation
      }
    }
    
    return entities.length > 0 ? entities : undefined;
  }

  /**
   * Map string source to MemorySource enum value
   */
  private determineSource(source: string): MemorySource {
    switch (source.toLowerCase()) {
      case 'user':
        return MemorySource.USER;
      case 'chloe':
      case 'agent':
        return MemorySource.AGENT;
      case 'tool':
      case 'web':
      case 'external':
        return MemorySource.EXTERNAL;
      default:
        return MemorySource.SYSTEM;
    }
  }

  private shouldAddToMemory(importance: number): boolean {
    return importance >= 0.6;
  }

  private logMemory(memory: TaggedMemory) {
    console.log(`
MEMORY TAGGED:
ID: ${memory.id}
IMPORTANCE: ${memory.importance}
TAGS: ${memory.tags.join(', ')}
SOURCE: ${memory.source}
TIMESTAMP: ${memory.created.toISOString()}
${memory.sentiment ? `SENTIMENT: ${memory.sentiment}` : ''}
${memory.entities ? `ENTITIES: ${memory.entities.join(', ')}` : ''}

${memory.content}
    `);
  }
} 