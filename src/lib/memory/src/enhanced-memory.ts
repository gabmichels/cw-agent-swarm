import * as serverQdrant from '../../../server/qdrant';
import { DateTime } from 'luxon';
import { ImportanceLevel } from '../../../constants/memory';

/**
 * Enhanced Memory System
 * 
 * Builds on the base memory system with:
 * - Improved integration between subsystems
 * - Feedback loops for memory importance
 * - Natural language date and priority extraction
 * - Learning mechanisms for intent patterns
 */

// Types for memory records
export interface MemoryEntry {
  id: string;
  content: string;
  created: Date;
  timestamp?: string;
  type?: string;
  category: string;
  source: 'user' | 'chloe' | 'system';
  importance: ImportanceLevel;
  context?: string;
  tags?: string[];
  usageCount?: number;
  lastAccessed?: Date;
  relationships?: Array<{
    relatedId: string;
    relationType: 'causes' | 'similar' | 'contradicts' | 'supports' | 'partOf';
    strength: number;
  }>;
}

// Memory search options
export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

// Patterns for natural language date extraction
const DATE_PATTERNS = [
  // Day of week (e.g., "by Friday", "until Monday")
  { regex: /by\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i, handler: 'dayOfWeek' },
  
  // Relative days (e.g., "in 3 days", "within 5 days")
  { regex: /in\s+(\d+)\s+days?/i, handler: 'relativeDays' },
  
  // Today/Tomorrow
  { regex: /(today|tomorrow)/i, handler: 'relativeDayName' },
  
  // Next week
  { regex: /next\s+(week|month)/i, handler: 'nextPeriod' },
  
  // End of week/month
  { regex: /end\s+of\s+(week|month)/i, handler: 'endOfPeriod' },
];

// Patterns for priority extraction
const PRIORITY_PATTERNS = [
  // High priority indicators
  { regex: /(urgent|crucial|critical|important|asap|immediately|emergency)/i, priority: ImportanceLevel.HIGH },
  
  // Medium priority indicators
  { regex: /(moderate|medium|normal|standard|regular)/i, priority: ImportanceLevel.MEDIUM },
  
  // Low priority indicators
  { regex: /(low|minor|whenever|leisure|no rush|when you can)/i, priority: ImportanceLevel.LOW },
];

/**
 * Enhanced Memory system with integration features and learning
 */
export class EnhancedMemory {
  private namespace: string;
  private isInitialized: boolean = false;
  private config: Record<string, any>;
  private intentPatterns: Map<string, Array<{pattern: string, count: number}>> = new Map();
  
  constructor(options: { namespace?: string, config?: Record<string, any> }) {
    this.namespace = options.namespace || 'default';
    this.config = options.config || {
      vectorStoreUrl: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      defaultNamespace: 'default',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    };
    
    // Initialize Qdrant (server-side only)
    if (typeof window === 'undefined') {
      console.log(`Initializing enhanced memory for namespace: ${this.namespace}`);
      serverQdrant.initMemory({
        qdrantUrl: this.config.vectorStoreUrl,
        qdrantApiKey: this.config.apiKey,
        useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
      }).catch(err => {
        console.error('Failed to initialize enhanced memory:', err);
      });
    }
    
    // Load saved intent patterns if available
    this.loadIntentPatterns();
  }

