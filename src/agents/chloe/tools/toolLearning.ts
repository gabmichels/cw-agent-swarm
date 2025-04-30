import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../lib/logging';
import { getToolPerformanceTracker, ToolPerformanceRecord } from './toolPerformanceTracker';

/**
 * Result of a tool trial for learning purposes
 */
export interface ToolTrialResult {
  toolName: string;
  taskType: string;
  resultScore: number; // 0-1 score representing success/quality
  parameters?: Record<string, any>;
  contextTags?: string[];
  timestamp?: string;
}

/**
 * Preference entry mapping tasks to tools with scores
 */
interface ToolPreferenceEntry {
  taskType: string;
  toolPreferences: {
    [toolName: string]: {
      overallScore: number;
      trials: number;
      contextScores: {
        [contextTag: string]: {
          score: number;
          trials: number;
        }
      }
    }
  };
  toolCombinations: {
    [combination: string]: {
      score: number;
      trials: number;
    }
  };
}

/**
 * Tool comparison test data
 */
interface ABTestRecord {
  testId: string;
  taskType: string;
  toolA: string;
  toolB: string;
  contextTags?: string[];
  status: 'pending' | 'completed';
  winner?: string;
  startTime: string;
  endTime?: string;
}

/**
 * System for learning tool preferences based on historical performance
 */
export class ToolLearner {
  private preferenceMap: Map<string, ToolPreferenceEntry> = new Map();
  private abTests: ABTestRecord[] = [];
  private storageDir: string;
  private readonly preferencesFile: string;
  private readonly abTestsFile: string;
  private performanceTracker = getToolPerformanceTracker();
  
  constructor() {
    this.storageDir = path.join(process.cwd(), 'data', 'tool-learning');
    this.preferencesFile = path.join(this.storageDir, 'tool-preferences.json');
    this.abTestsFile = path.join(this.storageDir, 'ab-tests.json');
    
    this.initialize();
  }
  
  private initialize(): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      
      // Load preferences if they exist
      if (fs.existsSync(this.preferencesFile)) {
        const data = fs.readFileSync(this.preferencesFile, 'utf-8');
        const preferences = JSON.parse(data) as ToolPreferenceEntry[];
        preferences.forEach(pref => {
          this.preferenceMap.set(pref.taskType, pref);
        });
        logger.info(`Loaded tool preferences for ${preferences.length} task types`);
      }
      
