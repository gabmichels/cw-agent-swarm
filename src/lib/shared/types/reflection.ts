/**
 * Types for reflection and self-improvement capabilities
 */

/**
 * Reflection types enumeration
 */
export enum ReflectionType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  IMPROVEMENT = 'improvement',
  TREND = 'trend',
  PATTERN = 'pattern',
  STRATEGY = 'strategy',
  PERFORMANCE = 'performance',
  CAUSAL = 'causal'
}

/**
 * Reflection outcome enumeration
 */
export enum ReflectionOutcome {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  MIXED = 'mixed',
  NEUTRAL = 'neutral'
}

/**
 * Base interface for a reflection entry
 */
export interface Reflection {
  id: string;
  content: string;
  type: ReflectionType;
  timestamp: Date;
  relatedTasks?: string[];
  relatedGoals?: string[];
  outcome?: ReflectionOutcome;
  confidence: number; // 0-1 scale
  metadata?: Record<string, unknown>;
}

/**
 * Interface for a performance reflection
 */
export interface PerformanceReflection extends Reflection {
  type: ReflectionType.PERFORMANCE;
  metrics: {
    successes: number;
    failures: number;
    timeframe: {
      start: Date;
      end: Date;
    };
    efficiency?: number; // 0-1 scale
    effectiveness?: number; // 0-1 scale
  };
  insights: string[];
  actionItems?: string[];
}

/**
 * Interface for improvement suggestion reflection
 */
export interface ImprovementReflection extends Reflection {
  type: ReflectionType.IMPROVEMENT;
  currentApproach: string;
  suggestedApproach: string;
  benefits: string[];
  risks?: string[];
  implementationSteps?: string[];
  priority: 'low' | 'medium' | 'high';
}

/**
 * Interface for failure analysis reflection
 */
export interface FailureReflection extends Reflection {
  type: ReflectionType.FAILURE;
  failureCause: string;
  impactDescription: string;
  lessonLearned: string;
  preventionStrategy?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Interface for success analysis reflection
 */
export interface SuccessReflection extends Reflection {
  type: ReflectionType.SUCCESS;
  successFactors: string[];
  repeatableElements: string[];
  limitingConditions?: string[];
  applicableContexts?: string[];
}

/**
 * Interface for pattern recognition reflection
 */
export interface PatternReflection extends Reflection {
  type: ReflectionType.PATTERN;
  pattern: string;
  observedInstances: number;
  significance: number; // 0-1 scale
  implications: string[];
  applicationDomains?: string[];
}

/**
 * Interface for strategic insight reflection
 */
export interface StrategyReflection extends Reflection {
  type: ReflectionType.STRATEGY;
  strategyName: string;
  targetOutcome: string;
  rationale: string;
  requiredResources?: string[];
  implementation: {
    approach: string;
    timeline: string;
    checkpoints: string[];
  };
  alternativeStrategies?: string[];
}

/**
 * Interface for causal relationship reflection
 */
export interface CausalReflection extends Reflection {
  type: ReflectionType.CAUSAL;
  // Identifiers for the cause and effect memories
  causeMemoryId: string;
  effectMemoryId: string;
  // Descriptive information about the relationship
  relationshipType: string; // direct, contributing, correlated, sequential
  description: string;
  supportingEvidence: string[];
  confidenceScore: number; // 0-1 scale
  // Timeline information
  timeframe: {
    causeDatetime: Date;
    effectDatetime: Date;
    lagTime?: string; // Time between cause and effect (e.g., "3 days", "2 hours")
  };
  // Actionable information
  applicability: string[]; // Contexts where this causal relationship applies
  recommendations?: string[]; // Recommendations based on this causal insight
}

/**
 * Type guard for PerformanceReflection
 */
export function isPerformanceReflection(reflection: Reflection): reflection is PerformanceReflection {
  return reflection.type === ReflectionType.PERFORMANCE && 'metrics' in reflection;
}

/**
 * Type guard for ImprovementReflection
 */
export function isImprovementReflection(reflection: Reflection): reflection is ImprovementReflection {
  return reflection.type === ReflectionType.IMPROVEMENT && 'suggestedApproach' in reflection;
}

/**
 * Type guard for FailureReflection
 */
export function isFailureReflection(reflection: Reflection): reflection is FailureReflection {
  return reflection.type === ReflectionType.FAILURE && 'failureCause' in reflection;
}

/**
 * Type guard for SuccessReflection
 */
export function isSuccessReflection(reflection: Reflection): reflection is SuccessReflection {
  return reflection.type === ReflectionType.SUCCESS && 'successFactors' in reflection;
}

/**
 * Type guard for PatternReflection
 */
export function isPatternReflection(reflection: Reflection): reflection is PatternReflection {
  return reflection.type === ReflectionType.PATTERN && 'pattern' in reflection;
}

/**
 * Type guard for StrategyReflection
 */
export function isStrategyReflection(reflection: Reflection): reflection is StrategyReflection {
  return reflection.type === ReflectionType.STRATEGY && 'strategyName' in reflection;
}

/**
 * Type guard for CausalReflection
 */
export function isCausalReflection(reflection: Reflection): reflection is CausalReflection {
  return reflection.type === ReflectionType.CAUSAL && 'causeMemoryId' in reflection && 'effectMemoryId' in reflection;
} 