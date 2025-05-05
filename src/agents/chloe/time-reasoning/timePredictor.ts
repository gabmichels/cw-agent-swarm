/**
 * Chloe's Time Predictor
 * 
 * ML-based system for predicting task execution time based on historical data,
 * task complexity, and contextual factors.
 */

import { ChloeAgent } from '../core/agent';
import { ChloeMemory } from '../memory';
import { 
  TaskExecutionData, 
  TimePrediction, 
  TaskComplexity,
  PredictionModelType,
  TimePerformanceMetrics
} from './types';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Time series prediction options
 */
export interface TimePredictionOptions {
  taskType: string;
  description: string;
  tools?: string[];
  parameters?: Record<string, any>;
  contextualFeatures?: {
    systemLoad?: number;
    concurrentTasks?: number;
    memorySize?: number;
    timeOfDay?: string;
    dayOfWeek?: number;
  };
  tags?: string[];
  complexityHint?: TaskComplexity;
}

/**
 * Historical data storage options
 */
export interface HistoricalDataOptions {
  maxEntries?: number;
  retentionPeriodDays?: number;
  storageMethod?: 'memory' | 'persistent';
}

/**
 * Time Predictor System
 */
export class TimePredictor {
  private agent: ChloeAgent;
  private memory: ChloeMemory | null;
  private historicalData: TaskExecutionData[] = [];
  private initialized: boolean = false;
  private options: HistoricalDataOptions;
  private typeModels: Map<string, any> = new Map();
  private complexityModels: Map<TaskComplexity, any> = new Map();
  private performanceMetrics: TimePerformanceMetrics;

  constructor(agent: ChloeAgent, options?: HistoricalDataOptions) {
    this.agent = agent;
    this.memory = agent.getMemory();
    this.options = {
      maxEntries: 1000,
      retentionPeriodDays: 30,
      storageMethod: 'memory',
      ...options
    };

    // Initialize performance metrics
    this.performanceMetrics = {
      totalTasks: 0,
      averageAccuracy: 0,
      mape: 0,
      overestimationRate: 0,
      underestimationRate: 0,
      predictionsByComplexity: Object.values(TaskComplexity).reduce((acc, complexity) => {
        acc[complexity] = { count: 0, averageAccuracy: 0 };
        return acc;
      }, {} as Record<TaskComplexity, { count: number; averageAccuracy: number }>),
      predictionsByTaskType: {}
    };
  }

  /**
   * Initialize the time predictor system
   */
  public async initialize(): Promise<boolean> {
    try {
      // Load historical data from memory if available
      await this.loadHistoricalData();

      // Initialize type and complexity models
      this.initializeModels();

      this.initialized = true;
      this.logToMemory('Time Predictor initialized successfully', 'system_log');
      return true;
    } catch (error) {
      console.error('Failed to initialize TimePredictor:', error);
      return false;
    }
  }

  /**
   * Load historical task execution data
   */
  private async loadHistoricalData(): Promise<void> {
    if (!this.memory) return;

    try {
      // Query memory for task execution records
      const executionRecords = await this.memory.getRelevantMemories(
        'task execution time data',
        100
      );

      // Parse and convert to TaskExecutionData
      for (const record of executionRecords) {
        if (record.category === MemoryType.TASK_EXECUTION_DATA && record.content) {
          try {
            const data = JSON.parse(record.content) as TaskExecutionData;
            this.addExecutionData(data, false); // Don't update models yet
          } catch (e) {
            console.warn('Failed to parse task execution data:', e);
          }
        }
      }

      console.log(`Loaded ${this.historicalData.length} historical task execution records`);
    } catch (error) {
      console.error('Error loading historical execution data:', error);
    }
  }

  /**
   * Initialize prediction models
   */
  private initializeModels(): void {
    // Group data by task type
    const taskTypeGroups = this.groupDataByTaskType();
    
    // Create task type specific models
    const taskTypes = Array.from(taskTypeGroups.keys());
    for (const taskType of taskTypes) {
      const data = taskTypeGroups.get(taskType);
      if (data && data.length >= 5) { // Only create models with sufficient data
        this.typeModels.set(taskType, this.createEnsembleModel(data));
      }
    }

    // Group data by complexity
    const complexityGroups = this.groupDataByComplexity();
    
    // Create complexity specific models
    const complexities = Array.from(complexityGroups.keys());
    for (const complexity of complexities) {
      const data = complexityGroups.get(complexity);
      if (data && data.length >= 5) { // Only create models with sufficient data
        this.complexityModels.set(complexity, this.createEnsembleModel(data));
      }
    }
  }