      // Load AB tests if they exist
      if (fs.existsSync(this.abTestsFile)) {
        const data = fs.readFileSync(this.abTestsFile, 'utf-8');
        this.abTests = JSON.parse(data) as ABTestRecord[];
        const pendingTests = this.abTests.filter(test => test.status === 'pending').length;
        logger.info(`Loaded ${this.abTests.length} AB tests (${pendingTests} pending)`);
      }
    } catch (error) {
      logger.error(`Error initializing ToolLearner: ${error}`);
    }
  }
  
  /**
   * Records the result of a tool trial for learning purposes
   * @param result The trial result
   */
  public recordTrial(result: ToolTrialResult): void {
    try {
      const { toolName, taskType, resultScore, contextTags = [] } = result;
      
      // Create timestamp if not provided
      const timestamp = result.timestamp || new Date().toISOString();
      
      // Get or create preference entry for this task type
      let entry = this.preferenceMap.get(taskType);
      if (!entry) {
        entry = {
          taskType,
          toolPreferences: {},
          toolCombinations: {}
        };
        this.preferenceMap.set(taskType, entry);
      }
      
      // Get or create tool preference
      if (!entry.toolPreferences[toolName]) {
        entry.toolPreferences[toolName] = {
          overallScore: resultScore,
          trials: 1,
          contextScores: {}
        };
      } else {
        // Update overall score with exponential moving average
        // Gives more weight to recent trials
        const alpha = 0.3; // Learning rate
        const current = entry.toolPreferences[toolName];
        current.overallScore = (1 - alpha) * current.overallScore + alpha * resultScore;
        current.trials++;
      }
      
      // Update context-specific scores
      contextTags.forEach(tag => {
        const toolPref = entry.toolPreferences[toolName];
        if (!toolPref.contextScores[tag]) {
          toolPref.contextScores[tag] = {
            score: resultScore,
            trials: 1
          };
        } else {
          const contextScore = toolPref.contextScores[tag];
          // Use weighted average that favors recent results
          const alpha = 0.3;
          contextScore.score = (1 - alpha) * contextScore.score + alpha * resultScore;
          contextScore.trials++;
        }
      });
      
      // Record to performance tracker as well (if successful)
      this.performanceTracker.recordResult(
        toolName, 
        resultScore > 0.5, // Success if score > 0.5
        undefined, // No execution time info
        result.parameters
      );
      
      // Check if this was part of an A/B test
      this.updateABTestsWithResult(toolName, taskType, resultScore, contextTags);
      
      this.savePreferences();
      logger.debug(`Recorded trial for tool ${toolName} on task ${taskType} with score ${resultScore.toFixed(2)}`);
    } catch (error) {
      logger.error(`Error recording tool trial: ${error}`);
    }
  }
  
  /**
   * Gets the preferred tool for a specific task type and context
   * @param taskType The type of task
   * @param contextTags Optional context tags that may influence selection
   * @returns The name of the preferred tool or null if none found
   */
  public getPreferredTool(taskType: string, contextTags: string[] = []): string | null {
    try {
      // Look for A/B tests that need to be run
      const abTest = this.getActiveABTest(taskType, contextTags);
      if (abTest) {
        logger.info(`Selected A/B test tool: ${abTest.toolA} for task ${taskType}`);
        return abTest.toolA; // Always choose toolA for consistency
      }
      
      // Get preference entry for this task type
      const entry = this.preferenceMap.get(taskType);
      if (!entry || Object.keys(entry.toolPreferences).length === 0) {
        logger.debug(`No preferences found for task type: ${taskType}`);
        return null;
      }
      
      // Find best tool based on context
      let bestTool: string | null = null;
      let bestScore = -1;
      
      // Search through all tools for this task
      for (const [toolName, preference] of Object.entries(entry.toolPreferences)) {
        let weightedScore = preference.overallScore;
        let contextMultiplier = 1.0;
        
        // Adjust score based on contexts that match
        contextTags.forEach(tag => {
          if (preference.contextScores[tag]) {
            const contextData = preference.contextScores[tag];
            // Weight by number of trials in this context
            const contextWeight = Math.min(contextData.trials / 5, 1); // Cap at 1 after 5 trials
            contextMultiplier += (contextData.score - 0.5) * contextWeight;
          }
        });
        
        // Apply context multiplier
        const finalScore = weightedScore * contextMultiplier;
        
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestTool = toolName;
        }
      }
      
      return bestTool;
    } catch (error) {
      logger.error(`Error getting preferred tool: ${error}`);
      return null;
    }
  }
  
  /**
   * Gets suggested tool combinations for a task type
   * @param taskType The type of task
   * @returns Array of tool combination strings (comma-separated)
   */
  public suggestToolCombos(taskType: string): string[] {
    try {
      const entry = this.preferenceMap.get(taskType);
      if (!entry || !entry.toolCombinations) {
        return [];
      }
      
      // Get combinations sorted by score
      const combos = Object.entries(entry.toolCombinations)
        .filter(([_, data]) => data.trials >= 3) // Only suggest combinations with enough trials
        .sort((a, b) => b[1].score - a[1].score) // Sort by descending score
        .slice(0, 3) // Take top 3
        .map(([combination, _]) => combination);
      
      return combos;
    } catch (error) {
      logger.error(`Error suggesting tool combinations: ${error}`);
      return [];
    }
  }
  
  /**
   * Records a tool combination result
   * @param taskType The type of task
   * @param toolNames Array of tool names used in combination
   * @param score The overall success score (0-1)
   */
  public recordToolCombination(taskType: string, toolNames: string[], score: number): void {
    try {
      if (toolNames.length < 2) return; // Need at least 2 tools to be a combination
      
      // Sort tool names for consistent combination keys
      const sortedTools = [...toolNames].sort();
      const combinationKey = sortedTools.join(',');
      
      // Get or create preference entry
      let entry = this.preferenceMap.get(taskType);
      if (!entry) {
        entry = {
          taskType,
          toolPreferences: {},
          toolCombinations: {}
        };
        this.preferenceMap.set(taskType, entry);
      }
      
      // Update combination score
      if (!entry.toolCombinations[combinationKey]) {
        entry.toolCombinations[combinationKey] = {
          score,
          trials: 1
        };
      } else {
        const current = entry.toolCombinations[combinationKey];
        // Exponential moving average
        const alpha = 0.3;
        current.score = (1 - alpha) * current.score + alpha * score;
        current.trials++;
      }
      
      this.savePreferences();
      logger.debug(`Recorded combination ${combinationKey} for task ${taskType} with score ${score.toFixed(2)}`);
    } catch (error) {
      logger.error(`Error recording tool combination: ${error}`);
    }
  }
  
  /**
   * Creates a new A/B test between two tools
   * @param taskType The task type to test
   * @param toolA First tool to test
   * @param toolB Second tool to test
   * @param contextTags Optional context tags for the test
   * @returns The created test record
   */
  public createABTest(
    taskType: string, 
    toolA: string, 
    toolB: string,
    contextTags: string[] = []
  ): ABTestRecord {
    try {
      const testId = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const test: ABTestRecord = {
        testId,
        taskType,
        toolA,
        toolB,
        contextTags,
        status: 'pending',
        startTime: new Date().toISOString()
      };
      
      this.abTests.push(test);
      this.saveABTests();
      logger.info(`Created A/B test ${testId} for task ${taskType}: ${toolA} vs ${toolB}`);
      
      return test;
    } catch (error) {
      logger.error(`Error creating A/B test: ${error}`);
      throw error;
    }
  }
  
  /**
   * Gets all active A/B tests
   * @returns Array of active test records
   */
  public getActiveABTests(): ABTestRecord[] {
    return this.abTests.filter(test => test.status === 'pending');
  }
  
  /**
   * Gets an active A/B test for a specific task type and context if available
   * @param taskType The task type
   * @param contextTags Context tags to match
   * @returns A matching test or null if none found
   */
  private getActiveABTest(taskType: string, contextTags: string[] = []): ABTestRecord | null {
    // Filter to active tests for this task type
    const matchingTests = this.abTests.filter(test => 
      test.status === 'pending' && 
      test.taskType === taskType
    );
    
    if (matchingTests.length === 0) return null;
    
    // If we have context tags, try to find a test with matching tags
    if (contextTags.length > 0) {
      for (const test of matchingTests) {
        if (test.contextTags && test.contextTags.some(tag => contextTags.includes(tag))) {
          return test;
        }
      }
    }
    
    // If no context match, just return the first active test
    return matchingTests[0];
  }
  
  /**
   * Updates A/B tests with a new result
   * @param toolName The tool that was used
   * @param taskType The task type
   * @param score The score achieved
   * @param contextTags Context tags if any
   */
  private updateABTestsWithResult(
    toolName: string, 
    taskType: string, 
    score: number,
    contextTags: string[] = []
  ): void {
    try {
      // Find active tests that match this tool and task
      const matchingTests = this.abTests.filter(test => 
        test.status === 'pending' && 
        test.taskType === taskType && 
        (test.toolA === toolName || test.toolB === toolName)
      );
      
      if (matchingTests.length === 0) return;
      
      // Update each matching test
      for (const test of matchingTests) {
        // Create a result for the other tool too, to complete the comparison
        const otherTool = test.toolA === toolName ? test.toolB : test.toolA;
        
        // Get the other tool's average score for this task type
        const entry = this.preferenceMap.get(taskType);
        const otherToolScore = entry?.toolPreferences?.[otherTool]?.overallScore || 0.5;
        
        // If this score is definitively better (20% improvement), end the test
        if (score > otherToolScore * 1.2) {
          test.status = 'completed';
          test.winner = toolName;
          test.endTime = new Date().toISOString();
          logger.info(`A/B test ${test.testId} completed: ${toolName} won over ${otherTool}`);
        }
        // If we've collected enough data points (implicit in the tool preference scores)
        // and there's still no clear winner, end the test as a draw
        else if (
          entry?.toolPreferences?.[toolName]?.trials && 
          entry?.toolPreferences?.[otherTool]?.trials && 
          entry.toolPreferences[toolName].trials > 5 && 
          entry.toolPreferences[otherTool].trials > 5
        ) {
          test.status = 'completed';
          test.winner = score > otherToolScore ? toolName : otherTool;
          test.endTime = new Date().toISOString();
          logger.info(`A/B test ${test.testId} completed with enough trials: ${test.winner} slightly better`);
        }
      }
      
      if (matchingTests.some(test => test.status === 'completed')) {
        this.saveABTests();
      }
    } catch (error) {
      logger.error(`Error updating A/B tests: ${error}`);
    }
  }
  
  /**
   * Saves preferences to disk
   */
  private savePreferences(): void {
    try {
      const data = JSON.stringify(Array.from(this.preferenceMap.values()), null, 2);
      fs.writeFileSync(this.preferencesFile, data);
    } catch (error) {
      logger.error(`Error saving tool preferences: ${error}`);
    }
  }
  
  /**
   * Saves A/B test data to disk
   */
  private saveABTests(): void {
    try {
      const data = JSON.stringify(this.abTests, null, 2);
      fs.writeFileSync(this.abTestsFile, data);
    } catch (error) {
      logger.error(`Error saving A/B test data: ${error}`);
    }
  }
}

// Singleton instance
let instance: ToolLearner | null = null;

/**
 * Get the singleton instance of ToolLearner
 */
export function getToolLearner(): ToolLearner {
  if (!instance) {
    instance = new ToolLearner();
  }
  return instance;
} 