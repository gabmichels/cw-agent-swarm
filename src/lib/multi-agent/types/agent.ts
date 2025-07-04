import { ulid } from 'ulid';
import type { AgentManagersConfig } from '../../../components/agent/ManagerConfigPanel';

/**
 * Agent capability definition
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  version?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Agent parameters for configuration
 */
export interface AgentParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  systemPrompt?: string;
  managersConfig?: AgentManagersConfig;
  autonomous?: boolean;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  taskCompletionRate: number;
}

/**
 * Agent metadata for additional information
 */
export interface AgentMetadata {
  tags: string[];
  domain: string[];
  specialization: string[];
  performanceMetrics: AgentPerformanceMetrics;
  version: string;
  isPublic: boolean;
  knowledgePaths?: string[];
  chatId?: string; // Optional chat ID stored in metadata
  persona?: {
    background: string;
    personality: string;
    communicationStyle: string;
    preferences: string;
  };
}

/**
 * Complete agent profile data structure
 */
export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  capabilities: AgentCapability[];
  parameters: AgentParameters;
  metadata: AgentMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastActivity?: Date; // Last activity timestamp from chat sessions
  chatId?: string; // Optional chat ID for direct navigation
}

/**
 * Request payload for agent registration
 */
export interface AgentRegistrationRequest {
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  capabilities: AgentCapability[];
  parameters: AgentParameters;
  metadata: AgentMetadata;
}

/**
 * Response from agent registration
 */
export interface AgentRegistrationResponse {
  success: boolean;
  message: string;
  agent?: AgentProfile;
  error?: string;
}

/**
 * Agent lookup parameters
 */
export interface AgentLookupParams {
  id?: string;
  name?: string;
  tags?: string[];
  domain?: string;
  status?: 'available' | 'unavailable' | 'maintenance';
}

/**
 * Agent search result
 */
export interface AgentSearchResult {
  agents: AgentProfile[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Generates a structured ID for an agent
 */
export function generateAgentId(name: string): string {
  return `agent_${name.toLowerCase().replace(/\s+/g, '_')}_${ulid()}`;
} 