import { PlanStep } from '../../../lib/shared/types/agentTypes';

export interface ResourceProfile {
  memory: number;
  cpu: number;
  io: number;
  concurrency: number;
}

export function analyzeResourceProfile(step: PlanStep): ResourceProfile {
  return {
    memory: estimateMemoryUsage(step),
    cpu: estimateCpuUsage(step),
    io: estimateIoUsage(step),
    concurrency: estimateConcurrency(step)
  };
}

function estimateMemoryUsage(step: PlanStep): number {
  const baseMemory = 50 * 1024 * 1024; // 50MB base
  const parameterSize = JSON.stringify(step.params || {}).length;
  return baseMemory + parameterSize;
}

function estimateCpuUsage(step: PlanStep): number {
  return 0.1; // 10% CPU usage estimate
}

function estimateIoUsage(step: PlanStep): number {
  return 0.05; // 5% IO usage estimate
}

function estimateConcurrency(step: PlanStep): number {
  return 1; // Default to sequential execution
} 