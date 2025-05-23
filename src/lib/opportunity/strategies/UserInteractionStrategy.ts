/**
 * UserInteractionStrategy.ts
 * 
 * Strategy for detecting opportunities in user interactions and conversations.
 */

import { 
  OpportunitySource, 
  OpportunityTrigger,
  RecognizedPattern
} from '../models/opportunity.model';

import {
  OpportunityDetectionStrategy,
  DetectionStrategyConfig,
  StrategyDetectionResult,
  UserInteractionStrategy as UserInteractionStrategyInterface
} from '../interfaces/OpportunityDetectionStrategy.interface';

import { TriggerDetectionOptions } from '../interfaces/OpportunityDetector.interface';
import { OpportunityStrategyError } from '../errors/OpportunityError';
import { ulid } from 'ulid';

/**
 * Configuration for user interaction strategy
 */
export interface UserInteractionStrategyConfig extends DetectionStrategyConfig {
  strategySpecific?: {
    interactionTypes?: string[];
    intents?: Array<{
      name: string;
      patterns: string[];
      examples: string[];
    }>;
    keywordWeights?: Record<string, number>;
    timeoutMs?: number;
  };
}

/**
 * Implementation of the UserInteractionStrategy
 */
export class BasicUserInteractionStrategy implements UserInteractionStrategyInterface {
  private config: UserInteractionStrategyConfig = {
    strategyId: 'user-interaction-strategy',
    enabled: true,
    minConfidence: 0.6,
    strategySpecific: {
      interactionTypes: ['chat', 'command', 'question', 'feedback'],
      intents: [],
      keywordWeights: {
        'help': 0.8,
        'need': 0.7,
        'issue': 0.7,
        'problem': 0.8,
        'error': 0.8,
        'broken': 0.8,
        'fix': 0.7,
        'can\'t': 0.6,
        'failed': 0.7,
        'optimize': 0.7,
        'improve': 0.7,
        'suggestion': 0.6,
        'better': 0.6,
        'automate': 0.8,
        'slow': 0.6,
        'faster': 0.7,
        'schedule': 0.7,
        'remind': 0.7,
        'create': 0.6
      },
      timeoutMs: 3000
    }
  };
  
  private initialized: boolean = false;
  
  /**
   * Get the unique ID of this strategy
   */
  getStrategyId(): string {
    return this.config.strategyId;
  }
  
  /**
   * Get the source type that this strategy is designed for
   */
  getSourceType(): OpportunitySource {
    return OpportunitySource.USER_INTERACTION;
  }
  
