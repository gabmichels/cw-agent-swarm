/**
 * PriorityAnalyzer.ts - Task priority analysis component
 * 
 * This component analyzes user input to determine appropriate task priority
 * based on keywords, context, and user patterns.
 */

import { 
  PriorityAnalyzer as IPriorityAnalyzer,
  PriorityAnalysisOptions,
  PriorityAnalysisResult,
  PriorityFactor,
  TaskPriority 
} from '../interfaces/TaskCreationInterfaces';

/**
 * Priority keyword mappings
 */
const PRIORITY_KEYWORDS: Record<string, { priority: TaskPriority; weight: number }> = {
  'critical': { priority: TaskPriority.CRITICAL, weight: 1.0 },
  'urgent': { priority: TaskPriority.HIGHEST, weight: 0.9 },
  'asap': { priority: TaskPriority.HIGHEST, weight: 0.9 },
  'immediately': { priority: TaskPriority.HIGHEST, weight: 0.9 },
  'emergency': { priority: TaskPriority.CRITICAL, weight: 1.0 },
  'high priority': { priority: TaskPriority.HIGH, weight: 0.8 },
  'high-priority': { priority: TaskPriority.HIGH, weight: 0.8 },
  'important': { priority: TaskPriority.HIGH, weight: 0.7 },
  'rush': { priority: TaskPriority.HIGH, weight: 0.7 },
  'quickly': { priority: TaskPriority.HIGH, weight: 0.6 },
  'normal': { priority: TaskPriority.NORMAL, weight: 0.5 },
  'low priority': { priority: TaskPriority.LOW, weight: 0.3 },
  'low-priority': { priority: TaskPriority.LOW, weight: 0.3 },
  'minor': { priority: TaskPriority.LOW, weight: 0.3 },
  'whenever': { priority: TaskPriority.LOWEST, weight: 0.2 },
  'someday': { priority: TaskPriority.LOWEST, weight: 0.2 }
};

/**
 * Time-based priority adjustments
 */
const TIME_PRIORITY_ADJUSTMENTS: Record<string, number> = {
  'now': 0.3,
  'today': 0.2,
  'tomorrow': 0.1,
  'this week': 0.05,
  'next week': -0.05,
  'this month': -0.1,
  'next month': -0.2
};

/**
 * Implementation of PriorityAnalyzer interface
 */
export class PriorityAnalyzer implements IPriorityAnalyzer {
  
  /**
   * Analyze user input to determine task priority
   */
  async analyzePriority(
    userInput: string,
    options?: PriorityAnalysisOptions
  ): Promise<PriorityAnalysisResult> {
    const factors: PriorityFactor[] = [];
    let basePriority = TaskPriority.NORMAL;
    let confidence = 0.5; // Default confidence
    let isUrgent = false;

    // Analyze explicit priority keywords
    const keywordAnalysis = this.analyzeKeywords(userInput);
    if (keywordAnalysis.factor) {
      factors.push(keywordAnalysis.factor);
      basePriority = keywordAnalysis.priority;
      confidence = Math.max(confidence, keywordAnalysis.confidence);
      isUrgent = isUrgent || keywordAnalysis.isUrgent;
    }

    // Analyze time constraints
    const timeAnalysis = this.analyzeTimeConstraints(userInput);
    if (timeAnalysis.factor) {
      factors.push(timeAnalysis.factor);
      // Adjust priority based on time constraints
      const adjustment = timeAnalysis.adjustment;
      if (adjustment > 0) {
        basePriority = Math.min(TaskPriority.CRITICAL, basePriority + Math.floor(adjustment * 3));
      } else if (adjustment < 0) {
        basePriority = Math.max(TaskPriority.LOWEST, basePriority + Math.ceil(adjustment * 3));
      }
      confidence = Math.max(confidence, timeAnalysis.confidence);
    }

    // Analyze context patterns
    if (options?.conversationContext) {
      const contextAnalysis = this.analyzeContext(options.conversationContext);
      if (contextAnalysis.factor) {
        factors.push(contextAnalysis.factor);
        confidence = Math.max(confidence, contextAnalysis.confidence);
      }
    }

    // Apply user priority patterns
    if (options?.userPriorityPatterns) {
      const patternAnalysis = this.analyzeUserPatterns(userInput, options.userPriorityPatterns);
      if (patternAnalysis.factor) {
        factors.push(patternAnalysis.factor);
        basePriority = patternAnalysis.priority;
        confidence = Math.max(confidence, patternAnalysis.confidence);
      }
    }

    // Apply time-based adjustments if enabled
    if (options?.timeBasedAdjustments) {
      const timeAdjustment = this.getTimeBasedAdjustment();
      if (timeAdjustment.factor) {
        factors.push(timeAdjustment.factor);
        confidence = Math.max(confidence, timeAdjustment.confidence);
      }
    }

    // Ensure priority is within valid range
    const finalPriority = Math.max(TaskPriority.LOWEST, Math.min(TaskPriority.CRITICAL, basePriority));

    return {
      priority: finalPriority,
      confidence,
      factors,
      isUrgent
    };
  }

