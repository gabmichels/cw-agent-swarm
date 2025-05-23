/**
 * BasicOpportunityDetector.ts
 * 
 * A basic implementation of the OpportunityDetector interface
 */

import { 
  OpportunityDetector, 
  OpportunityDetectorConfig, 
  TriggerDetectionOptions, 
  OpportunityDetectionResult 
} from '../interfaces/OpportunityDetector.interface';
import { OpportunityTrigger } from '../models/opportunity.model';

/**
 * Basic implementation of OpportunityDetector
 */
export class BasicOpportunityDetector implements OpportunityDetector {
  private initialized = false;
  private enabledStrategies: string[] = [];
  
  /**
   * Initialize the detector
   */
  async initialize(config?: OpportunityDetectorConfig): Promise<boolean> {
    this.initialized = true;
    this.enabledStrategies = config?.enabledStrategies || [];
    return true;
  }
  
  /**
   * Detect triggers in content
   */
  async detectTriggers(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityTrigger[]> {
    // Stub implementation
    return [];
  }
  
  /**
   * Detect opportunities from triggers
   */
  async detectOpportunities(
    triggers: OpportunityTrigger[],
    agentId: string
  ): Promise<OpportunityDetectionResult> {
    return {
      opportunities: [],
      timestamp: new Date(),
      source: 'basic-detector',
      triggerCount: triggers.length,
      successfulDetections: 0,
      stats: {
        executionTimeMs: 10,
        memoryUsageBytes: 0
      }
    };
  }
  
  /**
   * Perform a complete detection cycle
   */
  async detectOpportunitiesFromContent(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityDetectionResult> {
    const triggers = await this.detectTriggers(content, options);
    return this.detectOpportunities(triggers, options.agentId);
  }
  
  /**
   * Register a new detection strategy
   */
  async registerStrategy(strategyId: string, strategy: unknown): Promise<boolean> {
    this.enabledStrategies.push(strategyId);
    return true;
  }
  
  /**
   * Get all available detection strategies
   */
  async getAvailableStrategies(): Promise<string[]> {
    return this.enabledStrategies;
  }
  
  /**
   * Enable or disable a detection strategy
   */
  async setStrategyEnabled(strategyId: string, enabled: boolean): Promise<boolean> {
    if (enabled && !this.enabledStrategies.includes(strategyId)) {
      this.enabledStrategies.push(strategyId);
    } else if (!enabled) {
      this.enabledStrategies = this.enabledStrategies.filter(id => id !== strategyId);
    }
    return true;
  }
  
  /**
   * Get health status
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    return {
      isHealthy: this.initialized,
      lastCheck: new Date(),
      details: {
        strategiesEnabled: this.enabledStrategies.length
      }
    };
  }
} 