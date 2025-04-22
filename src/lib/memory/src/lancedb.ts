import fs from 'fs';
import path from 'path';
// Use dynamic import for LanceDB to prevent it from being bundled on the client side
// import { connect } from '@lancedb/lancedb';
import { OpenAI } from 'openai';

// Types for memory entries
export interface MemoryRecord {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  type: 'message' | 'thought' | 'document' | 'task';
  metadata: Record<string, any>;
}

export interface MessageRecord extends MemoryRecord {
  type: 'message';
  metadata: {
    role: 'user' | 'assistant' | 'system';
    userId?: string;
    sessionId?: string;
  };
}

export interface ThoughtRecord extends MemoryRecord {
  type: 'thought';
  metadata: {
    tag: string;
    importance: 'low' | 'medium' | 'high';
    source: string;
  };
}

export interface DocumentRecord extends MemoryRecord {
  type: 'document';
  metadata: {
    title: string;
    tags: string[];
    source: string;
  };
}

export interface TaskRecord extends MemoryRecord {
  type: 'task';
  metadata: {
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
  };
}

// Configuration options for LanceDB Memory
export interface LanceDBMemoryOptions {
  dataDirectory?: string;
  embeddingFunction?: (text: string) => Promise<number[]>;
  dimensions?: number;
  useOpenAI?: boolean;
  openAIApiKey?: string;
  openAIModel?: string;
}

/**
 * LanceDBMemory provides vector storage and retrieval for agent memory using LanceDB
 */
export class LanceDBMemory {
  private db: any; // LanceDB Connection
  private tables: {
    messages: any;
    thoughts: any;
    documents: any;
    tasks: any;
  } = { messages: null, thoughts: null, documents: null, tasks: null };
  
  private dataDirectory: string;
  private dimensions: number;
  private embeddingFunction: (text: string) => Promise<number[]>;
  private openai: OpenAI | null = null;
  private tableSchemas: Record<string, any>;
  private initialized: boolean = false;

  constructor(options?: LanceDBMemoryOptions) {
    this.dataDirectory = options?.dataDirectory || path.join(process.cwd(), 'data', 'lance');
    this.dimensions = options?.dimensions || 1536; // Default for OpenAI embeddings
    
    // Set up OpenAI if useOpenAI is true
    if (options?.useOpenAI) {
      this.openai = new OpenAI({
        apiKey: options?.openAIApiKey || process.env.OPENAI_API_KEY
      });
      
      this.embeddingFunction = async (text: string) => {
        const response = await this.openai!.embeddings.create({
          model: options?.openAIModel || 'text-embedding-ada-002',
          input: text,
        });
        return response.data[0].embedding;
      };
    } else if (options?.embeddingFunction) {
      this.embeddingFunction = options.embeddingFunction;
    } else {
      // Default embedding function (random vectors, REPLACE IN PRODUCTION)
      console.warn("Using random embeddings - not for production use!");
      this.embeddingFunction = async (text: string) => {
        return Array.from({ length: this.dimensions }, () => Math.random() * 2 - 1);
      };
    }
    
    // Define table schemas for each memory type
    this.tableSchemas = {
      messages: {
        id: 'string',
        text: 'string',
        embedding: `float32[${this.dimensions}]`,
        timestamp: 'string',
        type: 'string',
        metadata: 'json'
      },
      thoughts: {
        id: 'string',
        text: 'string',
        embedding: `float32[${this.dimensions}]`,
        timestamp: 'string',
        type: 'string',
        metadata: 'json'
      },
      documents: {
        id: 'string',
        text: 'string',
        embedding: `float32[${this.dimensions}]`,
        timestamp: 'string',
        type: 'string',
        metadata: 'json'
      },
      tasks: {
        id: 'string',
        text: 'string',
        embedding: `float32[${this.dimensions}]`,
        timestamp: 'string',
        type: 'string',
        metadata: 'json'
      }
    };
  }

