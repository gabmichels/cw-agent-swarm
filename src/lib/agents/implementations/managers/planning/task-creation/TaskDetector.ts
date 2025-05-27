/**
 * TaskDetector.ts - Task detection component
 * 
 * This component analyzes user input to detect task creation intent
 * and extract relevant task information.
 */

import { 
  TaskDetector as ITaskDetector,
  TaskDetectionResult, 
  TaskIndicator, 
  ExtractedTaskInfo,
  TaskPriority 
} from '../interfaces/TaskCreationInterfaces';

/**
 * Configuration for task detection patterns
 */
interface DetectionPatterns {
  explicitRequests: RegExp[];
  actionVerbs: string[];
  timeExpressions: RegExp[];
  urgencyMarkers: string[];
  priorityKeywords: Record<string, TaskPriority>;
}

/**
 * Default detection patterns
 */
const DEFAULT_PATTERNS: DetectionPatterns = {
  explicitRequests: [
    /create\s+(?:a\s+)?task/i,
    /add\s+(?:a\s+)?task/i,
    /make\s+(?:a\s+)?task/i,
    /set\s+up\s+(?:a\s+)?task/i,
    /schedule\s+(?:a\s+)?task/i,
    /remind\s+me\s+to/i,
    /don't\s+forget\s+to/i
  ],
  
  actionVerbs: [
    'schedule', 'create', 'set up', 'arrange', 'plan', 'organize',
    'remind', 'call', 'email', 'send', 'review', 'check', 'fix',
    'update', 'complete', 'finish', 'start', 'begin', 'prepare',
    'submit', 'deliver', 'implement', 'deploy', 'test', 'analyze'
  ],
  
  timeExpressions: [
    /\btomorrow\b/i,
    /\btonight\b/i,
    /\btoday\s+(?:at|by|before|after)\b/i, // Only match "today" when followed by time indicators
    /\b(?:next|this)\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(?:in|within)\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?)\b/i,
    /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?(?:\s+today|\s+tomorrow)?\b/i,
    /\bby\s+(?:friday|monday|tuesday|wednesday|thursday|saturday|sunday|\d{1,2}\/\d{1,2})\b/i,
    /\b(?:this|next)\s+(?:morning|afternoon|evening)\b/i,
    /\bin\s+the\s+(?:morning|afternoon|evening)\b/i,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
    /\b\d{1,2}-\d{1,2}(?:-\d{2,4})?\b/
  ],
  
  urgencyMarkers: [
    'urgent', 'URGENT', 'asap', 'ASAP', 'immediately', 'critical', 
    'emergency', 'high priority', 'important', 'rush', 'quickly',
    'right away', 'now', 'urgent!', 'critical!', 'emergency!'
  ],
  
  priorityKeywords: {
    'critical': TaskPriority.CRITICAL,
    'urgent': TaskPriority.HIGHEST,
    'high priority': TaskPriority.HIGH,
    'high-priority': TaskPriority.HIGH,
    'important': TaskPriority.HIGH,
    'normal': TaskPriority.NORMAL,
    'low priority': TaskPriority.LOW,
    'minor': TaskPriority.LOW,
    'whenever': TaskPriority.LOWEST
  }
};

/**
 * Implementation of TaskDetector interface
 */
export class TaskDetector implements ITaskDetector {
  private patterns: DetectionPatterns;

  constructor(customPatterns?: Partial<DetectionPatterns>) {
    this.patterns = {
      ...DEFAULT_PATTERNS,
      ...customPatterns
    };
  }