  /**
   * Determine if task is urgent based on input
   */
  async detectUrgency(userInput: string): Promise<boolean> {
    const urgentKeywords = [
      'urgent', 'asap', 'immediately', 'critical', 'emergency',
      'right away', 'now', 'urgent!', 'critical!', 'emergency!'
    ];

    const lowerInput = userInput.toLowerCase();
    return urgentKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Analyze priority keywords in user input
   */
  private analyzeKeywords(userInput: string): {
    factor?: PriorityFactor;
    priority: TaskPriority;
    confidence: number;
    isUrgent: boolean;
  } {
    const lowerInput = userInput.toLowerCase();
    let bestMatch: { keyword: string; priority: TaskPriority; weight: number } | null = null;

    // Find the highest priority keyword
    for (const [keyword, config] of Object.entries(PRIORITY_KEYWORDS)) {
      if (lowerInput.includes(keyword)) {
        if (!bestMatch || config.weight > bestMatch.weight) {
          bestMatch = { keyword, priority: config.priority, weight: config.weight };
        }
      }
    }

    if (bestMatch) {
      const isUrgent = ['critical', 'urgent', 'asap', 'immediately', 'emergency'].includes(bestMatch.keyword);
      
      return {
        factor: {
          type: 'keyword',
          description: `Priority keyword "${bestMatch.keyword}" detected`,
          impact: bestMatch.weight,
          confidence: bestMatch.weight
        },
        priority: bestMatch.priority,
        confidence: bestMatch.weight,
        isUrgent
      };
    }

    return {
      priority: TaskPriority.NORMAL,
      confidence: 0.5,
      isUrgent: false
    };
  }

  /**
   * Analyze time constraints for priority implications
   */
  private analyzeTimeConstraints(userInput: string): {
    factor?: PriorityFactor;
    adjustment: number;
    confidence: number;
  } {
    const lowerInput = userInput.toLowerCase();
    let bestMatch: { phrase: string; adjustment: number } | null = null;

    for (const [phrase, adjustment] of Object.entries(TIME_PRIORITY_ADJUSTMENTS)) {
      if (lowerInput.includes(phrase)) {
        if (!bestMatch || Math.abs(adjustment) > Math.abs(bestMatch.adjustment)) {
          bestMatch = { phrase, adjustment };
        }
      }
    }

    if (bestMatch) {
      return {
        factor: {
          type: 'time_constraint',
          description: `Time constraint "${bestMatch.phrase}" affects priority`,
          impact: bestMatch.adjustment,
          confidence: 0.7
        },
        adjustment: bestMatch.adjustment,
        confidence: 0.7
      };
    }

    return {
      adjustment: 0,
      confidence: 0
    };
  }

  /**
   * Analyze conversation context for priority hints
   */
  private analyzeContext(conversationContext: string[]): {
    factor?: PriorityFactor;
    confidence: number;
  } {
    // Simple context analysis - look for priority indicators in recent messages
    const recentMessages = conversationContext.slice(-3); // Last 3 messages
    const contextText = recentMessages.join(' ').toLowerCase();

    const priorityIndicators = ['urgent', 'important', 'critical', 'asap', 'rush'];
    const foundIndicators = priorityIndicators.filter(indicator => 
      contextText.includes(indicator)
    );

    if (foundIndicators.length > 0) {
      return {
        factor: {
          type: 'context',
          description: `Context suggests elevated priority (found: ${foundIndicators.join(', ')})`,
          impact: 0.3,
          confidence: 0.6
        },
        confidence: 0.6
      };
    }

    return { confidence: 0 };
  }

  /**
   * Analyze user priority patterns
   */
  private analyzeUserPatterns(
    userInput: string,
    userPriorityPatterns: Record<string, TaskPriority>
  ): {
    factor?: PriorityFactor;
    priority: TaskPriority;
    confidence: number;
  } {
    const lowerInput = userInput.toLowerCase();
    
    for (const [pattern, priority] of Object.entries(userPriorityPatterns)) {
      if (lowerInput.includes(pattern.toLowerCase())) {
        return {
          factor: {
            type: 'user_pattern',
            description: `User pattern "${pattern}" suggests priority ${priority}`,
            impact: 0.8,
            confidence: 0.8
          },
          priority,
          confidence: 0.8
        };
      }
    }

    return {
      priority: TaskPriority.NORMAL,
      confidence: 0
    };
  }

  /**
   * Get time-based priority adjustment (e.g., end of day, week, etc.)
   */
  private getTimeBasedAdjustment(): {
    factor?: PriorityFactor;
    confidence: number;
  } {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // End of business day (after 5 PM) - slightly higher priority
    if (hour >= 17 && hour < 22) {
      return {
        factor: {
          type: 'time_constraint',
          description: 'End of business day - elevated priority',
          impact: 0.1,
          confidence: 0.5
        },
        confidence: 0.5
      };
    }

    // Friday afternoon - higher priority for week completion
    if (dayOfWeek === 5 && hour >= 14) {
      return {
        factor: {
          type: 'time_constraint',
          description: 'Friday afternoon - elevated priority for week completion',
          impact: 0.2,
          confidence: 0.6
        },
        confidence: 0.6
      };
    }

    return { confidence: 0 };
  }
} 