import * as fs from 'fs';
import * as path from 'path';
import { FeedbackLoopSystem } from './feedback-loop';
import { EnhancedMemory } from './enhanced-memory';
import { IntegrationLayer } from './integration-layer';

/**
 * Self-Improvement Mechanism
 * 
 * Implements continuous improvement through:
 * - Periodic performance reviews
 * - Automatic adjustment of intent patterns
 * - Learning from task executions
 * - Optimizing knowledge connections
 */

// Performance metrics interface
interface PerformanceMetrics {
  intentSuccessRate: number;
  taskCompletionRate: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  knowledgeUtilizationRate: number;
  memoryRetrievalAccuracy: number;
  updatedAt: Date;
}

// Task execution log interface
interface TaskExecutionLog {
  taskId: string;
  taskType: string;
  startTime: Date;
  endTime: Date;
  successful: boolean;
  errorMessage?: string;
  executionSteps: Array<{
    step: string;
    duration: number;
    success: boolean;
    metadata: Record<string, any>;
  }>;
  memoryIds: string[];
}

// Pattern adjustment record
interface PatternAdjustment {
  intentName: string;
  originalPattern: string;
  newPattern: string;
  confidence: number;
  adjustmentDate: Date;
  reason: string;
}

export class SelfImprovementMechanism {
  private feedbackLoop: FeedbackLoopSystem;
  private enhancedMemory: EnhancedMemory;
  private integrationLayer: IntegrationLayer;
  private dataDir: string;
  private metricsPath: string;
  private taskLogPath: string;
  private adjustmentsPath: string;
  private isInitialized: boolean = false;
  private performanceHistory: PerformanceMetrics[] = [];
  private taskLogs: TaskExecutionLog[] = [];
  private patternAdjustments: PatternAdjustment[] = [];
  private lastReviewDate: Date | null = null;
  private reviewSchedule: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    lastDaily: Date | null;
    lastWeekly: Date | null;
    lastMonthly: Date | null;
  } = {
    daily: true,
    weekly: true,
    monthly: true,
    lastDaily: null,
    lastWeekly: null,
    lastMonthly: null
  };
  
  constructor(
    feedbackLoop: FeedbackLoopSystem,
    enhancedMemory: EnhancedMemory,
    integrationLayer: IntegrationLayer,
    options: {
      dataDir?: string;
      reviewSchedule?: {
        daily?: boolean;
        weekly?: boolean;
        monthly?: boolean;
      }
    } = {}
  ) {
    this.feedbackLoop = feedbackLoop;
    this.enhancedMemory = enhancedMemory;
    this.integrationLayer = integrationLayer;
    
    // Set up data directories and file paths
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'self-improvement');
    this.metricsPath = path.join(this.dataDir, 'performance_metrics.json');
    this.taskLogPath = path.join(this.dataDir, 'task_execution_logs.json');
    this.adjustmentsPath = path.join(this.dataDir, 'pattern_adjustments.json');
    
    // Set review schedule
    if (options.reviewSchedule) {
      this.reviewSchedule.daily = options.reviewSchedule.daily ?? true;
      this.reviewSchedule.weekly = options.reviewSchedule.weekly ?? true;
      this.reviewSchedule.monthly = options.reviewSchedule.monthly ?? true;
    }
  }
  
  /**
   * Initialize the self-improvement mechanism
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing self-improvement mechanism');
      
      // Ensure data directories exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      // Load existing performance metrics
      await this.loadPerformanceHistory();
      
      // Load task execution logs
      await this.loadTaskLogs();
      
      // Load pattern adjustments
      await this.loadPatternAdjustments();
      
      this.isInitialized = true;
      console.log('Self-improvement mechanism initialized successfully');
      
      // Check if we need to perform reviews
      this.checkScheduledReviews();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize self-improvement mechanism:', error);
      return false;
    }
  }
  
  /**
   * Log a task execution for learning
   */
  async logTaskExecution(taskLog: TaskExecutionLog): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Add to task logs
      this.taskLogs.push(taskLog);
      
      // Trim logs if too many
      if (this.taskLogs.length > 1000) {
        this.taskLogs = this.taskLogs.slice(-1000);
      }
      
      // Save to disk
      await this.saveTaskLogs();
      
      // Store in memory for long-term retention
      await this.enhancedMemory.addMemory(
        JSON.stringify({
          taskId: taskLog.taskId,
          taskType: taskLog.taskType,
          successful: taskLog.successful,
          executionTime: (new Date(taskLog.endTime).getTime() - new Date(taskLog.startTime).getTime()) / 1000,
          errorMessage: taskLog.errorMessage || null
        }),
        {
          type: 'task_execution',
          importance: taskLog.successful ? 'medium' : 'high',
          category: 'system_learning',
          created: new Date().toISOString()
        },
        'document'
      );
      
      // If task failed, try to learn from it
      if (!taskLog.successful && taskLog.errorMessage) {
        await this.learnFromFailure(taskLog);
      }
    } catch (error) {
      console.error('Error logging task execution:', error);
    }
  }
  
  /**
   * Run a performance review
   */
  async runPerformanceReview(reviewType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<PerformanceMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      console.log(`Running ${reviewType} performance review`);
      
      // Get time range for the review
      const now = new Date();
      let startDate = new Date();
      
      switch (reviewType) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          this.reviewSchedule.lastDaily = now;
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          this.reviewSchedule.lastWeekly = now;
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          this.reviewSchedule.lastMonthly = now;
          break;
      }
      
      // Calculate performance metrics
      const metrics = await this.calculatePerformanceMetrics(startDate, now);
      
      // Add to history
      this.performanceHistory.push(metrics);
      
      // Trim history if too long
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }
      
      // Save to disk
      await this.savePerformanceHistory();
      
      // Create the review content
      const reviewContent = `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Performance Review: ` +
        `Success Rate: ${Math.round(metrics.intentSuccessRate * 100)}%, ` +
        `Task Completion: ${Math.round(metrics.taskCompletionRate * 100)}%, ` +
        `User Satisfaction: ${Math.round(metrics.userSatisfactionScore * 10) / 10}/5`;
      
      // Store review in memory as an internal thought, not a chat message
      await this.enhancedMemory.addMemory(
        reviewContent,
        {
          type: 'thought', // Change to 'thought' instead of 'document'
          subtype: 'performance_review', // Use subtype to preserve categorization
          importance: 'high',
          category: 'system_learning',
          created: new Date().toISOString(),
          reviewType,
          isInternalReflection: true, // Flag to mark this as not intended for chat display
          notForChat: true // Additional flag to reinforce that this should not appear in chat
        },
        'thought' // Use 'thought' type to ensure proper categorization
      );
      
      // Log that this is an internal reflection, not a chat message
      console.log(`INTERNAL REFLECTION (NOT CHAT): Generated ${reviewType} performance review metrics`);
      
      return metrics;
    } catch (error) {
      console.error(`Error running ${reviewType} performance review:`, error);
      
      // Return default metrics in case of error
      return {
        intentSuccessRate: 0,
        taskCompletionRate: 0,
        averageResponseTime: 0,
        userSatisfactionScore: 0,
        knowledgeUtilizationRate: 0,
        memoryRetrievalAccuracy: 0,
        updatedAt: new Date()
      };
    }
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(limit: number = 1): PerformanceMetrics[] {
    if (this.performanceHistory.length === 0) {
      return [{
        intentSuccessRate: 0,
        taskCompletionRate: 0,
        averageResponseTime: 0,
        userSatisfactionScore: 0,
        knowledgeUtilizationRate: 0,
        memoryRetrievalAccuracy: 0,
        updatedAt: new Date()
      }];
    }
    
    return this.performanceHistory
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get pattern adjustments
   */
  getPatternAdjustments(limit: number = 10): PatternAdjustment[] {
    return this.patternAdjustments
      .sort((a, b) => b.adjustmentDate.getTime() - a.adjustmentDate.getTime())
      .slice(0, limit);
  }
  
  /**
   * Optimize knowledge connections
   */
  async optimizeKnowledgeConnections(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      console.log('Optimizing knowledge connections');
      
      // This would implement logic to analyze memory usage patterns
      // and optimize the connections between related memories
      
      // For now, we'll just log this as a placeholder
      console.log('Knowledge connection optimization not fully implemented yet');
      
      // Return success
      return true;
    } catch (error) {
      console.error('Error optimizing knowledge connections:', error);
      return false;
    }
  }
  
  /**
   * Check if scheduled reviews need to be run
   */
  async checkScheduledReviews(): Promise<void> {
    const now = new Date();
    
    // Daily review
    if (this.reviewSchedule.daily) {
      const lastDaily = this.reviewSchedule.lastDaily;
      
      if (!lastDaily || isNextDay(lastDaily, now)) {
        await this.runPerformanceReview('daily');
      }
    }
    
    // Weekly review
    if (this.reviewSchedule.weekly) {
      const lastWeekly = this.reviewSchedule.lastWeekly;
      
      if (!lastWeekly || isNextWeek(lastWeekly, now)) {
        await this.runPerformanceReview('weekly');
      }
    }
    
    // Monthly review
    if (this.reviewSchedule.monthly) {
      const lastMonthly = this.reviewSchedule.lastMonthly;
      
      if (!lastMonthly || isNextMonth(lastMonthly, now)) {
        await this.runPerformanceReview('monthly');
      }
    }
  }
  
  /**
   * Load performance history from disk
   */
  private async loadPerformanceHistory(): Promise<void> {
    try {
      if (fs.existsSync(this.metricsPath)) {
        const data = fs.readFileSync(this.metricsPath, 'utf8');
        const history = JSON.parse(data);
        
        // Parse dates
        this.performanceHistory = history.map((metrics: any) => ({
          ...metrics,
          updatedAt: new Date(metrics.updatedAt)
        }));
        
        console.log(`Loaded ${this.performanceHistory.length} performance metrics`);
      } else {
        console.log('No performance history found, starting fresh');
        this.performanceHistory = [];
      }
    } catch (error) {
      console.error('Error loading performance history:', error);
      this.performanceHistory = [];
    }
  }
  
  /**
   * Save performance history to disk
   */
  private async savePerformanceHistory(): Promise<void> {
    try {
      fs.writeFileSync(
        this.metricsPath,
        JSON.stringify(this.performanceHistory, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving performance history:', error);
    }
  }
  
  /**
   * Load task logs from disk
   */
  private async loadTaskLogs(): Promise<void> {
    try {
      if (fs.existsSync(this.taskLogPath)) {
        const data = fs.readFileSync(this.taskLogPath, 'utf8');
        const logs = JSON.parse(data);
        
        // Parse dates
        this.taskLogs = logs.map((log: any) => ({
          ...log,
          startTime: new Date(log.startTime),
          endTime: new Date(log.endTime),
          executionSteps: log.executionSteps.map((step: any) => ({
            ...step,
            metadata: step.metadata || {}
          }))
        }));
        
        console.log(`Loaded ${this.taskLogs.length} task execution logs`);
      } else {
        console.log('No task logs found, starting fresh');
        this.taskLogs = [];
      }
    } catch (error) {
      console.error('Error loading task logs:', error);
      this.taskLogs = [];
    }
  }
  
  /**
   * Save task logs to disk
   */
  private async saveTaskLogs(): Promise<void> {
    try {
      fs.writeFileSync(
        this.taskLogPath,
        JSON.stringify(this.taskLogs, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving task logs:', error);
    }
  }
  
  /**
   * Load pattern adjustments from disk
   */
  private async loadPatternAdjustments(): Promise<void> {
    try {
      if (fs.existsSync(this.adjustmentsPath)) {
        const data = fs.readFileSync(this.adjustmentsPath, 'utf8');
        const adjustments = JSON.parse(data);
        
        // Parse dates
        this.patternAdjustments = adjustments.map((adjustment: any) => ({
          ...adjustment,
          adjustmentDate: new Date(adjustment.adjustmentDate)
        }));
        
        console.log(`Loaded ${this.patternAdjustments.length} pattern adjustments`);
      } else {
        console.log('No pattern adjustments found, starting fresh');
        this.patternAdjustments = [];
      }
    } catch (error) {
      console.error('Error loading pattern adjustments:', error);
      this.patternAdjustments = [];
    }
  }
  
  /**
   * Save pattern adjustments to disk
   */
  private async savePatternAdjustments(): Promise<void> {
    try {
      fs.writeFileSync(
        this.adjustmentsPath,
        JSON.stringify(this.patternAdjustments, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving pattern adjustments:', error);
    }
  }
  
  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    // Filter task logs by date range
    const relevantLogs = this.taskLogs.filter(log => 
      log.startTime >= startDate && log.endTime <= endDate
    );
    
    // Calculate task completion rate
    const taskCompletionRate = relevantLogs.length > 0
      ? relevantLogs.filter(log => log.successful).length / relevantLogs.length
      : 0;
    
    // Calculate average response time
    let totalResponseTime = 0;
    relevantLogs.forEach(log => {
      totalResponseTime += log.endTime.getTime() - log.startTime.getTime();
    });
    
    const averageResponseTime = relevantLogs.length > 0
      ? totalResponseTime / relevantLogs.length / 1000 // Convert to seconds
      : 0;
    
    // Get feedback loop statistics
    const stats = this.feedbackLoop.getStatistics();
    
    // Calculate intent success rate
    let intentSuccessRate = 0;
    let totalIntents = 0;
    let intentSuccess = 0;
    
    for (const intent in stats.intentStats) {
      const intentStat = stats.intentStats[intent];
      totalIntents += intentStat.successCount + intentStat.failureCount;
      intentSuccess += intentStat.successCount;
    }
    
    intentSuccessRate = totalIntents > 0 ? intentSuccess / totalIntents : 0;
    
    // For now, assume placeholder values for these metrics
    // In a real system, these would be calculated from actual data
    const userSatisfactionScore = 4.2; // Example value
    const knowledgeUtilizationRate = 0.65; // Example value
    const memoryRetrievalAccuracy = 0.78; // Example value
    
    return {
      intentSuccessRate,
      taskCompletionRate,
      averageResponseTime,
      userSatisfactionScore,
      knowledgeUtilizationRate,
      memoryRetrievalAccuracy,
      updatedAt: new Date()
    };
  }
  
  /**
   * Implement improvements based on performance metrics
   */
  private async implementImprovements(
    metrics: PerformanceMetrics,
    reviewType: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    try {
      // Only perform pattern optimization on weekly or monthly reviews
      if (reviewType === 'weekly' || reviewType === 'monthly') {
        await this.optimizeIntentPatterns();
      }
      
      // Only perform knowledge optimization on monthly reviews
      if (reviewType === 'monthly') {
        await this.optimizeKnowledgeConnections();
      }
      
      // If intent success rate is too low, investigate failures
      if (metrics.intentSuccessRate < 0.7) {
        await this.investigateIntentFailures();
      }
      
      // If task completion rate is too low, investigate failures
      if (metrics.taskCompletionRate < 0.8) {
        await this.investigateTaskFailures();
      }
    } catch (error) {
      console.error('Error implementing improvements:', error);
    }
  }
  
  /**
   * Optimize intent patterns based on success and failure rates
   */
  private async optimizeIntentPatterns(): Promise<void> {
    try {
      console.log('Optimizing intent patterns');
      
      // Get statistics from feedback loop
      const stats = this.feedbackLoop.getStatistics();
      
      // For each intent with low confidence, try to improve patterns
      for (const intent in stats.intentStats) {
        const intentStat = stats.intentStats[intent];
        
        if (intentStat.averageConfidence < 0.8) {
          console.log(`Optimizing patterns for intent: ${intent}`);
          
          // Get successful examples for this intent
          const examples = this.feedbackLoop.getExamples(intent, 10);
          
          if (examples.length >= 3) {
            // Create a new generalized pattern from examples
            const newPattern = this.generalizePattern(examples);
            
            // Record the adjustment
            const adjustment: PatternAdjustment = {
              intentName: intent,
              originalPattern: 'multiple patterns',
              newPattern,
              confidence: 0.9,
              adjustmentDate: new Date(),
              reason: `Low confidence (${intentStat.averageConfidence.toFixed(2)}) for intent ${intent}`
            };
            
            this.patternAdjustments.push(adjustment);
            
            // Save adjustments
            await this.savePatternAdjustments();
            
            // Record in memory for future reference
            await this.enhancedMemory.addMemory(
              `Optimized pattern for intent ${intent}: "${newPattern}"`,
              {
                type: 'pattern_adjustment',
                importance: 'medium',
                category: 'system_learning',
                created: new Date().toISOString()
              },
              'document'
            );
          }
        }
      }
    } catch (error) {
      console.error('Error optimizing intent patterns:', error);
    }
  }
  
  /**
   * Investigate intent failures
   */
  private async investigateIntentFailures(): Promise<void> {
    try {
      console.log('Investigating intent failures');
      
      // Placeholder for intent failure investigation
      // This would analyze patterns of intent recognition failures
      // and suggest improvements
      
      // Log the investigation
      await this.enhancedMemory.addMemory(
        'Investigated intent failures and identified common patterns',
        {
          type: 'failure_investigation',
          importance: 'high',
          category: 'system_learning',
          created: new Date().toISOString()
        },
        'document'
      );
    } catch (error) {
      console.error('Error investigating intent failures:', error);
    }
  }
  
  /**
   * Investigate task failures
   */
  private async investigateTaskFailures(): Promise<void> {
    try {
      console.log('Investigating task failures');
      
      // Get failed tasks from the last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const failedTasks = this.taskLogs.filter(log => 
        !log.successful && log.startTime >= oneWeekAgo
      );
      
      if (failedTasks.length === 0) {
        console.log('No failed tasks found in the last week');
        return;
      }
      
      console.log(`Found ${failedTasks.length} failed tasks to analyze`);
      
      // Group tasks by type
      const failuresByType: Record<string, TaskExecutionLog[]> = {};
      
      for (const task of failedTasks) {
        if (!failuresByType[task.taskType]) {
          failuresByType[task.taskType] = [];
        }
        
        failuresByType[task.taskType].push(task);
      }
      
      // Identify common failure patterns
      for (const taskType in failuresByType) {
        const tasks = failuresByType[taskType];
        
        // Look for common error messages
        const errorMessages: Record<string, number> = {};
        
        for (const task of tasks) {
          if (task.errorMessage) {
            errorMessages[task.errorMessage] = (errorMessages[task.errorMessage] || 0) + 1;
          }
        }
        
        // Find the most common error
        let mostCommonError = '';
        let highestCount = 0;
        
        for (const error in errorMessages) {
          if (errorMessages[error] > highestCount) {
            mostCommonError = error;
            highestCount = errorMessages[error];
          }
        }
        
        if (mostCommonError && highestCount >= 2) {
          // Log the finding
          await this.enhancedMemory.addMemory(
            `Identified common failure pattern in ${taskType} tasks: "${mostCommonError}" (${highestCount} occurrences)`,
            {
              type: 'failure_pattern',
              importance: 'high',
              category: 'system_learning',
              created: new Date().toISOString(),
              taskType
            },
            'document'
          );
        }
      }
    } catch (error) {
      console.error('Error investigating task failures:', error);
    }
  }
  
  /**
   * Learn from a failed task
   */
  private async learnFromFailure(taskLog: TaskExecutionLog): Promise<void> {
    try {
      // Record the failure for feedback loop learning
      await this.feedbackLoop.recordCorrection(
        `Task ${taskLog.taskId} (${taskLog.taskType})`,
        null,
        'corrected_execution'
      );
      
      // Log detailed failure analysis
      await this.enhancedMemory.addMemory(
        `Analysis of failed task ${taskLog.taskId}: ${taskLog.errorMessage}`,
        {
          type: 'failure_analysis',
          importance: 'high',
          category: 'system_learning',
          created: new Date().toISOString(),
          taskType: taskLog.taskType,
          errorMessage: taskLog.errorMessage
        },
        'document'
      );
    } catch (error) {
      console.error('Error learning from failure:', error);
    }
  }
  
  /**
   * Create a generalized pattern from examples
   */
  private generalizePattern(examples: string[]): string {
    // Simple implementation - in practice this would use more sophisticated NLP
    
    // Placeholder implementation: use the longest example as a base
    let baseExample = '';
    for (const example of examples) {
      if (example.length > baseExample.length) {
        baseExample = example;
      }
    }
    
    // Simple generalization: remove specific numbers and proper nouns
    return baseExample
      .toLowerCase()
      .replace(/\d+/g, '{number}')
      .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi, '{month}')
      .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '{day}');
  }
}

// Export factory function
export const createSelfImprovementMechanism = (
  feedbackLoop: FeedbackLoopSystem,
  enhancedMemory: EnhancedMemory,
  integrationLayer: IntegrationLayer,
  options: {
    dataDir?: string;
    reviewSchedule?: {
      daily?: boolean;
      weekly?: boolean;
      monthly?: boolean;
    }
  } = {}
): SelfImprovementMechanism => {
  return new SelfImprovementMechanism(
    feedbackLoop,
    enhancedMemory,
    integrationLayer,
    options
  );
};

// Helper functions for date comparisons
function isNextDay(date1: Date, date2: Date): boolean {
  const day1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const day2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  
  const diffTime = Math.abs(day2.getTime() - day1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 1;
}

function isNextWeek(date1: Date, date2: Date): boolean {
  const day1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const day2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  
  const diffTime = Math.abs(day2.getTime() - day1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 7;
}

function isNextMonth(date1: Date, date2: Date): boolean {
  // Check if at least a month has passed
  if (date2.getFullYear() > date1.getFullYear()) {
    return true;
  }
  
  if (date2.getFullYear() === date1.getFullYear() && 
      date2.getMonth() > date1.getMonth()) {
    return true;
  }
  
  return false;
} 