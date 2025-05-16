/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

/**
 * Base tool interface
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  parameters: Record<string, ToolParameter>;
  returns: string;
  version: string;
  author: string;
  tags: string[];
  requiredCapabilities?: string[];
  categories?: string[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastUsed?: string;
    usageCount: number;
    averageExecutionTime: number;
    successRate: number;
  };
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  toolId: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
  metadata: {
    toolId: string;
    startTime: string;
    endTime: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool discovery options
 */
export interface ToolDiscoveryOptions {
  capabilities?: string[];
  categories?: string[];
  query?: string;
  limit?: number;
  intent?: string;
  requiredCapabilities?: string[];
}

/**
 * Tool feedback
 */
export interface ToolFeedback {
  toolId: string;
  userId: string;
  rating: number;
  comment?: string;
  timestamp: string;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolId: string;
  totalUses: number;
  successRate: number;
  averageExecutionTime: number;
  lastUsed: string;
  userRating: number;
}

/**
 * Tool service interface
 */
export interface IToolService {
  registerTool(tool: Omit<Tool, 'id'>): Promise<string>;
  getAllTools(): Promise<Tool[]>;
  executeTool(options: ToolExecutionOptions): Promise<ToolExecutionResult>;
} 