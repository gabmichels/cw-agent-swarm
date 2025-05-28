/**
 * Analysis Component Interfaces
 * 
 * This file defines the interfaces for analysis components in the reflection system.
 * These interfaces support the PerformanceAnalyzer, KnowledgeGapAnalyzer, and ReflectionAnalyzer components.
 */

import { 
  ReflectionTrigger, 
  ReflectionInsight, 
  TimeRange, 
  TrendAnalysis, 
  Anomaly
} from './ReflectionInterfaces';
import { 
  Reflection,
  KnowledgeGap,
  PerformanceMetrics
} from '../../base/managers/ReflectionManager.interface';

// ============================================================================
// Performance Analysis Interfaces
// ============================================================================

export interface PerformanceAnalysisConfig {
  enableTrendAnalysis?: boolean;
  enableAnomalyDetection?: boolean;
  enableBenchmarking?: boolean;
  enableOptimizationSuggestions?: boolean;
  trendAnalysisWindow?: number; // days
  anomalyThreshold?: number; // standard deviations
  benchmarkUpdateInterval?: number; // hours
  maxOptimizationSuggestions?: number;
}

export interface PerformanceMetricsCollection {
  timestamp: Date;
  metrics: Record<string, number>;
  context: Record<string, unknown>;
  source: string;
}

export interface PerformanceAnalysisResult {
  summary: string;
  overallScore: number;
  trends: TrendAnalysis[];
  anomalies: Anomaly[];
  recommendations: OptimizationSuggestion[];
  benchmarks: PerformanceBenchmarks;
  analysisTimestamp: Date;
  confidence: number;
}

export interface OptimizationSuggestion {
  id: string;
  area: string;
  description: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
  implementationSteps: string[];
  estimatedTimeToImpact: number; // days
  confidence: number;
  category: 'performance' | 'quality' | 'efficiency' | 'reliability';
}

export interface PerformanceBenchmarks {
  baseline: Record<string, number>;
  targets: Record<string, number>;
  industry: Record<string, number>;
  historical: Record<string, number>;
  lastUpdated: Date;
  confidence: Record<string, number>;
}

