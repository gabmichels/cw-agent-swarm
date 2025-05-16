import { 
  ThinkingResult, 
  ThinkingOptions, 
  WorkingMemoryItem 
} from './types';

/**
 * Service for handling the agent's thinking process
 * This service is responsible for analyzing user requests, understanding intent,
 * and determining the best way to respond.
 */
export interface IThinkingService {
  /**
   * Analyze user intent and extract key information
   * @param message The user's message
   * @param options Additional options for analysis
   * @returns Analysis results
   */
  analyzeIntent(
    message: string, 
    options?: ThinkingOptions
  ): Promise<ThinkingResult>;
  
  /**
   * Determine if a task should be delegated to another agent
   * @param thinkingResult The thinking result to evaluate
   * @returns Delegation decision with confidence and reason
   */
  shouldDelegate(
    thinkingResult: ThinkingResult
  ): Promise<{
    delegate: boolean;
    requiredCapabilities?: string[];
    confidence: number;
    reason: string;
  }>;
  
  /**
   * Update working memory based on thinking results
   * @param userId The user ID
   * @param thinkingResult The thinking results to store
   */
  updateWorkingMemory(
    userId: string,
    thinkingResult: ThinkingResult
  ): Promise<void>;
  
  /**
   * Create execution plan for the request
   * @param intent The identified intent
   * @param entities Extracted entities
   * @param context Additional context information
   * @returns Execution plan with steps and required tools
   */
  createExecutionPlan(
    intent: string,
    entities: Array<{type: string, value: string, confidence: number}>,
    context: any
  ): Promise<{
    steps: string[];
    tools: string[];
    reasoning: string;
  }>;
  
  /**
   * Execute the complete thinking process on a request
   * @param userId The user ID
   * @param message The user's message
   * @param options Additional options for processing
   * @returns Complete thinking results
   */
  processRequest(
    userId: string,
    message: string,
    options?: ThinkingOptions
  ): Promise<ThinkingResult>;
  
  /**
   * Retrieve working memory for a user
   * @param userId The user ID
   * @returns Working memory items
   */
  getWorkingMemory(userId: string): Promise<WorkingMemoryItem[]>;
  
  /**
   * Store an item in working memory
   * @param userId The user ID
   * @param item The memory item to store
   * @returns ID of the stored item
   */
  storeWorkingMemoryItem(userId: string, item: Omit<WorkingMemoryItem, 'id'>): Promise<string>;
} 