  /**
   * Create an ensemble prediction model from historical data
   */
  private createEnsembleModel(data: TaskExecutionData[]): any {
    // In a real implementation, this would create a proper ML model
    // For now, we'll implement simple statistical models
    
    return {
      // Calculate moving average
      movingAverage: this.calculateMovingAverage(data),
      
      // Calculate median
      median: this.calculateMedian(data),
      
      // Calculate simple regression coefficients for feature-based prediction
      regression: this.calculateRegressionCoefficients(data),
      
      // Store raw data for similarity-based prediction
      rawData: [...data],
      
      // Predict function to be used later
      predict: (features: any) => this.ensemblePrediction(data, features)
    };
  }

  /**
   * Calculate moving average from historical data
   */
  private calculateMovingAverage(data: TaskExecutionData[]): number {
    if (data.length === 0) return 0;
    
    // Use more recent data with higher weights
    const weights = data.map((_, i) => i + 1);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    
    const weightedSum = data.reduce((sum, item, i) => {
      return sum + (item.durationMs * weights[i]);
    }, 0);
    
    return weightedSum / weightSum;
  }

  /**
   * Calculate median from historical data
   */
  private calculateMedian(data: TaskExecutionData[]): number {
    if (data.length === 0) return 0;
    
    const sortedDurations = [...data].sort((a, b) => a.durationMs - b.durationMs);
    const mid = Math.floor(sortedDurations.length / 2);
    
    return sortedDurations.length % 2 === 0
      ? (sortedDurations[mid - 1].durationMs + sortedDurations[mid].durationMs) / 2
      : sortedDurations[mid].durationMs;
  }

  /**
   * Calculate simple regression coefficients
   */
  private calculateRegressionCoefficients(data: TaskExecutionData[]): any {
    // In a real implementation, this would use proper regression analysis
    // For now, we'll return a simplified model
    
    // Extract key features that might influence duration
    const complexityWeights = {
      [TaskComplexity.TRIVIAL]: 0.2,
      [TaskComplexity.SIMPLE]: 0.5,
      [TaskComplexity.MODERATE]: 1.0,
      [TaskComplexity.COMPLEX]: 2.0,
      [TaskComplexity.VERY_COMPLEX]: 4.0
    };
    
    // Calculate average duration per complexity level
    const complexityDurations: Record<TaskComplexity, number[]> = {
      [TaskComplexity.TRIVIAL]: [],
      [TaskComplexity.SIMPLE]: [],
      [TaskComplexity.MODERATE]: [],
      [TaskComplexity.COMPLEX]: [],
      [TaskComplexity.VERY_COMPLEX]: []
    };
    
    // Group durations by complexity
    data.forEach(item => {
      complexityDurations[item.actualComplexity].push(item.durationMs);
    });
    
    // Calculate average per complexity level
    const complexityBaselines: Record<TaskComplexity, number> = Object.entries(complexityDurations)
      .reduce((acc, [complexity, durations]) => {
        acc[complexity as TaskComplexity] = durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0;
        return acc;
      }, {} as Record<TaskComplexity, number>);
    
    // Calculate tool overhead (average additional time when a tool is used)
    const toolsUsed = new Set<string>();
    data.forEach(item => item.toolsUsed.forEach(tool => toolsUsed.add(tool)));
    
    const toolOverhead: Record<string, number> = {};
    toolsUsed.forEach(tool => {
      const withTool = data.filter(item => item.toolsUsed.includes(tool));
      const withoutTool = data.filter(item => !item.toolsUsed.includes(tool));
      
      if (withTool.length > 0 && withoutTool.length > 0) {
        const avgWithTool = withTool.reduce((sum, item) => sum + item.durationMs, 0) / withTool.length;
        const avgWithoutTool = withoutTool.reduce((sum, item) => sum + item.durationMs, 0) / withoutTool.length;
        toolOverhead[tool] = Math.max(0, avgWithTool - avgWithoutTool);
      }
    });
    
    return {
      complexityBaselines,
      complexityWeights,
      toolOverhead,
      
      // Context factors (simplified)
      contextFactors: {
        systemLoadMultiplier: 1.5,  // Higher system load increases duration
        concurrentTaskPenalty: 500, // ms per concurrent task
        timeOfDayFactors: {
          morning: 0.9,   // Faster in the morning
          afternoon: 1.0, // Baseline
          evening: 1.1,   // Slower in the evening
          night: 1.2      // Slowest at night
        }
      }
    };
  }

