/**
 * Reflection System Component Interfaces
 * 
 * This file defines the interfaces for all reflection system components
 * that will be used to break down the monolithic DefaultReflectionManager.
 */

import { ReflectionTrigger as BaseReflectionTrigger, Reflection, KnowledgeGap, PerformanceMetrics, ReflectionStrategy as BaseReflectionStrategy } from '../../base/managers/ReflectionManager.interface';

// ============================================================================
// Core Data Types
// ============================================================================

// Re-export and extend base types
export type ReflectionTrigger = 'error' | 'task_completion' | 'learning_opportunity' | 'performance_issue' | 'user_feedback';

// Extended ReflectionStrategy interface for strategy management
export interface ReflectionStrategy {
  id: string;
  name: string;
  description: string;
  trigger: ReflectionTrigger;
  priority?: number;
  enabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
  implementation: (context: ExecutionContext) => Promise<ExecutionResult>;
}

export interface ReflectionInsightMetadata extends Record<string, unknown> {
  source: string;
  applicationStatus: 'pending' | 'applied' | 'rejected';
  category: 'error_handling' | 'knowledge_gap' | 'improvement' | 'tool' | 'general';
  relatedInsights: string[];
  appliedAt?: Date;
}

export interface ReflectionInsight {
  id: string;
  type: 'error' | 'learning' | 'pattern' | 'improvement' | 'warning';
  content: string;
  timestamp: Date;
  reflectionId: string;
  confidence: number;
  metadata: ReflectionInsightMetadata;
}

export interface ImprovementAction {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  sourceInsightId: string;
  status: 'suggested' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetArea: 'tools' | 'planning' | 'learning' | 'knowledge' | 'execution' | 'interaction';
  expectedImpact: number;
  difficulty: number;
  implementationSteps: Array<{
    description: string;
    status: 'pending' | 'completed' | 'failed';
  }>;
}

export interface ErrorRecoveryEntry {
  taskId: string;
  errorCategory: string;
  reflectionId: string;
  insights: string[];
  timestamp: Date;
  recoverySuccessful: boolean;
}

// ============================================================================
// Action Management Interfaces
// ============================================================================