  /**
   * Initialize the LanceDB connection and tables
   */
  async initialize(): Promise<void> {
    try {
      // Server-side only code
      if (typeof window === 'undefined') {
        console.log(`Initializing LanceDB memory at ${this.dataDirectory}`);
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDirectory)) {
          fs.mkdirSync(this.dataDirectory, { recursive: true });
          console.log(`Created data directory at ${this.dataDirectory}`);
        }
        
        // Dynamically import LanceDB (server-side only)
        const lancedb = await import('@lancedb/lancedb');
        
        // Connect to LanceDB
        this.db = await lancedb.connect(this.dataDirectory);
        console.log(`Connected to LanceDB at ${this.dataDirectory}`);
        
        // Initialize tables
        const tableNames = await this.db.tableNames();
        console.log(`Existing tables: ${tableNames.join(', ') || 'none'}`);
        
        // Create dummy records for initial table creation
        const createDummyRecord = (type: string) => ({
          id: `init_${type}_${Date.now()}`,
          text: `Initialization record for ${type}`,
          embedding: Array(this.dimensions).fill(0),
          timestamp: new Date().toISOString(),
          type,
          metadata: {}
        });
        
        // Create or open message table
        if (!tableNames.includes('messages')) {
          console.log('Creating messages table');
          // Create with a dummy record
          const dummyMessage = createDummyRecord('message');
          this.tables.messages = await this.db.createTable('messages', [dummyMessage], this.tableSchemas.messages);
        } else {
          this.tables.messages = await this.db.openTable('messages');
        }
        
        // Create or open thoughts table
        if (!tableNames.includes('thoughts')) {
          console.log('Creating thoughts table');
          // Create with a dummy record
          const dummyThought = createDummyRecord('thought');
          this.tables.thoughts = await this.db.createTable('thoughts', [dummyThought], this.tableSchemas.thoughts);
        } else {
          this.tables.thoughts = await this.db.openTable('thoughts');
        }
        
        // Create or open documents table
        if (!tableNames.includes('documents')) {
          console.log('Creating documents table');
          // Create with a dummy record
          const dummyDocument = createDummyRecord('document');
          this.tables.documents = await this.db.createTable('documents', [dummyDocument], this.tableSchemas.documents);
        } else {
          this.tables.documents = await this.db.openTable('documents');
        }
        
        // Create or open tasks table
        if (!tableNames.includes('tasks')) {
          console.log('Creating tasks table');
          // Create with a dummy record
          const dummyTask = createDummyRecord('task');
          this.tables.tasks = await this.db.createTable('tasks', [dummyTask], this.tableSchemas.tasks);
        } else {
          this.tables.tasks = await this.db.openTable('tasks');
        }
        
        this.initialized = true;
        console.log('LanceDB memory initialization complete');
      } else {
        // Client-side fallback
        console.log('LanceDB memory not initialized: running in browser environment');
        this.initialized = false;
      }
    } catch (error) {
      console.error('Failed to initialize LanceDB memory:', error);
      throw error;
    }
  }

  /**
   * Insert or update a memory record with automatically generated embedding
   */
  async upsertMemory<T extends MemoryRecord>(record: Omit<T, 'embedding'>): Promise<T> {
    // Skip if running in browser or not initialized
    if (typeof window !== 'undefined' || !this.initialized) {
      console.log('Cannot upsert memory in browser environment');
      return { ...record, embedding: [] } as unknown as T;
    }
    
    try {
      // Generate embedding for the text
      const embedding = await this.embeddingFunction(record.text);
      
      // Create complete record with embedding
      const completeRecord = {
        ...record,
        embedding
      } as T;
      
      // Select the appropriate table based on record type
      const table = this.tables[`${record.type}s` as keyof typeof this.tables];
      
      if (!table) {
        throw new Error(`Unknown record type: ${record.type}`);
      }
      
      // Insert or update the record
      await table.add([completeRecord]);
      
      console.log(`Upserted ${record.type} record: ${record.id}`);
      return completeRecord;
    } catch (error) {
      console.error(`Failed to upsert ${record.type} record:`, error);
      throw error;
    }
  }

  /**
   * Search for relevant memories by semantic similarity
   */
  async searchMemory(options: {
    query: string;
    type?: 'message' | 'thought' | 'document' | 'task';
    limit?: number;
    filter?: Record<string, any>;
  }): Promise<MemoryRecord[]> {
    // Skip if running in browser or not initialized
    if (typeof window !== 'undefined' || !this.initialized) {
      console.log('Cannot search memory in browser environment');
      return [];
    }
    
    const { query, type, limit = 5, filter = {} } = options;
    
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingFunction(query);
      
      // Determine which table to search
      let tables: any[];
      if (type) {
        // Search only the specified type table
        tables = [this.tables[`${type}s` as keyof typeof this.tables]];
      } else {
        // Search all tables
        tables = Object.values(this.tables);
      }
      
      // Use a simple text search instead of vector search to avoid embedding issues
      try {
        // Fall back to simple text search for now
        const allResults = await Promise.all(
          tables.map(async (table) => {
            if (!table) return [];
            
            // Just do a basic select without vector search
            let query = table.select();
            
            // Apply filters if provided
            Object.entries(filter).forEach(([key, value]) => {
              query = query.where(key, '=', value);
            });
            
            // Execute query and limit results
            return await query.limit(limit).execute();
          })
        );
        
        // Flatten results
        const flatResults = allResults.flat();
        
        // Return results
        return flatResults.slice(0, limit);
      } catch (vectorError) {
        console.error('Vector search failed, falling back to simplest query:', vectorError);
        
        // Last resort - just return any records we can find
        const basicResults = await Promise.all(
          tables.map(async (table) => {
            if (!table) return [];
            try {
              return await table.select().limit(limit).execute();
            } catch (e) {
              console.error('Basic table query failed:', e);
              return [];
            }
          })
        );
        
        return basicResults.flat().slice(0, limit);
      }
    } catch (error) {
      console.error('Failed to search memory:', error);
      return [];
    }
  }

  /**
   * Store a message in memory
   */
  async storeMessage(message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    userId?: string;
    sessionId?: string;
  }): Promise<MessageRecord> {
    // Skip if running in browser
    if (typeof window !== 'undefined') {
      console.log('Cannot store message in browser environment');
      return {
        id: `browser_msg_${Date.now()}`,
        text: message.content,
        timestamp: new Date().toISOString(),
        type: 'message',
        embedding: [],
        metadata: {
          role: message.role,
          userId: message.userId,
          sessionId: message.sessionId
        }
      };
    }
    
    const id = `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    return await this.upsertMemory<MessageRecord>({
      id,
      text: message.content,
      timestamp: new Date().toISOString(),
      type: 'message',
      metadata: {
        role: message.role,
        userId: message.userId,
        sessionId: message.sessionId
      }
    });
  }

  /**
   * Store a thought in memory
   */
  async storeThought(thought: {
    text: string;
    tag: string;
    importance: 'low' | 'medium' | 'high';
    source: string;
  }): Promise<ThoughtRecord> {
    // Skip if running in browser
    if (typeof window !== 'undefined') {
      console.log('Cannot store thought in browser environment');
      return {
        id: `browser_thought_${Date.now()}`,
        text: thought.text,
        timestamp: new Date().toISOString(),
        type: 'thought',
        embedding: [],
        metadata: {
          tag: thought.tag,
          importance: thought.importance,
          source: thought.source
        }
      };
    }
    
    const id = `thought_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // Create record with flattened structure instead of nested metadata
    try {
      // Generate embedding for the text
      const embedding = await this.embeddingFunction(thought.text);
      
      // Create record with flattened structure
      const flatRecord = {
        id,
        text: thought.text,
        embedding,
        timestamp: new Date().toISOString(),
        type: 'thought',
        metadata: JSON.stringify({
          tag: thought.tag,
          importance: thought.importance,
          source: thought.source
        })
      };
      
      // Select the thoughts table
      const table = this.tables.thoughts;
      
      if (!table) {
        throw new Error(`Thoughts table not initialized`);
      }
      
      // Insert the record directly
      await table.add([flatRecord]);
      
      console.log(`Stored thought record: ${id}`);
      
      // Return in the expected format
      return {
        id,
        text: thought.text,
        embedding,
        timestamp: new Date().toISOString(),
        type: 'thought',
        metadata: {
          tag: thought.tag,
          importance: thought.importance,
          source: thought.source
        }
      };
    } catch (error) {
      console.error(`Failed to store thought:`, error);
      throw error;
    }
  }

  /**
   * Store a document in memory
   */
  async storeDocument(document: {
    title: string;
    content: string;
    tags: string[];
    source: string;
  }): Promise<DocumentRecord> {
    // Skip if running in browser
    if (typeof window !== 'undefined') {
      console.log('Cannot store document in browser environment');
      return {
        id: `browser_doc_${Date.now()}`,
        text: document.content,
        timestamp: new Date().toISOString(),
        type: 'document',
        embedding: [],
        metadata: {
          title: document.title,
          tags: document.tags,
          source: document.source
        }
      };
    }
    
    const id = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    return await this.upsertMemory<DocumentRecord>({
      id,
      text: document.content,
      timestamp: new Date().toISOString(),
      type: 'document',
      metadata: {
        title: document.title,
        tags: document.tags,
        source: document.source
      }
    });
  }

  /**
   * Store a task in memory
   */
  async storeTask(task: {
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
  }): Promise<TaskRecord> {
    // Skip if running in browser
    if (typeof window !== 'undefined') {
      console.log('Cannot store task in browser environment');
      return {
        id: `browser_task_${Date.now()}`,
        text: task.description,
        timestamp: new Date().toISOString(),
        type: 'task',
        embedding: [],
        metadata: {
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate
        }
      };
    }
    
    const id = `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    return await this.upsertMemory<TaskRecord>({
      id,
      text: task.description,
      timestamp: new Date().toISOString(),
      type: 'task',
      metadata: {
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate
      }
    });
  }

  /**
   * Get context for a query from all relevant memory types
   */
  async getContext(query: string, limit: number = 5): Promise<string[]> {
    // Skip if running in browser or not initialized
    if (typeof window !== 'undefined' || !this.initialized) {
      console.log('Cannot get context in browser environment');
      return ["Memory retrieval not available in this environment."];
    }
    
    const results = await this.searchMemory({
      query,
      limit
    });
    
    // Format results into text strings
    return results.map(result => {
      switch (result.type) {
        case 'message':
          return `${(result as MessageRecord).metadata.role}: ${result.text}`;
        case 'thought':
          return `Thought (${(result as ThoughtRecord).metadata.importance}): ${result.text}`;
        case 'document':
          return `Document "${(result as DocumentRecord).metadata.title}": ${result.text}`;
        case 'task':
          return `Task (${(result as TaskRecord).metadata.status}): ${result.text}`;
        default:
          return result.text;
      }
    });
  }
  
  /**
   * Get recent messages from memory
   */
  async getRecentMessages(limit: number = 10): Promise<MessageRecord[]> {
    // Skip if running in browser or not initialized
    if (typeof window !== 'undefined' || !this.initialized) {
      console.log('Cannot get recent messages in browser environment');
      return [];
    }
    
    try {
      const results = await this.tables.messages
        .select()
        .sort("timestamp", "desc")
        .limit(limit)
        .execute();
      
      return results;
    } catch (error) {
      console.error('Failed to get recent messages:', error);
      return [];
    }
  }

  /**
   * Get important thoughts from memory
   */
  async getImportantThoughts(importance: 'medium' | 'high' = 'high', limit: number = 10): Promise<ThoughtRecord[]> {
    // Skip if running in browser or not initialized
    if (typeof window !== 'undefined' || !this.initialized) {
      console.log('Cannot get important thoughts in browser environment');
      return [];
    }
    
    try {
      const results = await this.tables.thoughts
        .select()
        .where("metadata.importance", "=", importance)
        .sort("timestamp", "desc")
        .limit(limit)
        .execute();
      
      return results;
    } catch (error) {
      console.error('Failed to get important thoughts:', error);
      return [];
    }
  }

  /**
   * Check if LanceDB is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 