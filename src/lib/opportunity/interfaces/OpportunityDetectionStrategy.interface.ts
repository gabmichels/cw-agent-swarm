/**
 * OpportunityDetectionStrategy.interface.ts
 * 
 * Defines the interfaces for different opportunity detection strategies.
 */

import { 
  OpportunitySource, 
  OpportunityTrigger 
} from '../models/opportunity.model';
import { TriggerDetectionOptions } from './OpportunityDetector.interface';

/**
 * Base configuration for all detection strategies
 */
export interface DetectionStrategyConfig {
  /** Unique ID for the strategy */
  strategyId: string;
  
  /** Whether the strategy is enabled */
  enabled: boolean;
  
  /** Minimum confidence threshold (0.0-1.0) */
  minConfidence: number;
  
  /** Strategy-specific configuration */
  strategySpecific?: Record<string, unknown>;
}

/**
 * Result of strategy-based detection
 */
export interface StrategyDetectionResult {
  /** Detected triggers */
  triggers: OpportunityTrigger[];
  
  /** Strategy that produced the result */
  strategyId: string;
  
  /** When the detection was performed */
  timestamp: Date;
  
  /** Execution metrics */
  metrics?: {
    executionTimeMs: number;
    contentSize?: number;
    patternMatchCount?: number;
  };
}

/**
 * Base interface for all opportunity detection strategies
 */
export interface OpportunityDetectionStrategy {
  /**
   * Get the unique ID of this strategy
   * @returns The strategy ID
   */
  getStrategyId(): string;
  
  /**
   * Get the source type that this strategy is designed for
   * @returns The opportunity source
   */
  getSourceType(): OpportunitySource;
  
  /**
   * Initialize the strategy
   * @param config Strategy configuration
   * @returns True if initialization was successful
   */
  initialize(config?: DetectionStrategyConfig): Promise<boolean>;
  
  /**
   * Detect triggers in content
   * @param content Content to analyze
   * @param options Detection options
   * @returns Detection result with triggers
   */
  detectTriggers(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult>;
  
  /**
   * Check if the strategy supports a given source
   * @param source Source to check
   * @returns True if supported
   */
  supportsSource(source: OpportunitySource): boolean;
  
  /**
   * Check if the strategy can handle a content type
   * @param contentType Type of content
   * @returns True if supported
   */
  supportsContentType(contentType: string): boolean;
  
  /**
   * Get the current configuration
   * @returns Strategy configuration
   */
  getConfig(): DetectionStrategyConfig;
  
  /**
   * Update strategy configuration
   * @param config New configuration
   * @returns True if updated successfully
   */
  updateConfig(config: Partial<DetectionStrategyConfig>): Promise<boolean>;
  
  /**
   * Check if strategy is enabled
   * @returns True if enabled
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the strategy
   * @param enabled Whether to enable
   * @returns True if updated successfully
   */
  setEnabled(enabled: boolean): Promise<boolean>;
}

/**
 * Interface for external source detection strategy
 * Handles opportunities from market data, news, external APIs
 */
export interface ExternalSourceStrategy extends OpportunityDetectionStrategy {
  /**
   * Configure API endpoints
   * @param endpoints Endpoint configuration
   * @returns True if updated successfully
   */
  configureEndpoints(endpoints: Record<string, string>): Promise<boolean>;
  
  /**
   * Set API authentication details
   * @param auth Authentication configuration
   * @returns True if updated successfully
   */
  setAuthentication(auth: Record<string, string>): Promise<boolean>;
  
  /**
   * Test connection to external source
   * @param source Source to test
   * @returns True if connection successful
   */
  testConnection(source: string): Promise<boolean>;
}

/**
 * Interface for memory pattern detection strategy
 * Analyzes agent memory for patterns and insights
 */
export interface MemoryPatternStrategy extends OpportunityDetectionStrategy {
  /**
   * Configure pattern types
   * @param patterns Pattern definitions
   * @returns True if updated successfully
   */
  configurePatterns(patterns: Array<{ 
    id: string;
    pattern: string | RegExp;
    confidence: number;
  }>): Promise<boolean>;
  
  /**
   * Set the maximum memory age to consider
   * @param ageMs Maximum age in milliseconds
   * @returns True if updated successfully
   */
  setMaxMemoryAge(ageMs: number): Promise<boolean>;
  
  /**
   * Analyze a specific memory collection
   * @param collectionName Memory collection to analyze
   * @param options Detection options
   * @returns Detection result
   */
  analyzeMemoryCollection(
    collectionName: string,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult>;
}

/**
 * Interface for user interaction detection strategy
 * Identifies opportunities in user conversations and requests
 */
export interface UserInteractionStrategy extends OpportunityDetectionStrategy {
  /**
   * Configure interaction types to monitor
   * @param interactionTypes Types of interactions
   * @returns True if updated successfully
   */
  configureInteractionTypes(interactionTypes: string[]): Promise<boolean>;
  
  /**
   * Configure intent recognition
   * @param intents Intent patterns
   * @returns True if updated successfully
   */
  configureIntents(intents: Array<{
    name: string;
    patterns: string[];
    examples: string[];
  }>): Promise<boolean>;
  
  /**
   * Analyze a user message
   * @param message User message
   * @param options Detection options
   * @returns Detection result
   */
  analyzeUserMessage(
    message: string,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult>;
}

/**
 * Interface for schedule-based detection strategy
 * Identifies opportunities in calendar, schedules, recurring patterns
 */
export interface ScheduleBasedStrategy extends OpportunityDetectionStrategy {
  /**
   * Configure schedule sources
   * @param sources Schedule data sources
   * @returns True if updated successfully
   */
  configureSources(sources: string[]): Promise<boolean>;
  
  /**
   * Set time window for schedule analysis
   * @param window Time window configuration
   * @returns True if updated successfully
   */
  setTimeWindow(window: {
    lookBehindMs: number;
    lookAheadMs: number;
  }): Promise<boolean>;
  
  /**
   * Analyze schedule data
   * @param scheduleData Schedule data to analyze
   * @param options Detection options
   * @returns Detection result
   */
  analyzeSchedule(
    scheduleData: Record<string, unknown>,
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult>;
}

/**
 * Interface for collaboration detection strategy
 * Identifies opportunities involving multiple agents
 */
export interface CollaborationStrategy extends OpportunityDetectionStrategy {
  /**
   * Configure collaboration patterns
   * @param patterns Collaboration patterns
   * @returns True if updated successfully
   */
  configurePatterns(patterns: Array<{
    id: string;
    agentTypes: string[];
    pattern: string;
    confidence: number;
  }>): Promise<boolean>;
  
  /**
   * Set agents to monitor
   * @param agentIds Agent IDs to monitor
   * @returns True if updated successfully
   */
  setMonitoredAgents(agentIds: string[]): Promise<boolean>;
  
  /**
   * Analyze inter-agent communication
   * @param message Message to analyze
   * @param options Detection options
   * @returns Detection result
   */
  analyzeAgentCommunication(
    message: {
      from: string;
      to: string;
      content: string;
      timestamp: Date;
    },
    options: TriggerDetectionOptions
  ): Promise<StrategyDetectionResult>;
} 