export interface PerformanceComparison {
  timeRange: TimeRange;
  improvements: Record<string, number>;
  regressions: Record<string, number>;
  summary: string;
  overallScore: number;
  significantChanges: Array<{
    metric: string;
    change: number;
    significance: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export interface MetricsCollectionOptions {
  includeHistorical?: boolean;
  timeRange?: TimeRange;
  metrics?: string[];
  granularity?: 'minute' | 'hour' | 'day' | 'week';
  aggregation?: 'sum' | 'average' | 'min' | 'max' | 'count';
  filters?: Record<string, unknown>;
}

// ============================================================================
// Knowledge Gap Analysis Interfaces
// ============================================================================

export interface KnowledgeGapAnalysisConfig {
  enablePatternAnalysis?: boolean;
  enableImpactAssessment?: boolean;
  enableLearningPlanGeneration?: boolean;
  enableGapPrioritization?: boolean;
  maxGapsToAnalyze?: number;
  impactAssessmentDepth?: 'shallow' | 'standard' | 'deep';
  learningPlanComplexity?: 'basic' | 'intermediate' | 'advanced';
  prioritizationCriteria?: string[];
}

export interface GapIdentificationOptions {
  sources?: Array<'conversations' | 'documents' | 'tasks' | 'feedback' | 'reflections'>;
  timeRange?: TimeRange;
  maxGaps?: number;
  minConfidence?: number;
  categories?: string[];
  excludeResolved?: boolean;
}

export interface GapImpactAssessment {
  gapId: string;
  assessedAt: Date;
  impactLevel: number; // 1-10 scale
  affectedAreas: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  riskFactors: string[];
  dependencies: string[];
  confidence: number;
  methodology: string;
}

export interface GapClosureProgress {
  gapId: string;
  progress: number; // 0-100 percentage
  milestones: GapMilestone[];
  estimatedCompletion: Date;
  blockers: GapBlocker[];
  resources: GapResource[];
  lastUpdated: Date;
  confidence: number;
}

export interface GapMilestone {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  dueDate: Date;
  weight: number; // contribution to overall progress
  dependencies: string[];
}

export interface GapBlocker {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifiedAt: Date;
  category: string;
  suggestedResolution: string;
  estimatedResolutionTime: number; // days
}

export interface GapResource {
  type: 'document' | 'course' | 'practice' | 'mentoring' | 'tool' | 'expert';
  title: string;
  url?: string;
  estimatedTime: number; // hours
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  cost: number;
  availability: 'immediate' | 'scheduled' | 'on-demand';
  effectiveness: number; // 1-10 scale
}

export interface LearningPlan {
  gapId: string;
  createdAt: Date;
  objectives: LearningObjective[];
  resources: GapResource[];
  timeline: LearningTimeline;
  assessments: LearningAssessment[];
  prerequisites: string[];
  estimatedDuration: number; // hours
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  confidence: number;
}

export interface LearningObjective {
  id: string;
  description: string;
  priority: number;
  measurable: boolean;
  criteria: string[];
  estimatedTime: number; // hours
  dependencies: string[];
}

export interface LearningTimeline {
  startDate: Date;
  endDate: Date;
  phases: LearningPhase[];
  milestones: GapMilestone[];
  bufferTime: number; // percentage
}

export interface LearningPhase {
  id: string;
  name: string;
  duration: number; // hours
  objectives: string[];
  resources: string[];
  deliverables: string[];
  successCriteria: string[];
}

export interface LearningAssessment {
  id: string;
  type: 'quiz' | 'project' | 'peer_review' | 'self_assessment' | 'practical';
  description: string;
  criteria: AssessmentCriterion[];
  passingScore: number;
  weight: number; // contribution to overall assessment
  estimatedTime: number; // hours
}

export interface AssessmentCriterion {
  name: string;
  description: string;
  weight: number;
  rubric: RubricLevel[];
}

export interface RubricLevel {
  level: string;
  score: number;
  description: string;
  examples: string[];
}

export interface GapPatternAnalysis {
  analysisDate: Date;
  timeRange: TimeRange;
  commonGaps: GapPattern[];
  gapCategories: Record<string, number>;
  trends: TrendAnalysis[];
  correlations: GapCorrelation[];
  recommendations: string[];
  confidence: number;
}

export interface GapPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  significance: number;
  description: string;
  suggestedActions: string[];
}

export interface GapCorrelation {
  gap1: string;
  gap2: string;
  correlation: number;
  significance: number;
  description: string;
  implications: string[];
}

// ============================================================================
// Reflection Analysis Interfaces
// ============================================================================

export interface ReflectionAnalysisConfig {
  enableQualityAssessment?: boolean;
  enableInsightExtraction?: boolean;
  enablePatternRecognition?: boolean;
  enableEffectivenessMeasurement?: boolean;
  enableApplicationAnalysis?: boolean;
  qualityDimensions?: string[];
  insightExtractionDepth?: 'shallow' | 'standard' | 'deep';
  patternRecognitionSensitivity?: number;
  effectivenessMetrics?: string[];
  applicationTrackingPeriod?: number; // days
}

export interface QualityAssessment {
  reflectionId: string;
  assessedAt: Date;
  overallScore: number; // 1-10 scale
  dimensions: QualityDimension[];
  strengths: QualityStrength[];
  weaknesses: QualityWeakness[];
  suggestions: QualityImprovement[];
  confidence: number;
  methodology: string;
}

export interface QualityDimension {
  name: string;
  score: number; // 1-10 scale
  weight: number; // contribution to overall score
  description: string;
  criteria: string[];
  evidence: string[];
  improvementAreas: string[];
}

export interface QualityStrength {
  dimension: string;
  description: string;
  evidence: string[];
  impact: number; // 1-10 scale
  reinforcement: string[];
}

export interface QualityWeakness {
  dimension: string;
  description: string;
  evidence: string[];
  impact: number; // 1-10 scale
  suggestions: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface QualityImprovement {
  area: string;
  description: string;
  actionItems: string[];
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
  timeline: string;
}

export interface InsightExtractionResult {
  reflectionId: string;
  extractedAt: Date;
  insights: ExtractedInsight[];
  patterns: InsightPattern[];
  themes: InsightTheme[];
  confidence: number;
  methodology: string;
}

export interface ExtractedInsight {
  id: string;
  type: 'error' | 'learning' | 'pattern' | 'improvement' | 'warning' | 'opportunity';
  content: string;
  confidence: number;
  significance: number;
  category: string;
  tags: string[];
  evidence: string[];
  implications: string[];
  actionable: boolean;
  relatedInsights: string[];
}

export interface InsightPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  significance: number;
  description: string;
  category: string;
  trends: TrendAnalysis[];
}

export interface InsightTheme {
  theme: string;
  insights: string[];
  prevalence: number;
  significance: number;
  description: string;
  implications: string[];
  recommendations: string[];
}

export interface PatternRecognition {
  reflectionIds: string[];
  analysisDate: Date;
  patterns: ReflectionPattern[];
  confidence: number;
  insights: string[];
  recommendations: string[];
  methodology: string;
  timeRange: TimeRange;
}

export interface ReflectionPattern {
  id: string;
  type: 'temporal' | 'contextual' | 'behavioral' | 'outcome' | 'trigger';
  frequency: number;
  examples: PatternExample[];
  significance: number;
  description: string;
  implications: string[];
  predictive: boolean;
  confidence: number;
}

export interface PatternExample {
  reflectionId: string;
  timestamp: Date;
  context: Record<string, unknown>;
  evidence: string[];
  strength: number;
}

export interface EffectivenessMetrics {
  reflectionId: string;
  measuredAt: Date;
  timeRange: TimeRange;
  insightsGenerated: number;
  actionsCreated: number;
  actionsCompleted: number;
  impactScore: number; // 1-10 scale
  timeToImpact: number; // days
  qualityScore: number; // 1-10 scale
  applicationRate: number; // percentage
  successRate: number; // percentage
  efficiency: number; // insights per hour
  confidence: number;
}

export interface ApplicationAnalysis {
  insightId: string;
  analysisDate: Date;
  timeRange: TimeRange;
  applicationRate: number; // percentage
  successRate: number; // percentage
  timeToApplication: number; // days
  barriers: ApplicationBarrier[];
  facilitators: ApplicationFacilitator[];
  outcomes: ApplicationOutcome[];
  recommendations: string[];
  confidence: number;
}

export interface ApplicationBarrier {
  type: 'resource' | 'knowledge' | 'process' | 'cultural' | 'technical';
  description: string;
  frequency: number;
  impact: number; // 1-10 scale
  suggestedMitigation: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface ApplicationFacilitator {
  type: 'resource' | 'knowledge' | 'process' | 'cultural' | 'technical';
  description: string;
  frequency: number;
  impact: number; // 1-10 scale
  leverageOpportunities: string[];
  scalability: 'low' | 'medium' | 'high';
}

export interface ApplicationOutcome {
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  impact: number; // 1-10 scale
  measuredAt: Date;
  metrics: Record<string, number>;
  lessons: string[];
  reproducible: boolean;
}

// ============================================================================
// Common Analysis Types
// ============================================================================

export interface AnalysisError extends Error {
  code: string;
  context: Record<string, unknown>;
  recoverable: boolean;
  suggestions: string[];
}

export interface AnalysisResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AnalysisError;
  metadata: {
    analysisId: string;
    timestamp: Date;
    duration: number; // milliseconds
    confidence: number;
    methodology: string;
    version: string;
  };
}

export interface AnalysisConfiguration {
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTtl?: number; // milliseconds
  enableMetrics?: boolean;
  enableValidation?: boolean;
  maxConcurrentAnalyses?: number;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface AnalysisStats {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageDuration: number;
  cacheHitRate: number;
  activeAnalyses: number;
  lastAnalysisTime?: Date;
  errorDistribution: Record<string, number>;
} 