  /**
   * Ensemble prediction that combines multiple models
   */
  private ensemblePrediction(data: TaskExecutionData[], features: any): number {
    // If we have very little data, use simple average
    if (data.length < 3) {
      return data.reduce((sum, item) => sum + item.durationMs, 0) / data.length;
    }
    
    // Find similar tasks (simplified version - in real implementation would use embeddings)
    const similarTasks = this.findSimilarTasks(data, features, 3);
    const similarityAvg = similarTasks.length > 0
      ? similarTasks.reduce((sum, item) => sum + item.durationMs, 0) / similarTasks.length
      : 0;
    
    // Calculate regression-based prediction
    const regressionPrediction = this.calculateRegressionPrediction(features);
    
    // Calculate moving average and median
    const movingAvg = this.calculateMovingAverage(data);
    const median = this.calculateMedian(data);
    
    // Ensemble by weighted average (weights would be learned in a real implementation)
    return (
      0.4 * similarityAvg + 
      0.3 * regressionPrediction + 
      0.2 * movingAvg + 
      0.1 * median
    );
  }
  
  /**
   * Calculate regression prediction based on task features
   */
  private calculateRegressionPrediction(features: any): number {
    // Find the regression model for this task type
    let regression;
    
    if (features.taskType && this.typeModels.has(features.taskType)) {
      regression = this.typeModels.get(features.taskType).regression;
    } else if (features.complexity && this.complexityModels.has(features.complexity)) {
      regression = this.complexityModels.get(features.complexity).regression;
    } else {
      // Use a general model if we have one
      const allData = [...this.historicalData];
      regression = this.calculateRegressionCoefficients(allData);
    }
    
    if (!regression) {
      return 1000; // Default 1 second if no model is available
    }
    
    // Get the baseline for this complexity
    const complexity = features.complexity || TaskComplexity.MODERATE;
    const baseline = regression.complexityBaselines[complexity] || 1000;
    
    // Adjust for tools
    let toolOverhead = 0;
    if (features.tools && features.tools.length > 0) {
      features.tools.forEach((tool: string) => {
        if (regression.toolOverhead[tool]) {
          toolOverhead += regression.toolOverhead[tool];
        }
      });
    }
    
    // Adjust for context factors
    let contextMultiplier = 1.0;
    if (features.contextualFeatures) {
      // Adjust for system load
      if (features.contextualFeatures.systemLoad !== undefined) {
        contextMultiplier *= 1 + (features.contextualFeatures.systemLoad * regression.contextFactors.systemLoadMultiplier);
      }
      
      // Adjust for concurrent tasks
      if (features.contextualFeatures.concurrentTasks !== undefined) {
        contextMultiplier *= 1 + (features.contextualFeatures.concurrentTasks * 0.1);
      }
      
      // Adjust for time of day
      if (features.contextualFeatures.timeOfDay) {
        const timeFactors = regression.contextFactors.timeOfDayFactors;
        contextMultiplier *= timeFactors[features.contextualFeatures.timeOfDay] || 1.0;
      }
    }
    
    return (baseline + toolOverhead) * contextMultiplier;
  }