  /**
   * Analyze user input for task creation indicators
   */
  async detectTaskIntent(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<TaskDetectionResult> {
    if (!userInput || userInput.trim().length === 0) {
      return {
        shouldCreateTask: false,
        confidence: 0,
        indicators: [],
        reasoning: 'Empty input provided'
      };
    }

    const indicators = this.findIndicators(userInput);
    const confidence = this.calculateConfidence(indicators, userInput);
    const shouldCreateTask = confidence > 0.3; // Threshold for task creation
    
    let taskInfo: ExtractedTaskInfo | undefined;
    if (shouldCreateTask) {
      const extracted = await this.extractTaskInfo(userInput, context);
      taskInfo = extracted || undefined;
    }

    const reasoning = this.generateReasoning(indicators, confidence, shouldCreateTask);

    return {
      shouldCreateTask,
      confidence,
      indicators,
      reasoning,
      taskInfo
    };
  }

  /**
   * Extract task information from user input
   */
  async extractTaskInfo(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<ExtractedTaskInfo | null> {
    // Check if we should create a task without calling detectTaskIntent to avoid circular dependency
    const indicators = this.findIndicators(userInput);
    const confidence = this.calculateConfidence(indicators, userInput);
    const shouldCreateTask = confidence > 0.3;
    
    if (!shouldCreateTask) {
      return null;
    }

    const name = this.extractTaskName(userInput);
    const description = this.extractTaskDescription(userInput);
    const priority = this.extractPriority(userInput);
    const scheduledTime = this.extractScheduledTime(userInput);
    const isUrgent = this.detectUrgency(userInput);
    const metadata = this.extractMetadata(userInput, context);

    return {
      name,
      description,
      priority,
      scheduledTime,
      isUrgent,
      metadata
    };
  }

  /**
   * Find all task indicators in the input
   */
  private findIndicators(userInput: string): TaskIndicator[] {
    const indicators: TaskIndicator[] = [];
    const lowerInput = userInput.toLowerCase();
    const foundTypes = new Set<string>();

    // Check for explicit requests (only add the first one found)
    for (const pattern of this.patterns.explicitRequests) {
      if (foundTypes.has('explicit_request')) break;
      const match = userInput.match(pattern);
      if (match) {
        indicators.push({
          type: 'explicit_request',
          text: match[0],
          position: match.index || 0,
          confidence: 0.95
        });
        foundTypes.add('explicit_request');
      }
    }

    // Check for action verbs (only add the first one found to avoid duplicates)
    for (const verb of this.patterns.actionVerbs) {
      if (foundTypes.has('action_verb')) break;
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      const match = userInput.match(regex);
      if (match) {
        indicators.push({
          type: 'action_verb',
          text: match[0],
          position: match.index || 0,
          confidence: 0.7
        });
        foundTypes.add('action_verb');
      }
    }

    // Check for time expressions (only add the first one found)
    for (const pattern of this.patterns.timeExpressions) {
      if (foundTypes.has('time_reference')) break;
      const match = userInput.match(pattern);
      if (match) {
        indicators.push({
          type: 'time_reference',
          text: match[0],
          position: match.index || 0,
          confidence: 0.8
        });
        foundTypes.add('time_reference');
      }
    }

    // Check for urgency markers (only add the first one found)
    for (const marker of this.patterns.urgencyMarkers) {
      if (foundTypes.has('urgency_marker')) break;
      if (lowerInput.includes(marker.toLowerCase())) {
        const index = lowerInput.indexOf(marker.toLowerCase());
        // Extract the actual text from the original input to preserve case
        const actualText = userInput.substring(index, index + marker.length);
        indicators.push({
          type: 'urgency_marker',
          text: actualText,
          position: index,
          confidence: 0.9
        });
        foundTypes.add('urgency_marker');
      }
    }

    return indicators;
  }

  /**
   * Calculate confidence score based on indicators
   */
  private calculateConfidence(indicators: TaskIndicator[], userInput: string): number {
    if (indicators.length === 0) {
      return 0;
    }

    // Base confidence from indicators
    let confidence = 0;
    const weights = {
      explicit_request: 0.6,
      action_verb: 0.4,
      time_reference: 0.3,
      urgency_marker: 0.3
    };

    for (const indicator of indicators) {
      const weight = weights[indicator.type] || 0.1;
      confidence += weight * indicator.confidence;
    }

    // Boost confidence for multiple indicators
    if (indicators.length > 1) {
      confidence *= (1 + (indicators.length - 1) * 0.2);
    }

    // Penalize very short inputs
    if (userInput.length < 10) {
      confidence *= 0.7;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reasoning for the detection decision
   */
  private generateReasoning(
    indicators: TaskIndicator[], 
    confidence: number, 
    shouldCreateTask: boolean
  ): string {
    if (!shouldCreateTask) {
      return 'No clear task indicators found in the input. The text appears to be conversational or informational rather than task-oriented.';
    }

    const indicatorTypes = [...new Set(indicators.map(i => i.type))];
    const reasons: string[] = [];

    if (indicatorTypes.includes('explicit_request')) {
      reasons.push('explicit task creation request detected');
    }
    if (indicatorTypes.includes('action_verb')) {
      reasons.push('action verb indicating task activity');
    }
    if (indicatorTypes.includes('time_reference')) {
      reasons.push('time reference suggesting scheduling');
    }
    if (indicatorTypes.includes('urgency_marker')) {
      reasons.push('urgency markers indicating priority');
    }

    const reasonText = reasons.join(', ');
    return `Task creation recommended based on: ${reasonText}. Confidence: ${(confidence * 100).toFixed(1)}%`;
  }

  /**
   * Extract task name from user input
   */
  private extractTaskName(userInput: string): string {
    // Remove common prefixes
    let name = userInput
      .replace(/^(?:please\s+)?(?:create\s+(?:a\s+)?task\s+to\s+|remind\s+me\s+to\s+|i\s+need\s+to\s+|schedule\s+(?:a\s+)?)/i, '')
      .replace(/^(?:set\s+up\s+(?:a\s+)?|arrange\s+(?:a\s+)?|plan\s+(?:a\s+)?)/i, '')
      .trim();

    // Extract the main action/object
    const sentences = name.split(/[.!?]/);
    name = sentences[0].trim();

    // Limit length
    if (name.length > 100) {
      name = name.substring(0, 97) + '...';
    }

    return name || 'Untitled Task';
  }

  /**
   * Extract task description from user input
   */
  private extractTaskDescription(userInput: string): string {
    // Use the full input as description, cleaned up
    return userInput.trim();
  }

  /**
   * Extract priority from user input
   */
  private extractPriority(userInput: string): TaskPriority {
    const lowerInput = userInput.toLowerCase();
    
    for (const [keyword, priority] of Object.entries(this.patterns.priorityKeywords)) {
      if (lowerInput.includes(keyword)) {
        return priority;
      }
    }

    // Check for urgency markers that imply high priority
    for (const marker of this.patterns.urgencyMarkers) {
      if (lowerInput.includes(marker.toLowerCase())) {
        return TaskPriority.HIGH;
      }
    }

    return TaskPriority.NORMAL;
  }

  /**
   * Extract scheduled time from user input
   */
  private extractScheduledTime(userInput: string): Date | undefined {
    const now = new Date();
    
    // Simple time extraction - in a real implementation, you'd use a more sophisticated
    // natural language processing library like chrono-node
    
    // Check for "tomorrow"
    if (/\btomorrow\b/i.test(userInput)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
      return tomorrow;
    }

    // Check for "today"
    if (/\btoday\b/i.test(userInput)) {
      const today = new Date(now);
      today.setHours(now.getHours() + 1, 0, 0, 0); // Default to next hour
      return today;
    }

    // Check for specific times like "at 3 PM"
    const timeMatch = userInput.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
      
      const scheduledTime = new Date(now);
      scheduledTime.setHours(isPM && hour !== 12 ? hour + 12 : hour, minute, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      return scheduledTime;
    }

    return undefined;
  }

  /**
   * Detect if task is urgent
   */
  private detectUrgency(userInput: string): boolean {
    const lowerInput = userInput.toLowerCase();
    
    const urgentMarkers = [
      'urgent', 'asap', 'immediately', 'critical', 'emergency',
      'right away', 'now', 'urgent!', 'critical!', 'emergency!'
    ];

    return urgentMarkers.some(marker => lowerInput.includes(marker));
  }

  /**
   * Extract metadata from user input and context
   */
  private extractMetadata(userInput: string, context?: Record<string, unknown>): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Add context information
    if (context) {
      Object.assign(metadata, context);
    }

    // Extract keywords
    const keywords = this.extractKeywords(userInput);
    if (keywords.length > 0) {
      metadata.keywords = keywords;
    }

    // Extract location if mentioned
    const locationMatch = userInput.match(/\b(?:in|at)\s+(?:the\s+)?([a-zA-Z\s]+(?:room|office|building|location))/i);
    if (locationMatch) {
      metadata.location = locationMatch[1].trim();
    }

    // Extract people mentioned
    const peopleMatches = userInput.match(/\bwith\s+(?:the\s+)?([a-zA-Z\s]+(?:team|group|department))/gi);
    if (peopleMatches) {
      metadata.people = peopleMatches.map(match => match.replace(/^with\s+(?:the\s+)?/i, '').trim());
    }

    // Add original input for reference
    metadata.originalInput = userInput;
    metadata.extractedAt = new Date().toISOString();

    return metadata;
  }

  /**
   * Extract keywords from user input
   */
  private extractKeywords(userInput: string): string[] {
    const keywords: string[] = [];
    
    // Extract phrases with numbers/letters (like "Q4 report") - preserve original case
    const phrases = userInput.match(/\b[A-Z]\d+\s+\w+|\b\w+\s+(?:report|meeting|project|task|document|file)\b/gi);
    if (phrases) {
      keywords.push(...phrases); // Keep original case
    }
    
    // Simple keyword extraction - remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'need', 'to', 'please', 'create', 'task'
    ]);

    const words = userInput
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    keywords.push(...words);
    
    return [...new Set(keywords)]; // Remove duplicates
  }
} 