export interface ImprovementActionManager {
  createAction(action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImprovementAction>;
  getAction(actionId: string): Promise<ImprovementAction | null>;
  updateAction(actionId: string, updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ImprovementAction>;
  listActions(options?: ActionListOptions): Promise<ImprovementAction[]>;
  deleteAction(actionId: string): Promise<boolean>;
  executeAction(actionId: string): Promise<boolean>;
  getActionsByStatus(status: ImprovementAction['status']): Promise<ImprovementAction[]>;
  getActionsByPriority(priority: ImprovementAction['priority']): Promise<ImprovementAction[]>;
}

export interface ActionListOptions {
  status?: ImprovementAction['status'][];
  targetArea?: ImprovementAction['targetArea'][];
  priority?: ImprovementAction['priority'][];
  minExpectedImpact?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'expectedImpact' | 'difficulty';
  sortDirection?: 'asc' | 'desc';
}

export interface ActionValidator {
  validateAction(action: Partial<ImprovementAction>): Promise<ValidationResult>;
  validateActionUpdate(updates: Partial<ImprovementAction>): Promise<ValidationResult>;
  checkBusinessRules(action: ImprovementAction): Promise<ValidationResult>;
  validateImplementationSteps(steps: ImprovementAction['implementationSteps']): Promise<ValidationResult>;
}

export interface ActionProcessor {
  processAction(action: ImprovementAction): Promise<ActionProcessingResult>;
  trackProgress(actionId: string): Promise<ActionProgress>;
  assessImpact(actionId: string): Promise<ImpactAssessment>;
  generateReport(actionId: string): Promise<ActionReport>;
}

// ============================================================================
// Strategy Management Interfaces
// ============================================================================

export interface ReflectionStrategyManager {
  registerStrategy(strategy: Omit<ReflectionStrategy, 'id'>): Promise<ReflectionStrategy>;
  getStrategy(strategyId: string): Promise<ReflectionStrategy | null>;
  updateStrategy(strategyId: string, updates: Partial<Omit<ReflectionStrategy, 'id'>>): Promise<ReflectionStrategy>;
  listStrategies(options?: StrategyListOptions): Promise<ReflectionStrategy[]>;
  setStrategyEnabled(strategyId: string, enabled: boolean): Promise<ReflectionStrategy>;
  selectStrategy(trigger: ReflectionTrigger, context: Record<string, unknown>): Promise<ReflectionStrategy | null>;
  evaluateStrategyPerformance(strategyId: string): Promise<StrategyPerformance>;
}

export interface StrategyListOptions {
  trigger?: ReflectionTrigger[];
  enabled?: boolean;
  sortBy?: 'priority' | 'name';
  sortDirection?: 'asc' | 'desc';
}

export interface StrategyRegistry {
  registerStrategy(strategy: ReflectionStrategy, tags?: string[]): Promise<void>;
  unregisterStrategy(strategyId: string): Promise<boolean>;
  getStrategy(strategyId: string): Promise<ReflectionStrategy | null>;
  searchStrategies(options?: StrategySearchOptions): Promise<ReflectionStrategy[]>;
  registerTemplate(template: StrategyTemplate): Promise<void>;
  getTemplate(templateId: string): Promise<StrategyTemplate | null>;
  listTemplates(): Promise<StrategyTemplate[]>;
  createFromTemplate(templateId: string, overrides?: Partial<ReflectionStrategy>): Promise<ReflectionStrategy>;
  registerCategory(category: StrategyCategory): Promise<void>;
  getCategory(categoryId: string): Promise<StrategyCategory | null>;
  listCategories(): Promise<StrategyCategory[]>;
  setStrategyTags(strategyId: string, tags: string[]): Promise<void>;
  getStrategyTags(strategyId: string): Promise<string[]>;
  getAllTags(): Promise<string[]>;
  getStrategiesByTag(tag: string): Promise<ReflectionStrategy[]>;
  getStats(): StrategyRegistryStats;
  clear(): Promise<void>;
}

export interface StrategyExecutor {
  execute(strategy: ReflectionStrategy, context: ExecutionContext): Promise<ExecutionResult>;
  prepareContext(trigger: ReflectionTrigger, data: Record<string, unknown>): Promise<ExecutionContext>;
  collectResults(executionId: string): Promise<ExecutionResult>;
  handleError(error: Error, strategy: ReflectionStrategy, context: ExecutionContext): Promise<ErrorRecoveryResult>;
}

// ============================================================================
// Analysis Interfaces
// ============================================================================

export interface PerformanceAnalyzer {
  collectMetrics(options?: MetricsCollectionOptions): Promise<PerformanceMetrics>;
  analyzePerformance(fromDate?: Date, toDate?: Date): Promise<PerformanceAnalysis>;
  identifyTrends(metricName: string, timeRange: TimeRange): Promise<TrendAnalysis>;
  generateBenchmarks(): Promise<PerformanceBenchmarks>;
  suggestOptimizations(): Promise<OptimizationSuggestion[]>;
  comparePerformance(baseline: PerformanceMetrics, current: PerformanceMetrics): Promise<PerformanceComparison>;
}

export interface KnowledgeGapAnalyzer {
  identifyGaps(options?: GapIdentificationOptions): Promise<KnowledgeGap[]>;
  assessGapImpact(gapId: string): Promise<GapImpactAssessment>;
  prioritizeGaps(gaps: KnowledgeGap[]): Promise<KnowledgeGap[]>;
  trackGapClosure(gapId: string): Promise<GapClosureProgress>;
  generateLearningPlan(gapId: string): Promise<LearningPlan>;
  analyzeGapPatterns(): Promise<GapPatternAnalysis>;
}

export interface ReflectionAnalyzer {
  assessQuality(reflection: Reflection): Promise<QualityAssessment>;
  extractInsights(reflection: Reflection): Promise<ReflectionInsight[]>;
  recognizePatterns(reflections: Reflection[]): Promise<PatternRecognition>;
  measureEffectiveness(reflectionId: string): Promise<EffectivenessMetrics>;
  analyzeInsightApplication(insightId: string): Promise<ApplicationAnalysis>;
}

// ============================================================================
// Reporting Interfaces
// ============================================================================

export interface MetricsReporter {
  generateReport(options?: ReportOptions): Promise<MetricsReport>;
  aggregateMetrics(timeRange: TimeRange): Promise<AggregatedMetrics>;
  prepareDashboardData(): Promise<DashboardData>;
  exportMetrics(format: 'json' | 'csv' | 'xlsx'): Promise<ExportResult>;
  scheduleReport(schedule: ReportSchedule): Promise<string>;
  getVisualizationData(chartType: ChartType): Promise<VisualizationData>;
}

export interface ReflectionReporter {
  generateSummary(reflectionIds: string[]): Promise<ReflectionSummary>;
  createProgressReport(timeRange: TimeRange): Promise<ProgressReport>;
  documentInsights(insightIds: string[]): Promise<InsightDocumentation>;
  customizeReport(template: ReportTemplate, data: Record<string, unknown>): Promise<CustomReport>;
  generateTrendReport(metricName: string, timeRange: TimeRange): Promise<TrendReport>;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ActionProcessingResult {
  actionId: string;
  success: boolean;
  results: Record<string, unknown>;
  nextSteps: string[];
  executionTime: number;
  error?: string;
  metadata: {
    processingTimestamp: Date;
    executionContext: Record<string, unknown>;
    metricsSnapshot?: Record<string, unknown>;
    errorDetails?: Record<string, unknown>;
    cancellationReason?: string;
  };
}

export interface ActionProgress {
  actionId: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  estimatedCompletion: Date;
  lastUpdated: Date;
  blockers: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    identifiedAt: Date;
  }>;
  milestones: Array<{
    id: string;
    description: string;
    completed: boolean;
    completedAt?: Date;
  }>;
}

export interface ImpactAssessment {
  actionId: string;
  assessedAt: Date;
  overallImpact: number;
  impactAreas: {
    performance: number;
    quality: number;
    efficiency: number;
    userSatisfaction: number;
  };
  metrics: {
    executionTime: number;
    successRate: number;
    qualityScore: number;
  };
  confidence: number;
  recommendations: string[];
}

export interface ActionReport {
  actionId: string;
  generatedAt: Date;
  summary: string;
  result: ActionProcessingResult;
  progress?: ActionProgress;
  impact?: ImpactAssessment;
  recommendations: string[];
  metadata: {
    reportVersion: string;
    generatorConfig: Record<string, unknown>;
  };
}

export interface StrategyFilter {
  enabled?: boolean;
  trigger?: ReflectionTrigger[];
  priority?: number;
  tags?: string[];
}

export interface StrategyMetadata {
  strategyId: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
  performance: StrategyPerformance;
}

export interface StrategyPerformance {
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecuted: Date;
  effectiveness: number;
}

export interface ExecutionContext {
  trigger: ReflectionTrigger;
  data: Record<string, unknown>;
  environment: Record<string, unknown>;
  constraints: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  insights: ReflectionInsight[];
  metrics: Record<string, number>;
  errors: string[];
  executionTime: number;
}

export interface ErrorRecoveryResult {
  recovered: boolean;
  fallbackStrategy?: ReflectionStrategy;
  recoveryActions: string[];
  impact: string;
}

export interface MetricsCollectionOptions {
  includeHistorical?: boolean;
  timeRange?: TimeRange;
  metrics?: string[];
  granularity?: 'minute' | 'hour' | 'day' | 'week';
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PerformanceAnalysis {
  summary: string;
  trends: TrendAnalysis[];
  anomalies: Anomaly[];
  recommendations: string[];
  score: number;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  confidence: number;
  timeRange: TimeRange;
}

export interface Anomaly {
  metric: string;
  timestamp: Date;
  expectedValue: number;
  actualValue: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface PerformanceBenchmarks {
  baseline: Record<string, number>;
  targets: Record<string, number>;
  industry: Record<string, number>;
  historical: Record<string, number>;
}

export interface OptimizationSuggestion {
  area: string;
  description: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

export interface PerformanceComparison {
  improvements: Record<string, number>;
  regressions: Record<string, number>;
  summary: string;
  overallScore: number;
}

export interface GapIdentificationOptions {
  fromRecentInteractions?: boolean;
  fromReflectionIds?: string[];
  maxGaps?: number;
  minImpactLevel?: number;
}

export interface GapImpactAssessment {
  gapId: string;
  impactLevel: number;
  affectedAreas: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
}

export interface GapClosureProgress {
  gapId: string;
  progress: number;
  milestones: Milestone[];
  estimatedCompletion: Date;
  blockers: string[];
}

export interface Milestone {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  dueDate: Date;
}

export interface LearningPlan {
  gapId: string;
  objectives: string[];
  resources: LearningResource[];
  timeline: LearningTimeline;
  assessments: Assessment[];
}

export interface LearningResource {
  type: 'document' | 'course' | 'practice' | 'mentoring';
  title: string;
  url?: string;
  estimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface LearningTimeline {
  startDate: Date;
  endDate: Date;
  phases: LearningPhase[];
}

export interface LearningPhase {
  name: string;
  duration: number;
  objectives: string[];
  resources: string[];
}

export interface Assessment {
  type: 'quiz' | 'project' | 'peer_review' | 'self_assessment';
  description: string;
  criteria: string[];
  passingScore: number;
}

export interface GapPatternAnalysis {
  commonGaps: string[];
  gapCategories: Record<string, number>;
  trends: TrendAnalysis[];
  recommendations: string[];
}

export interface QualityAssessment {
  reflectionId: string;
  score: number;
  dimensions: QualityDimension[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface PatternRecognition {
  patterns: ReflectionPattern[];
  confidence: number;
  insights: string[];
  recommendations: string[];
}

export interface ReflectionPattern {
  type: string;
  frequency: number;
  examples: string[];
  significance: number;
  description: string;
}

export interface EffectivenessMetrics {
  reflectionId: string;
  insightsGenerated: number;
  actionsCreated: number;
  actionsCompleted: number;
  impactScore: number;
  timeToImpact: number;
}

export interface ApplicationAnalysis {
  insightId: string;
  applicationRate: number;
  successRate: number;
  timeToApplication: number;
  barriers: string[];
  facilitators: string[];
}

export interface ReportOptions {
  timeRange?: TimeRange;
  includeCharts?: boolean;
  format?: 'summary' | 'detailed' | 'executive';
  sections?: string[];
}

export interface MetricsReport {
  title: string;
  generatedAt: Date;
  timeRange: TimeRange;
  summary: string;
  metrics: Record<string, number>;
  charts: ChartData[];
  insights: string[];
}

export interface AggregatedMetrics {
  timeRange: TimeRange;
  totals: Record<string, number>;
  averages: Record<string, number>;
  trends: Record<string, TrendAnalysis>;
  comparisons: Record<string, number>;
}

export interface DashboardData {
  widgets: DashboardWidget[];
  lastUpdated: Date;
  refreshInterval: number;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'text';
  title: string;
  data: unknown;
  config: Record<string, unknown>;
}

export interface ExportResult {
  format: string;
  filename: string;
  size: number;
  downloadUrl?: string;
  data?: unknown;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  format: 'email' | 'file';
  template: string;
}

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';

export interface VisualizationData {
  chartType: ChartType;
  data: ChartData;
  config: ChartConfig;
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

export interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface ChartConfig {
  title: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  legend: LegendConfig;
}

export interface AxisConfig {
  label: string;
  type: 'linear' | 'logarithmic' | 'category' | 'time';
  min?: number;
  max?: number;
}

export interface LegendConfig {
  display: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface ReflectionSummary {
  reflectionIds: string[];
  timeRange: TimeRange;
  totalReflections: number;
  keyInsights: string[];
  actionItems: string[];
  trends: TrendAnalysis[];
  recommendations: string[];
}

export interface ProgressReport {
  timeRange: TimeRange;
  metricsProgress: Record<string, ProgressMetric>;
  goalsProgress: GoalProgress[];
  achievements: Achievement[];
  challenges: Challenge[];
}

export interface ProgressMetric {
  current: number;
  target: number;
  progress: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface GoalProgress {
  goalId: string;
  description: string;
  progress: number;
  milestones: Milestone[];
  estimatedCompletion: Date;
}

export interface Achievement {
  title: string;
  description: string;
  achievedAt: Date;
  impact: string;
  category: string;
}

export interface Challenge {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  suggestedActions: string[];
}

export interface InsightDocumentation {
  insights: ReflectionInsight[];
  summary: string;
  categories: Record<string, number>;
  applications: ApplicationSummary[];
  recommendations: string[];
}

export interface ApplicationSummary {
  insightId: string;
  applicationCount: number;
  successRate: number;
  averageImpact: number;
  commonUses: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: ReportSection[];
  styling: ReportStyling;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'text' | 'chart' | 'table' | 'metrics';
  content: string;
  dataSource?: string;
}

export interface ReportStyling {
  theme: string;
  colors: string[];
  fonts: Record<string, string>;
  layout: string;
}

export interface CustomReport {
  title: string;
  generatedAt: Date;
  template: string;
  sections: RenderedSection[];
  metadata: Record<string, unknown>;
}

export interface RenderedSection {
  id: string;
  title: string;
  content: string;
  data?: unknown;
}

export interface TrendReport {
  metric: string;
  timeRange: TimeRange;
  trend: TrendAnalysis;
  forecast: ForecastData;
  insights: string[];
  recommendations: string[];
}

export interface ForecastData {
  predictions: PredictionPoint[];
  confidence: number;
  methodology: string;
  assumptions: string[];
}

export interface PredictionPoint {
  timestamp: Date;
  value: number;
  confidence: number;
}

// ============================================================================
// Strategy Registry Interfaces
// ============================================================================

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  trigger: ReflectionTrigger;
  priority?: number;
  implementation: (context: ExecutionContext) => Promise<ExecutionResult>;
}

export interface StrategyCategory {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface StrategySearchOptions {
  trigger?: ReflectionTrigger;
  enabled?: boolean;
  tags?: string[];
  category?: string;
  minPriority?: number;
  maxPriority?: number;
  searchText?: string;
  sortBy?: 'priority' | 'name' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface StrategyRegistryStats {
  totalStrategies: number;
  totalTemplates: number;
  totalCategories: number;
  totalTags: number;
  enabledStrategies: number;
  tagDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  cacheSize: number;
  config: StrategyRegistryConfig;
}

export interface StrategyRegistryConfig {
  maxStrategies: number;
  enableCaching: boolean;
  cacheSize: number;
  enableVersioning: boolean;
  enableMetrics: boolean;
} 