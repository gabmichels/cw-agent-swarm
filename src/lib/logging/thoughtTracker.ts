/**
 * ThoughtTracker - A utility for tracking agent thoughts, reflections, and actions
 * Provides a structured way to log the agent's reasoning process
 */

import fs from 'fs';
import path from 'path';

export interface Thought {
  id: string;
  content: string;
  timestamp: Date;
  type: 'observation' | 'reflection' | 'decision' | 'action' | 'plan';
  agentId: string;
  metadata?: Record<string, any>;
  parentId?: string;
}

export interface ThoughtTrackerOptions {
  agentId: string;
  outputPath?: string;
  persistToFile?: boolean;
  maxInMemoryThoughts?: number;
}

/**
 * Tracks an agent's thoughts, reflections, and actions during execution
 */
export class ThoughtTracker {
  private agentId: string;
  private thoughts: Thought[] = [];
  private outputPath: string;
  private persistToFile: boolean;
  private maxInMemoryThoughts: number;
  
  constructor(options: ThoughtTrackerOptions) {
    this.agentId = options.agentId;
    this.outputPath = options.outputPath || path.join(process.cwd(), 'logs', 'thoughts');
    this.persistToFile = options.persistToFile !== undefined ? options.persistToFile : true;
    this.maxInMemoryThoughts = options.maxInMemoryThoughts || 1000;
    
    // Ensure the output directory exists
    if (this.persistToFile) {
      try {
        fs.mkdirSync(this.outputPath, { recursive: true });
      } catch (error) {
        console.error('Error creating thought log directory:', error);
      }
    }
  }
  
  /**
   * Add a new thought to the tracker
   */
  addThought(
    content: string,
    type: 'observation' | 'reflection' | 'decision' | 'action' | 'plan',
    metadata?: Record<string, any>,
    parentId?: string
  ): Thought {
    const id = `thought_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date();
    
    const thought: Thought = {
      id,
      content,
      timestamp,
      type,
      agentId: this.agentId,
      metadata,
      parentId
    };
    
    // Add to in-memory array
    this.thoughts.push(thought);
    
    // Trim if exceeded max capacity
    if (this.thoughts.length > this.maxInMemoryThoughts) {
      this.thoughts = this.thoughts.slice(-this.maxInMemoryThoughts);
    }
    
    // Write to file if enabled
    if (this.persistToFile) {
      this.writeThoughtToFile(thought);
    }
    
    return thought;
  }
  
  /**
   * Log an observation (something the agent noticed)
   */
  logObservation(content: string, metadata?: Record<string, any>): Thought {
    return this.addThought(content, 'observation', metadata);
  }
  
  /**
   * Log a reflection (agent thinking about past actions)
   */
  logReflection(content: string, metadata?: Record<string, any>): Thought {
    return this.addThought(content, 'reflection', metadata);
  }
  
  /**
   * Log a decision (a choice the agent made)
   */
  logDecision(content: string, metadata?: Record<string, any>): Thought {
    return this.addThought(content, 'decision', metadata);
  }
  
  /**
   * Log an action (something the agent did)
   */
  logAction(content: string, metadata?: Record<string, any>): Thought {
    return this.addThought(content, 'action', metadata);
  }
  
  /**
   * Log a plan (series of steps the agent intends to take)
   */
  logPlan(content: string, metadata?: Record<string, any>): Thought {
    return this.addThought(content, 'plan', metadata);
  }
  
  /**
   * Get recent thoughts, optionally filtered by type
   */
  getRecentThoughts(limit: number = 10, type?: Thought['type']): Thought[] {
    let filtered = this.thoughts;
    
    if (type) {
      filtered = filtered.filter(t => t.type === type);
    }
    
    return filtered.slice(-limit);
  }
  
  /**
   * Get a thought chain by following parent IDs
   */
  getThoughtChain(thoughtId: string): Thought[] {
    const chain: Thought[] = [];
    let currentId = thoughtId;
    
    while (currentId) {
      const thought = this.thoughts.find(t => t.id === currentId);
      if (!thought) break;
      
      chain.unshift(thought); // Add to beginning
      currentId = thought.parentId || '';
    }
    
    return chain;
  }
  
  /**
   * Search thoughts by content
   */
  searchThoughts(query: string, limit: number = 10): Thought[] {
    const lowerQuery = query.toLowerCase();
    
    return this.thoughts
      .filter(t => t.content.toLowerCase().includes(lowerQuery))
      .slice(-limit);
  }
  
  /**
   * Write a thought to the log file
   */
  private writeThoughtToFile(thought: Thought): void {
    try {
      const fileName = `${this.agentId}_thoughts_${thought.timestamp.toISOString().split('T')[0]}.jsonl`;
      const filePath = path.join(this.outputPath, fileName);
      
      const line = JSON.stringify(thought) + '\n';
      fs.appendFileSync(filePath, line);
    } catch (error) {
      console.error('Error writing thought to file:', error);
    }
  }
  
  /**
   * Format thoughts as a string for display
   */
  formatThoughtsAsString(thoughts: Thought[]): string {
    return thoughts.map(t => {
      const timestamp = t.timestamp.toISOString();
      return `[${timestamp}] [${t.type.toUpperCase()}] ${t.content}`;
    }).join('\n\n');
  }
  
  /**
   * Export all thoughts to a JSON file
   */
  exportThoughts(filePath?: string): boolean {
    try {
      const exportPath = filePath || path.join(
        this.outputPath, 
        `${this.agentId}_thoughts_export_${Date.now()}.json`
      );
      
      fs.writeFileSync(exportPath, JSON.stringify(this.thoughts, null, 2));
      return true;
    } catch (error) {
      console.error('Error exporting thoughts:', error);
      return false;
    }
  }
} 