  /**
   * Initialize the strategy
   */
  async initialize(config?: DetectionStrategyConfig): Promise<boolean> {
    if (config) {
      this.config = {
        ...this.config,
        ...config,
        strategySpecific: {
          ...this.config.strategySpecific,
          ...(config.strategySpecific as Record<string, unknown>)
        }
      };
    }
    
    // Validate configuration
    if (!this.config.strategyId) {
      throw new OpportunityStrategyError(
        'Strategy ID is required',
        'MISSING_STRATEGY_ID',
        { config: this.config }
      );
    }
    
    // Initialize intents if not already populated
    if (!this.config.strategySpecific?.intents?.length) {
      this.config.strategySpecific = {
        ...this.config.strategySpecific,
        intents: this.getDefaultIntents()
      };
    }
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Get default intents for common user assistance scenarios
   */
  private getDefaultIntents(): Array<{
    name: string;
    patterns: string[];
    examples: string[];
  }> {
    return [
      {
        name: 'need_help',
        patterns: [
          '(?:I )?need help(?: with)?',
          'help me(?: with)?',
          'can you (help|assist)',
          'how (can|do) I',
          'struggling with',
          'having (trouble|difficulty|a problem)',
          'not sure how to'
        ],
        examples: [
          'I need help with this task',
          'Can you help me understand this?',
          'I\'m having trouble with the configuration',
          'Not sure how to proceed'
        ]
      },
      {
        name: 'report_issue',
        patterns: [
          'not working',
          'doesn\'t work',
          'isn\'t working',
          'broken',
          'error',
          'issue',
          'bug',
          'problem',
          'failed',
          'failing',
          'crashes',
          'unexpected'
        ],
        examples: [
          'The application is not working',
          'I\'m getting an error when I try to save',
          'There\'s a problem with the login page',
          'It crashes whenever I click that button'
        ]
      },
      {
        name: 'request_optimization',
        patterns: [
          'too slow',
          'make (it|this) faster',
          'optimize',
          'improve',
          'more efficient',
          'takes too (long|much time)',
          'speed up',
          'performance issue'
        ],
        examples: [
          'The process is too slow',
          'Can you make this faster?',
          'I need to optimize this workflow',
          'Is there a more efficient way?'
        ]
      },
      {
        name: 'scheduling_request',
        patterns: [
          'schedule',
          'remind me',
          'set up a',
          'create a (meeting|appointment|event)',
          'when (is|should|can)',
          'plan',
          'calendar',
          'availability',
          'book'
        ],
        examples: [
          'Can you schedule a meeting?',
          'Remind me to follow up tomorrow',
          'Set up a weekly check-in',
          'When should we do this?'
        ]
      },
      {
        name: 'automation_opportunity',
        patterns: [
          'automate',
          'repetitive',
          'every (day|week|time)',
          'constantly',
          'always having to',
          'do this (manually|over and over)',
          'streamline'
        ],
        examples: [
          'Can we automate this process?',
          'I\'m tired of doing this manually',
          'I have to do this every day',
          'This is a repetitive task'
        ]
      }
    ];
  }
  
  /**
   * Detect triggers in content
   */
  async detectTriggers(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.isEnabled()) {
      return {
        triggers: [],
        strategyId: this.getStrategyId(),
        timestamp: new Date(),
        metrics: {
          executionTimeMs: 0,
          contentSize: content.length
        }
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Set a timeout for detection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new OpportunityStrategyError(
            'Detection timeout',
            'DETECTION_TIMEOUT',
            { timeoutMs: this.config.strategySpecific?.timeoutMs }
          ));
        }, this.config.strategySpecific?.timeoutMs || 3000);
      });
      
      const detectionPromise = this.performDetection(content, options);
      const triggers = await Promise.race([detectionPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      
      return {
        triggers,
        strategyId: this.getStrategyId(),
        timestamp: new Date(),
        metrics: {
          executionTimeMs: executionTime,
          contentSize: content.length,
          patternMatchCount: triggers.length
        }
      };
    } catch (error) {
      throw new OpportunityStrategyError(
        error instanceof Error ? error.message : String(error),
        'DETECTION_ERROR',
        { content: content.substring(0, 100) + '...' }
      );
    }
  }
  
  /**
   * Perform the actual detection logic
   */
  private async performDetection(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityTrigger[]> {
    const triggers: OpportunityTrigger[] = [];
    const lowerContent = content.toLowerCase();
    
    // Check for intent matches
    const intents = this.config.strategySpecific?.intents || [];
    const recognizedIntents: Array<{
      name: string;
      confidence: number;
      matches: string[];
    }> = [];
    
    for (const intent of intents) {
      const matches: string[] = [];
      let intentConfidence = 0;
      
      for (const pattern of intent.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          const match = lowerContent.match(regex);
          
          if (match) {
            matches.push(match[0]);
            intentConfidence += 0.2; // Each pattern match increases confidence
          }
        } catch (error) {
          // Skip invalid regex patterns
          continue;
        }
      }
      
      // Cap confidence at 0.9
      intentConfidence = Math.min(0.9, intentConfidence);
      
      if (matches.length > 0 && intentConfidence >= (options.minConfidence || this.config.minConfidence)) {
        recognizedIntents.push({
          name: intent.name,
          confidence: intentConfidence,
          matches
        });
      }
    }
    
    // Check for keyword matches
    const keywordWeights = this.config.strategySpecific?.keywordWeights || {};
    const keywords: Record<string, number> = {};
    let keywordConfidence = 0;
    
    for (const [keyword, weight] of Object.entries(keywordWeights)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      const matchCount = (lowerContent.match(new RegExp(regex, 'gi')) || []).length;
      
      if (matchCount > 0) {
        keywords[keyword] = matchCount;
        keywordConfidence += weight * Math.min(1, matchCount * 0.5); // Diminishing returns for multiple occurrences
      }
    }
    
    // Cap confidence at 0.95
    keywordConfidence = Math.min(0.95, keywordConfidence);
    
    // Create triggers from recognized intents
    for (const intent of recognizedIntents) {
      // Skip if below confidence threshold
      if (intent.confidence < (options.minConfidence || this.config.minConfidence)) {
        continue;
      }
      
      // Create recognized patterns
      const patterns: RecognizedPattern[] = intent.matches.map(match => ({
        type: 'intent',
        description: `Intent '${intent.name}' detected: ${match}`,
        source: 'user-interaction',
        confidence: intent.confidence,
        keywords: intent.matches
      }));
      
      triggers.push({
        id: ulid(),
        type: `intent_${intent.name}`,
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: content.substring(0, 500), // Limit content length
        confidence: intent.confidence,
        patterns,
        context: {
          ...options.context || {},
          intentName: intent.name,
          matches: intent.matches
        }
      });
    }
    
    // Create trigger from keyword matches if confidence is high enough
    if (keywordConfidence >= (options.minConfidence || this.config.minConfidence)) {
      const keywordList = Object.keys(keywords);
      
      // Create recognized patterns
      const patterns: RecognizedPattern[] = keywordList.map(keyword => ({
        type: 'keyword',
        description: `Keyword '${keyword}' detected`,
        source: 'user-interaction',
        confidence: keywordWeights[keyword] || 0.5,
        keywords: [keyword]
      }));
      
      triggers.push({
        id: ulid(),
        type: 'keyword_group',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: content.substring(0, 500), // Limit content length
        confidence: keywordConfidence,
        patterns,
        context: {
          ...options.context || {},
          keywords,
          keywordCount: Object.keys(keywords).length
        }
      });
    }
    
    return triggers;
  }
  
  /**
   * Check if the strategy supports a given source
   */
  supportsSource(source: OpportunitySource): boolean {
    return source === OpportunitySource.USER_INTERACTION;
  }
  
  /**
   * Check if the strategy can handle a content type
   */
  supportsContentType(contentType: string): boolean {
    return ['text', 'chat', 'message', 'question', 'command'].includes(contentType.toLowerCase());
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): DetectionStrategyConfig {
    return this.config;
  }
  
  /**
   * Update strategy configuration
   */
  async updateConfig(config: Partial<DetectionStrategyConfig>): Promise<boolean> {
    this.config = {
      ...this.config,
      ...config,
      strategySpecific: {
        ...this.config.strategySpecific,
        ...(config.strategySpecific as Record<string, unknown>)
      }
    };
    
    return true;
  }
  
  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Enable or disable the strategy
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    this.config.enabled = enabled;
    return true;
  }
  
  /**
   * Configure interaction types to monitor
   */
  async configureInteractionTypes(interactionTypes: string[]): Promise<boolean> {
    if (!this.config.strategySpecific) {
      this.config.strategySpecific = {};
    }
    
    this.config.strategySpecific.interactionTypes = interactionTypes;
    return true;
  }
  
  /**
   * Configure intent recognition
   */
  async configureIntents(intents: Array<{
    name: string;
    patterns: string[];
    examples: string[];
  }>): Promise<boolean> {
    if (!this.config.strategySpecific) {
      this.config.strategySpecific = {};
    }
    
    this.config.strategySpecific.intents = intents;
    return true;
  }
  
  /**
   * Analyze a user message
   */
  async analyzeUserMessage(
    message: string,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult> {
    return this.detectTriggers(message, options);
  }
} 