  /**
   * Find similar tasks based on features
   */
  private findSimilarTasks(data: TaskExecutionData[], features: any, limit: number): TaskExecutionData[] {
    // In a real implementation, this would use embeddings and semantic similarity
    // For now, we'll use a simplified approach
    
    return data
      .map(item => {
        let score = 0;
        
        // Match on task type
        if (item.taskType === features.taskType) {
          score += 10;
        }
        
        // Match on complexity
        if (item.actualComplexity === features.complexity) {
          score += 5;
        }
        
        // Match on tools used
        if (features.tools && features.tools.length > 0) {
          const toolMatchCount = features.tools.filter((tool: string) => 
            item.toolsUsed.includes(tool)
          ).length;
          
          score += toolMatchCount * 2;
        }
        
        // Match on tags
        if (features.tags && features.tags.length > 0) {
          const tagMatchCount = features.tags.filter((tag: string) => 
            item.tags.includes(tag)
          ).length;
          
          score += tagMatchCount;
        }
        
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.item);
  }

  /**
   * Group historical data by task type
   */
  private groupDataByTaskType(): Map<string, TaskExecutionData[]> {
    const groups = new Map<string, TaskExecutionData[]>();
    
    for (const data of this.historicalData) {
      if (!groups.has(data.taskType)) {
        groups.set(data.taskType, []);
      }
      
      groups.get(data.taskType)!.push(data);
    }
    
    return groups;
  }

  /**
   * Group historical data by complexity
   */
  private groupDataByComplexity(): Map<TaskComplexity, TaskExecutionData[]> {
    const groups = new Map<TaskComplexity, TaskExecutionData[]>();
    
    for (const complexity of Object.values(TaskComplexity)) {
      groups.set(complexity, []);
    }
    
    for (const data of this.historicalData) {
      groups.get(data.actualComplexity)!.push(data);
    }
    
    return groups;
  }

  /**
   * Predict execution time for a task
   */
  public predict(options: TimePredictionOptions): TimePrediction {
    if (!this.initialized) {
      throw new Error('TimePredictor not initialized');
    }
    
    const taskType = options.taskType;
    const complexity = options.complexityHint || this.estimateComplexity(options);
    
    // Prepare features for prediction
    const features = {
      taskType,
      complexity,
      description: options.description,
      tools: options.tools || [],
      contextualFeatures: options.contextualFeatures || {},
      tags: options.tags || []
    };
    
    let estimatedDuration = 0;
    let confidenceScore = 0.5; // Default medium confidence
    
    // Try task-type-specific model first
    if (this.typeModels.has(taskType)) {
      const model = this.typeModels.get(taskType);
      estimatedDuration = model.predict(features);
      confidenceScore = 0.8; // Higher confidence with task-specific model
    } 
    // Fall back to complexity-based model
    else if (this.complexityModels.has(complexity)) {
      const model = this.complexityModels.get(complexity);
      estimatedDuration = model.predict(features);
      confidenceScore = 0.6; // Medium confidence with complexity-based model
    } 
    // Use cold-start estimation if no suitable model
    else {
      estimatedDuration = this.coldStartEstimation(features);
      confidenceScore = 0.3; // Lower confidence for cold start
    }
    
    // Ensure minimum duration
    estimatedDuration = Math.max(100, estimatedDuration);
    
    // Calculate confidence intervals (simplified)
    const confidenceIntervalLow = estimatedDuration * 0.7;
    const confidenceIntervalHigh = estimatedDuration * 1.5;
    
    // Generate explanation
    const explanation = this.generateExplanation(features, estimatedDuration, confidenceScore);
    
    return {
      estimatedDurationMs: estimatedDuration,
      confidenceIntervalLow,
      confidenceIntervalHigh,
      confidenceScore,
      predictionModel: this.typeModels.has(taskType) 
        ? PredictionModelType.ENSEMBLE 
        : PredictionModelType.SIMILARITY,
      features: {
        taskType,
        predictedComplexity: complexity,
        toolRequirements: features.tools,
        contextFactors: features.contextualFeatures
      },
      explanation
    };
  }

  /**
   * Generate human-readable explanation for time estimate
   */
  private generateExplanation(
    features: any, 
    estimatedDuration: number, 
    confidenceScore: number
  ): string {
    const durationSec = Math.round(estimatedDuration / 1000);
    const durationMin = Math.round(durationSec / 60);
    
    let timeDescription = '';
    
    if (durationSec < 60) {
      timeDescription = `${durationSec} seconds`;
    } else {
      timeDescription = `${durationMin} minutes`;
    }
    
    let confidenceDescription = '';
    if (confidenceScore > 0.7) {
      confidenceDescription = 'high confidence';
    } else if (confidenceScore > 0.4) {
      confidenceDescription = 'moderate confidence';
    } else {
      confidenceDescription = 'low confidence';
    }
    
    let explanation = `Estimated duration: ${timeDescription} (${confidenceDescription}).`;
    
    // Add reasoning based on task type and complexity
    explanation += ` Based on ${features.predictedComplexity} ${features.taskType} task`;
    
    // Add tool information
    if (features.tools && features.tools.length > 0) {
      explanation += ` using ${features.tools.length} tools`;
    }
    
    // Add context information
    if (features.contextualFeatures) {
      if (features.contextualFeatures.systemLoad) {
        explanation += `, with system load at ${Math.round(features.contextualFeatures.systemLoad * 100)}%`;
      }
      
      if (features.contextualFeatures.concurrentTasks) {
        explanation += `, with ${features.contextualFeatures.concurrentTasks} concurrent tasks`;
      }
    }
    
    return explanation;
  }

  /**
   * Estimate task complexity from description and parameters
   */
  private estimateComplexity(options: TimePredictionOptions): TaskComplexity {
    // In a real implementation, this would use ML or heuristics
    // For now, use a simple heuristic based on description length and tools
    
    let complexityScore = 0;
    
    // Description length as a factor
    const descriptionLength = options.description.length;
    if (descriptionLength > 500) complexityScore += 3;
    else if (descriptionLength > 200) complexityScore += 2;
    else if (descriptionLength > 100) complexityScore += 1;
    
    // Number of tools as a factor
    const toolCount = options.tools?.length || 0;
    complexityScore += Math.min(toolCount, 4);
    
    // Map score to complexity
    if (complexityScore >= 6) return TaskComplexity.VERY_COMPLEX;
    if (complexityScore >= 4) return TaskComplexity.COMPLEX;
    if (complexityScore >= 2) return TaskComplexity.MODERATE;
    if (complexityScore >= 1) return TaskComplexity.SIMPLE;
    return TaskComplexity.TRIVIAL;
  }

  /**
   * Cold start estimation for new task types
   */
  private coldStartEstimation(features: any): number {
    // Base duration by complexity
    const complexityBaseDurations: Record<TaskComplexity, number> = {
      [TaskComplexity.TRIVIAL]: 1000,      // 1 second
      [TaskComplexity.SIMPLE]: 5000,       // 5 seconds
      [TaskComplexity.MODERATE]: 30000,    // 30 seconds
      [TaskComplexity.COMPLEX]: 120000,    // 2 minutes
      [TaskComplexity.VERY_COMPLEX]: 300000 // 5 minutes
    };
    
    // Start with baseline by complexity
    let estimation = complexityBaseDurations[features.complexity as TaskComplexity] || 30000;
    
    // Adjust for tools (each tool adds some overhead)
    if (features.tools && features.tools.length > 0) {
      estimation += features.tools.length * 10000; // 10 seconds per tool
    }
    
    // Adjust for system load
    if (features.contextualFeatures?.systemLoad) {
      estimation *= (1 + features.contextualFeatures.systemLoad);
    }
    
    // Adjust for concurrent tasks
    if (features.contextualFeatures?.concurrentTasks) {
      estimation *= (1 + features.contextualFeatures.concurrentTasks * 0.1);
    }
    
    return estimation;
  }

  /**
   * Record actual task execution data
   */
  public recordTaskExecution(data: TaskExecutionData): void {
    // Add to historical data
    this.addExecutionData(data, true);
    
    // Store in memory for future use
    this.storeExecutionData(data);
    
    // Update performance metrics
    this.updatePerformanceMetrics(data);
  }

  /**
   * Add execution data to historical dataset
   */
  private addExecutionData(data: TaskExecutionData, updateModels: boolean = true): void {
    // Add to historical data
    this.historicalData.push(data);
    
    // Enforce retention policy
    if (this.historicalData.length > (this.options.maxEntries || 1000)) {
      // Remove oldest entries
      this.historicalData = this.historicalData
        .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
        .slice(0, this.options.maxEntries || 1000);
    }
    
    // Update models if requested
    if (updateModels) {
      this.updateModels(data);
    }
  }

  /**
   * Store execution data in memory
   */
  private async storeExecutionData(data: TaskExecutionData): Promise<void> {
    if (!this.memory) return;
    
    try {
      await this.memory.addMemory(
        JSON.stringify(data),
        MemoryType.TASK_EXECUTION_DATA,
        ImportanceLevel.MEDIUM,
        MemorySource.SYSTEM,
        `Task: ${data.taskTitle}`,
        ['time_prediction', 'execution_data', data.taskType]
      );
    } catch (error) {
      console.error('Failed to store task execution data in memory:', error);
    }
  }

  /**
   * Update models with new data
   */
  private updateModels(data: TaskExecutionData): void {
    // Update task type model
    if (this.typeModels.has(data.taskType)) {
      const model = this.typeModels.get(data.taskType);
      const updatedData = [...model.rawData, data];
      this.typeModels.set(data.taskType, this.createEnsembleModel(updatedData));
    } else {
      // Create new model for this task type
      this.typeModels.set(data.taskType, this.createEnsembleModel([data]));
    }
    
    // Update complexity model
    if (this.complexityModels.has(data.actualComplexity)) {
      const model = this.complexityModels.get(data.actualComplexity);
      const updatedData = [...model.rawData, data];
      this.complexityModels.set(data.actualComplexity, this.createEnsembleModel(updatedData));
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(data: TaskExecutionData): void {
    if (!data.predictedDuration) return;
    
    const accuracy = data.durationMs / data.predictedDuration;
    const absolutePercentageError = Math.abs((data.durationMs - data.predictedDuration) / data.predictedDuration);
    const isOverestimation = data.predictedDuration > data.durationMs;
    
    // Update global metrics
    this.performanceMetrics.totalTasks++;
    
    // Update average accuracy with running average
    this.performanceMetrics.averageAccuracy = 
      (this.performanceMetrics.averageAccuracy * (this.performanceMetrics.totalTasks - 1) + accuracy) / 
      this.performanceMetrics.totalTasks;
    
    // Update MAPE
    this.performanceMetrics.mape = 
      (this.performanceMetrics.mape * (this.performanceMetrics.totalTasks - 1) + absolutePercentageError) / 
      this.performanceMetrics.totalTasks;
    
    // Update over/under estimation
    if (isOverestimation) {
      this.performanceMetrics.overestimationRate = 
        (this.performanceMetrics.overestimationRate * (this.performanceMetrics.totalTasks - 1) + 1) / 
        this.performanceMetrics.totalTasks;
    } else {
      this.performanceMetrics.underestimationRate = 
        (this.performanceMetrics.underestimationRate * (this.performanceMetrics.totalTasks - 1) + 1) / 
        this.performanceMetrics.totalTasks;
    }
    
    // Update complexity metrics
    const complexityMetrics = this.performanceMetrics.predictionsByComplexity[data.actualComplexity];
    complexityMetrics.count++;
    complexityMetrics.averageAccuracy = 
      (complexityMetrics.averageAccuracy * (complexityMetrics.count - 1) + accuracy) / 
      complexityMetrics.count;
    
    // Update task type metrics
    if (!this.performanceMetrics.predictionsByTaskType[data.taskType]) {
      this.performanceMetrics.predictionsByTaskType[data.taskType] = {
        count: 0,
        averageAccuracy: 0
      };
    }
    
    const taskTypeMetrics = this.performanceMetrics.predictionsByTaskType[data.taskType];
    taskTypeMetrics.count++;
    taskTypeMetrics.averageAccuracy = 
      (taskTypeMetrics.averageAccuracy * (taskTypeMetrics.count - 1) + accuracy) / 
      taskTypeMetrics.count;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): TimePerformanceMetrics {
    return this.performanceMetrics;
  }

  /**
   * Log to memory
   */
  private async logToMemory(message: string, category: string): Promise<void> {
    if (!this.memory) return;
    
    try {
      // Map category string to proper MemoryType
      let memoryType: MemoryType;
      
      switch (category) {
        case 'system_log':
          memoryType = MemoryType.MAINTENANCE_LOG;
          break;
        default:
          memoryType = MemoryType.THOUGHT;
      }
      
      await this.memory.addMemory(
        message,
        memoryType,
        ImportanceLevel.LOW,
        MemorySource.SYSTEM,
        undefined,
        ['time_predictor', 'system_log']
      );
    } catch (error) {
      console.error('Failed to log to memory:', error);
    }
  }

  /**
   * Clear historical data
   */
  public clearHistoricalData(): void {
    this.historicalData = [];
    this.typeModels.clear();
    this.complexityModels.clear();
    this.initializeModels();
  }
} 