  /**
   * Initialize memory
   */
  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        await serverQdrant.initMemory({
          qdrantUrl: this.config.vectorStoreUrl,
          qdrantApiKey: this.config.apiKey,
          useOpenAI: true
        });
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing enhanced memory:', error);
      return false;
    }
  }

  /**
   * Add a memory entry with rich metadata
   */
  async addMemory(
    content: string,
    metadata: Record<string, any> = {},
    type: 'message' | 'thought' | 'document' | 'task' = 'document'
  ): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Extract priority from content if not provided
      if (!metadata.importance) {
        metadata.importance = this.extractPriority(content);
      }
      
      // Extract dates from content if relevant
      if (type === 'task' && !metadata.deadline) {
        const extractedDate = this.extractDateFromText(content);
        if (extractedDate) {
          metadata.deadline = extractedDate.toISOString();
          metadata.extracted_deadline = true;
        }
      }
      
      // Add namespace and usage tracking to metadata
      metadata.namespace = this.namespace;
      metadata.usageCount = 0;
      metadata.lastAccessed = new Date().toISOString();
      
      // Use document type by default
      return serverQdrant.addMemory(type, content, metadata);
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  /**
   * Get memories by semantic relevance to a query
   */
  async getRelevantMemories(
    query: string,
    limit: number = 5,
    types: Array<'message' | 'thought' | 'document' | 'task'> = ['document', 'thought']
  ): Promise<string[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Search across specified memory types
      const allResults: Array<any> = [];
      
      for (const type of types) {
        const results = await serverQdrant.searchMemory(type, query, { limit });
        if (results && results.length > 0) {
          // Update usage count
          for (const result of results) {
            this.trackMemoryUsage(result.id);
          }
          allResults.push(...results);
        }
      }
      
      // Sort by relevance score
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Return as readable text
      return allResults.slice(0, limit).map(mem => mem.text);
    } catch (error) {
      console.error('Error retrieving relevant memories:', error);
      return [];
    }
  }

  /**
   * Store a new successful intent pattern
   */
  async storeIntentPattern(intent: string, pattern: string): Promise<void> {
    try {
      // Get existing patterns for this intent
      if (!this.intentPatterns.has(intent)) {
        this.intentPatterns.set(intent, []);
      }
      
      const patterns = this.intentPatterns.get(intent)!;
      
      // Check if pattern exists
      const existingPattern = patterns.find(p => p.pattern === pattern);
      
      if (existingPattern) {
        // Increment count if exists
        existingPattern.count++;
      } else {
        // Add new pattern
        patterns.push({ pattern, count: 1 });
      }
      
      // Save updated patterns
      this.saveIntentPatterns();
      
      // Also save as a memory for future reference
      await this.addMemory(
        `Intent pattern recognized: "${pattern}" mapped to intent "${intent}"`,
        {
          type: 'intent_pattern',
          intent,
          pattern,
          importance: 'medium',
          category: 'learning'
        },
        'document'
      );
    } catch (error) {
      console.error('Error storing intent pattern:', error);
    }
  }

  /**
   * Track memory usage for optimization
   */
  private async trackMemoryUsage(memoryId: string): Promise<void> {
    try {
      // Update memory metadata to track usage
      // This would ideally use a direct update method in Qdrant
      // For now, we just log that we'd update it
      console.log(`Memory ${memoryId} was used - would increment usage count`);
      
      // In a production implementation, we would:
      // 1. Retrieve the memory record
      // 2. Increment usageCount
      // 3. Update lastAccessed timestamp
      // 4. Save back to Qdrant
    } catch (error) {
      console.error('Error tracking memory usage:', error);
    }
  }

  /**
   * Extract date from natural language text
   */
  extractDateFromText(text: string): Date | null {
    try {
      // Loop through patterns and find matches
      for (const pattern of DATE_PATTERNS) {
        const match = text.match(pattern.regex);
        
        if (match) {
          const now = DateTime.local();
          
          switch (pattern.handler) {
            case 'dayOfWeek': {
              const targetDay = match[1].toLowerCase();
              const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const targetDayIndex = daysOfWeek.indexOf(targetDay);
              
              if (targetDayIndex !== -1) {
                let daysToAdd = targetDayIndex - now.weekday;
                // If the day has passed this week, go to next week
                if (daysToAdd <= 0) daysToAdd += 7;
                return now.plus({ days: daysToAdd }).startOf('day').toJSDate();
              }
              break;
            }
            
            case 'relativeDays': {
              const days = parseInt(match[1]);
              return now.plus({ days }).startOf('day').toJSDate();
            }
            
            case 'relativeDayName': {
              const dayName = match[1].toLowerCase();
              if (dayName === 'today') {
                return now.startOf('day').toJSDate();
              } else if (dayName === 'tomorrow') {
                return now.plus({ days: 1 }).startOf('day').toJSDate();
              }
              break;
            }
            
            case 'nextPeriod': {
              const period = match[1].toLowerCase();
              if (period === 'week') {
                return now.plus({ weeks: 1 }).startOf('week').toJSDate();
              } else if (period === 'month') {
                return now.plus({ months: 1 }).startOf('month').toJSDate();
              }
              break;
            }
            
            case 'endOfPeriod': {
              const period = match[1].toLowerCase();
              if (period === 'week') {
                return now.endOf('week').toJSDate();
              } else if (period === 'month') {
                return now.endOf('month').toJSDate();
              }
              break;
            }
          }
        }
      }
      
      // No match found
      return null;
    } catch (error) {
      console.error('Error extracting date from text:', error);
      return null;
    }
  }

  /**
   * Extract priority from text content
   */
  extractPriority(text: string): ImportanceLevel {
    for (const pattern of PRIORITY_PATTERNS) {
      if (pattern.regex.test(text)) {
        return pattern.priority;
      }
    }
    
    // Default to medium priority
    return ImportanceLevel.MEDIUM;
  }

  /**
   * Save intent patterns to memory
   */
  private async saveIntentPatterns(): Promise<void> {
    try {
      // Convert Map to object for storage
      const patternsObject: Record<string, Array<{pattern: string, count: number}>> = {};
      
      this.intentPatterns.forEach((patterns, intent) => {
        patternsObject[intent] = patterns;
      });
      
      // Store in memory
      await this.addMemory(
        `Intent patterns database: ${JSON.stringify(patternsObject)}`,
        {
          type: 'intent_patterns_db',
          importance: 'high',
          category: 'system',
          content_type: 'json'
        },
        'document'
      );
    } catch (error) {
      console.error('Error saving intent patterns:', error);
    }
  }

  /**
   * Load intent patterns from memory
   */
  private async loadIntentPatterns(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Search for the intent patterns database
      const results = await serverQdrant.searchMemory(
        'document',
        'Intent patterns database',
        { 
          limit: 1,
          filter: {
            type: 'intent_patterns_db'
          }
        }
      );
      
      if (results && results.length > 0) {
        const patternsText = results[0].text;
        
        // Extract the JSON part
        const jsonMatch = patternsText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const patternsObject = JSON.parse(jsonMatch[0]);
          
          // Convert to Map
          this.intentPatterns = new Map();
          
          Object.entries(patternsObject).forEach(([intent, patterns]) => {
            this.intentPatterns.set(intent, patterns as Array<{pattern: string, count: number}>);
          });
          
          console.log(`Loaded ${this.intentPatterns.size} intent patterns from memory`);
        }
      }
    } catch (error) {
      console.error('Error loading intent patterns:', error);
      // Initialize with empty Map if loading fails
      this.intentPatterns = new Map();
    }
  }
}

// Export singleton instance
export const createEnhancedMemory = (namespace: string = 'chloe'): EnhancedMemory => {
  return new EnhancedMemory({ namespace });
}; 