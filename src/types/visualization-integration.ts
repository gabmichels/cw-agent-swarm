import { ulid } from 'ulid';
import { ThinkingVisualization } from '../services/thinking/visualization/types';

/**
 * Structured ID for visualization requests
 */
export interface VisualizationRequestId {
  readonly id: string;
  readonly prefix: string;
  readonly timestamp: Date;
  toString(): string;
}

/**
 * Context passed through the agent processing pipeline for visualization tracking
 */
export interface AgentVisualizationContext {
  readonly requestId: VisualizationRequestId;
  readonly userId: string;
  readonly agentId: string;
  readonly chatId: string;
  readonly messageId?: string;
  readonly userMessage: string;
  readonly visualization: ThinkingVisualization;
  readonly startTime: number;
}

/**
 * Interface for visualization-aware processing components
 */
export interface VisualizationAware {
  /**
   * Creates visualization nodes during processing
   */
  createVisualizationNodes(context: AgentVisualizationContext): Promise<void>;
}

/**
 * Configuration for visualization tracking
 */
export interface VisualizationConfig {
  readonly enabled: boolean;
  readonly trackMemoryRetrieval: boolean;
  readonly trackLLMInteraction: boolean;
  readonly trackToolExecution: boolean;
  readonly trackTaskCreation: boolean;
  readonly includePerformanceMetrics: boolean;
  readonly includeContextData: boolean;
}

/**
 * Memory retrieval visualization data
 */
export interface MemoryRetrievalVisualizationData {
  readonly query: string;
  readonly retrievedCount: number;
  readonly memoryTypes: string[];
  readonly relevanceScores: number[];
  readonly contextWindowUsage: {
    readonly used: number;
    readonly available: number;
    readonly percentage: number;
  };
}

/**
 * LLM interaction visualization data
 */
export interface LLMInteractionVisualizationData {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly systemPromptLength: number;
  readonly contextLength: number;
  readonly userMessageLength: number;
}

/**
 * Tool execution visualization data
 */
export interface ToolExecutionVisualizationData {
  readonly toolName: string;
  readonly executionTimeMs: number;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly inputParameters: Record<string, unknown>;
  readonly outputSize: number;
}

/**
 * Task creation visualization data
 */
export interface TaskCreationVisualizationData {
  readonly taskId: string;
  readonly taskType: string;
  readonly priority: number;
  readonly scheduledTime?: Date;
  readonly estimatedDuration?: number;
  readonly requiredCapabilities: string[];
}

/**
 * Factory for creating visualization request IDs
 */
export class VisualizationRequestIdFactory {
  private static readonly PREFIX = 'viz_req';

  /**
   * Generates a new visualization request ID using ULID
   */
  static generate(): VisualizationRequestId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    
    return {
      id,
      prefix: this.PREFIX,
      timestamp,
      toString: () => `${this.PREFIX}_${id}`
    };
  }

  /**
   * Parses a visualization request ID from string format
   */
  static parse(idString: string): VisualizationRequestId {
    const parts = idString.split('_');
    if (parts.length !== 3 || parts[0] !== this.PREFIX) {
      throw new Error(`Invalid visualization request ID format: ${idString}`);
    }

    const [prefix, , id] = parts;
    // Extract timestamp from ULID
    const timestamp = new Date(parseInt(id.substring(0, 10), 36));

    return {
      id,
      prefix,
      timestamp,
      toString: () => idString
    };
  }
}

/**
 * Error class for visualization-related errors
 */
export class VisualizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'VisualizationError';
  }
}

/**
 * Default visualization configuration
 */
export const DEFAULT_VISUALIZATION_CONFIG: VisualizationConfig = {
  enabled: true,
  trackMemoryRetrieval: true,
  trackLLMInteraction: true,
  trackToolExecution: true,
  trackTaskCreation: true,
  includePerformanceMetrics: true,
  includeContextData: true
} as const; 