/**
 * Visualization utilities
 * Provides helper functions for working with visualizations
 */
import { v4 as uuidv4 } from 'uuid';
import { VisualizationContext } from '../services/thinking/visualization/types';

/**
 * Generates a standardized request ID
 * 
 * @param prefix Optional prefix for the ID
 * @returns A unique request ID
 */
export function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${uuidv4()}`;
}

/**
 * Generates a standardized visualization context
 * 
 * @param params Required parameters for the context
 * @returns A visualization context object
 */
export function createVisualizationContext(params: {
  requestId?: string;
  chatId: string;
  messageId?: string;
  userId: string;
  agentId: string;
}): VisualizationContext {
  return {
    requestId: params.requestId || generateRequestId(),
    chatId: params.chatId,
    messageId: params.messageId,
    userId: params.userId,
    agentId: params.agentId
  };
}

/**
 * Checks if visualization is enabled from the configuration
 * 
 * @returns Promise resolving to a boolean indicating if visualization is enabled
 */
export async function isVisualizationEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/config/get?key=enableThinkingVisualization');
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.value === true;
  } catch (error) {
    console.error('Error checking visualization status:', error);
    return false;
  }
}

/**
 * Creates a child context from a parent context
 * 
 * @param parentContext The parent visualization context
 * @param currentNodeId The current node ID
 * @returns A new visualization context with updated node references
 */
export function createChildContext(
  parentContext: VisualizationContext,
  currentNodeId: string
): VisualizationContext {
  return {
    ...parentContext,
    parentNodeId: parentContext.currentNodeId,
    currentNodeId
  };
}

/**
 * Merges visualization options with default options
 * 
 * @param options User-provided visualization options
 * @returns Merged visualization options with defaults
 */
export function mergeVisualizationOptions(options?: {
  storeVisualization?: boolean;
  trackMemoryOperations?: boolean;
  trackToolExecution?: boolean;
  trackThinking?: boolean;
}): {
  storeVisualization: boolean;
  trackMemoryOperations: boolean;
  trackToolExecution: boolean;
  trackThinking: boolean;
} {
  const defaultOptions = {
    storeVisualization: true,
    trackMemoryOperations: true,
    trackToolExecution: true,
    trackThinking: true
  };
  
  return {
    ...defaultOptions,
    ...options
  };
}

/**
 * Determines if visualization should be enabled for a specific operation
 * 
 * @param options The visualization options
 * @param operationType The type of operation
 * @returns Whether visualization should be enabled
 */
export function shouldEnableVisualization(
  options?: {
    enableVisualization?: boolean;
    visualizationOptions?: {
      storeVisualization?: boolean;
      trackMemoryOperations?: boolean;
      trackToolExecution?: boolean;
      trackThinking?: boolean;
    }
  },
  operationType?: 'memory' | 'tool' | 'thinking' | 'general'
): boolean {
  if (!options || !options.enableVisualization) {
    return false;
  }
  
  // If no operation type specified, just check if visualization is enabled
  if (!operationType) {
    return options.enableVisualization === true;
  }
  
  // Check specific operation type if visualization options provided
  if (options.visualizationOptions) {
    switch (operationType) {
      case 'memory':
        return options.visualizationOptions.trackMemoryOperations !== false;
      case 'tool':
        return options.visualizationOptions.trackToolExecution !== false;
      case 'thinking':
        return options.visualizationOptions.trackThinking !== false;
      default:
        return true;
    }
  }
  
  // Default to enabled if visualization is enabled but no specific options
  return options.enableVisualization === true;
} 