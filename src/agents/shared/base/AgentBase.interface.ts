import type { AgentStatus, AgentBaseConfig, AgentCapability } from './types';
import type { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import type { ManagersConfig } from './ManagersConfig.interface';
import type { BaseManager } from './managers/BaseManager';
import type { MemoryManager } from './managers/MemoryManager';
import type { PlanningManager, PlanCreationOptions, PlanCreationResult, Plan, PlanExecutionResult } from '../../../lib/agents/base/managers/PlanningManager';

export interface AgentBase {
  getAgentId(): string;
  getName(): string;
  getConfig(): AgentBaseConfig;
  updateConfig(config: Partial<AgentBaseConfig>): void;
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  registerManager<T extends MemoryManager | PlanningManager>(manager: T): T;
  getManager<T extends MemoryManager | PlanningManager>(managerType: string): T | undefined;
  getManagers(): BaseManager[];
  isEnabled(): boolean;
  setEnabled(enabled: boolean): boolean;
  hasCapability(capabilityId: string): boolean;
  enableCapability(capability: AgentCapability): void;
  disableCapability(capabilityId: string): void;
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    managerHealth?: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }>;
  }>;
  getSchedulerManager(): DefaultSchedulerManager | undefined;
  initializeManagers(): Promise<void>;
  shutdownManagers(): Promise<void>;
  addMemory(content: string, metadata: Record<string, unknown>): Promise<unknown>;
  searchMemories(query: string, options: Record<string, unknown>): Promise<unknown[]>;
  getRecentMemories(limit: number): Promise<unknown[]>;
  consolidateMemories(): Promise<void>;
  pruneMemories(): Promise<void>;
  createPlan(options: PlanCreationOptions): Promise<PlanCreationResult>;
  getPlan(planId: string): Promise<Plan | null>;
  getAllPlans(): Promise<Plan[]>;
  updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null>;
  deletePlan(planId: string): Promise<boolean>;
  executePlan(planId: string): Promise<PlanExecutionResult>;
  adaptPlan(planId: string, reason: string): Promise<Plan | null>;
  validatePlan(planId: string): Promise<boolean>;
  optimizePlan(planId: string): Promise<Plan | null>;
} 