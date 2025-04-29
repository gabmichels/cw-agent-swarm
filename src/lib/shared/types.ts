import { z } from 'zod';

/**
 * Shared types for the application
 */

// Shared type for agent configurations
export interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  name?: string;
  description?: string;
  capabilities?: string[];
  verbose?: boolean;
}

// Schema for agent configurations
export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  capabilities: z.array(z.string()),
  model: z.string().default('openrouter/anthropic/claude-3-opus:2024-05-01'),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().min(100).max(100000).default(4000),
});

// Message types for agent communication
export type MessageRole = 'system' | 'assistant' | 'user' | 'function';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  id?: string;
  text?: string;
}

// Task interface for agent tasks
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  result?: string;
  error?: string;
}

// Memory reference type
export interface MemoryReference {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Tool result interface
export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface MemoryDocument {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: string;
    createdAt: Date;
  };
}

export interface AgentResponse {
  message: string;
  thought?: string;
  sources?: string[];
} 