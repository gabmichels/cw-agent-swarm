import { PlanWithSteps, PlanStep as BasePlanStep } from './agentTypes';
import { TaskStatus } from '../../../constants/task';
import { PlanAdaptationType, PlanAdaptationReason } from './planning';

// Re-export the base TaskStatus to maintain compatibility
export { TaskStatus };

// Update BasePlanStep to include additional properties
export interface PlanStep extends BasePlanStep {
  type: string;
  parameters: Record<string, unknown>;
  estimatedTime?: number;
  priority?: number;
}

// Extended plan step type definition
export interface ExtendedPlanStep extends PlanStep {
  status: TaskStatus;
  dependencies: string[];
  retryCount?: number;
  validationRules?: string[];
  fallbackOptions?: PlanStep[];
  error?: any;
}

export interface PlanAdaptationMetrics {
  originalStepCount: number;
  newStepCount: number;
  estimatedTimeChange: number;
  confidence: number;
}

export interface PlanOptimizationMetrics {
  optimizationTime: number;
  stepCount: number;
  estimatedTotalTime: number;
  estimatedResourceUsage: number;
  reliabilityScore: number;
}

export interface ResourceProfile {
  memory: number;
  cpu: number;
  io: number;
  concurrency: number;
}

export interface OptimizationGoal {
  type: 'TIME' | 'EFFICIENCY' | 'RESOURCE' | 'RELIABILITY';
  targetTime?: number;
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxConcurrentSteps?: number;
  };
}

export interface PriorityChange {
  stepId: string;
  priority: number;
}

export interface ResourceConstraints {
  memoryAvailable?: number;
  cpuAvailable?: number;
  timeRemaining?: number;
}

export interface NewInformation {
  source: string;
  content: any;
}

export interface AdaptationContext {
  failedStepId?: string;
  resourceConstraints?: ResourceConstraints;
  newInformation?: NewInformation;
  priorityChanges?: PriorityChange[];
}

export interface AdaptationStrategy {
  changes: Array<{
    type: PlanAdaptationType;
    description: string;
    affectedSteps: string[];
    reason: string;
  }>;
  metrics?: {
    timeChange: number;
    resourceChange: number;
    reliabilityChange: number;
  };
}

export interface OptimizationResult {
  steps: ExtendedPlanStep[];
  improvements: Array<{
    type: OptimizationGoal['type'];
    before: number;
    after: number;
    improvement: number;
    confidence: number;
  }>;
}

export interface ValidationRule {
  type: string;
  rule: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationIssue {
  type: string;
  rule: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedSteps: string[];
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxIo: number;
}

export interface StepGroup {
  steps: ExtendedPlanStep[];
  resourceType: string;
}

export interface StepMetrics {
  time: number;
  memory: number;
  cpu: number;
  io: number;
  reliability: number;
}

export interface StepOptimizationResult {
  step: ExtendedPlanStep;
  metrics: StepMetrics;
  improvements: {
    time?: number;
    memory?: number;
    cpu?: number;
    reliability?: number;
  };
}

export interface PlanOptimizationContext {
  originalPlan: PlanWithSteps;
  goals: OptimizationGoal[];
  constraints?: {
    maxTime?: number;
    maxMemory?: number;
    maxCpu?: number;
    minReliability?: number;
  };
}

export interface PlanAdaptationContext {
  originalPlan: PlanWithSteps;
  reason: PlanAdaptationReason;
  context: AdaptationContext;
  constraints?: {
    maxChanges?: number;
    preserveDependencies?: boolean;
    maintainOrder?: boolean;
  };
} 