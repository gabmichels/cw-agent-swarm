/**
 * Advanced Configuration Manager for Tool Response Formatter Phase 5
 * 
 * Provides sophisticated configuration management with:
 * - Agent-level response style configuration
 * - User preference integration
 * - Tool category granular controls
 * - Channel-specific optimizations
 * - A/B test configuration integration
 * - Adaptive optimization based on performance data
 * 
 * Features:
 * - Hierarchical configuration system
 * - Dynamic configuration updates
 * - Performance-based adaptive tuning
 * - User preference learning
 * - Channel-specific optimizations
 */

import { createLogger } from '../../lib/logging/winston-logger';
import {
  AdvancedToolResponseConfig,
  MessagePreferences,
  PerformanceMonitoringMetrics,
  ResponseStyleType,
  ToolCategory,
  ToolResponseConfig,
  UserEngagementMetrics
} from './types';

/**
 * Advanced Configuration Manager with dynamic adaptation
 */
export class AdvancedConfigurationManager {
  private readonly logger: ReturnType<typeof createLogger>;
  private agentConfigs: Map<string, AdvancedToolResponseConfig> = new Map();
  private userPreferences: Map<string, MessagePreferences> = new Map();
  private categoryConfigs: Map<ToolCategory, Partial<ToolResponseConfig>> = new Map();
  private channelConfigs: Map<string, Partial<ToolResponseConfig>> = new Map();
  private adaptiveOptimization: Map<string, AdaptiveSettings> = new Map();
  private configurationHistory: ConfigurationChangeEntry[] = [];

  constructor() {
    this.logger = createLogger({
      moduleId: 'advanced-configuration-manager'
    });
    this.initializeDefaultConfigurations();
  }

  /**
   * Get comprehensive configuration for a specific context
   */
  async getConfiguration(
    agentId: string,
    userId: string,
    toolCategory: ToolCategory,
    channel?: string,
    abTestVariant?: string
  ): Promise<AdvancedToolResponseConfig> {
    try {
      // Start with base agent configuration
      let config = this.getAgentConfiguration(agentId);

      // Apply category-specific overrides
      config = this.applyCategoryOverrides(config, toolCategory);

      // Apply channel-specific overrides
      if (channel) {
        config = this.applyChannelOverrides(config, channel);
      }

      // Apply user preferences
      config = await this.applyUserPreferences(config, userId);

      // Apply A/B test variant overrides
      if (abTestVariant) {
        config = this.applyABTestOverrides(config, abTestVariant);
      }

      // Apply adaptive optimizations
      config = await this.applyAdaptiveOptimizations(config, agentId, toolCategory);

      this.logger.debug('Configuration resolved', {
        agentId,
        userId,
        toolCategory,
        channel,
        abTestVariant,
        finalResponseStyle: config.responseStyle
      });

      return config;

    } catch (error) {
      this.logger.error('Failed to resolve configuration', {
        agentId,
        userId,
        toolCategory,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return safe default configuration
      return this.getDefaultConfiguration();
    }
  }

  /**
   * Update agent-level configuration
   */
  async updateAgentConfiguration(
    agentId: string,
    updates: Partial<AdvancedToolResponseConfig>,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const currentConfig = this.getAgentConfiguration(agentId);
      const newConfig: AdvancedToolResponseConfig = {
        ...currentConfig,
        ...updates
      };

      // Validate configuration
      this.validateConfiguration(newConfig);

      // Store updated configuration
      this.agentConfigs.set(agentId, newConfig);

      // Record configuration change
      this.recordConfigurationChange({
        type: 'agent_config_update',
        agentId,
        changes: updates,
        updatedBy,
        reason,
        timestamp: new Date()
      });

      this.logger.info('Agent configuration updated', {
        agentId,
        updatedBy,
        reason,
        changes: Object.keys(updates)
      });

    } catch (error) {
      this.logger.error('Failed to update agent configuration', {
        agentId,
        updatedBy,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<MessagePreferences>,
    source: 'explicit' | 'learned' | 'feedback'
  ): Promise<void> {
    try {
      const currentPreferences = this.getUserPreferences(userId);
      const newPreferences: MessagePreferences = {
        ...currentPreferences,
        ...preferences
      };

      this.userPreferences.set(userId, newPreferences);

      // Record preference change
      this.recordConfigurationChange({
        type: 'user_preferences_update',
        userId,
        changes: preferences,
        source,
        timestamp: new Date()
      });

      this.logger.info('User preferences updated', {
        userId,
        source,
        changes: Object.keys(preferences)
      });

    } catch (error) {
      this.logger.error('Failed to update user preferences', {
        userId,
        source,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Learn from user engagement and update preferences automatically
   */
  async learnFromEngagement(
    userId: string,
    agentId: string,
    engagementMetrics: UserEngagementMetrics,
    responseConfig: AdvancedToolResponseConfig
  ): Promise<void> {
    try {
      if (!engagementMetrics.userFeedback) return;

      const feedback = engagementMetrics.userFeedback;
      const preferenceUpdates: Partial<MessagePreferences> = {};

      // Learn from feedback type
      switch (feedback.feedbackType) {
        case 'too_long':
          Object.assign(preferenceUpdates, {
            maxMessageLength: Math.max(
              100,
              Math.floor(responseConfig.maxResponseLength * 0.8)
            ),
            communicationStyle: 'concise' as const
          });
          break;

        case 'too_short':
          Object.assign(preferenceUpdates, {
            maxMessageLength: Math.min(
              1000,
              Math.floor(responseConfig.maxResponseLength * 1.2)
            ),
            communicationStyle: 'detailed' as const
          });
          break;

        case 'confusing':
          Object.assign(preferenceUpdates, {
            communicationStyle: 'conversational' as const
          });
          break;

        case 'perfect':
          // Reinforce current style
          if (feedback.preferredStyle) {
            // Will be applied in adaptive optimization
          }
          break;
      }

      // Learn from rating
      if (feedback.rating <= 2) {
        // Low rating - try different approach
        const currentPrefs = this.getUserPreferences(userId);
        if (currentPrefs.preferredTone === 'professional') {
          Object.assign(preferenceUpdates, {
            preferredTone: 'friendly' as const
          });
        } else if (currentPrefs.preferredTone === 'casual') {
          Object.assign(preferenceUpdates, {
            preferredTone: 'professional' as const
          });
        }
      }

      if (Object.keys(preferenceUpdates).length > 0) {
        await this.updateUserPreferences(userId, preferenceUpdates, 'learned');
      }

    } catch (error) {
      this.logger.error('Failed to learn from user engagement', {
        userId,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update adaptive optimization settings based on performance data
   */
  async updateAdaptiveOptimizations(
    agentId: string,
    toolCategory: ToolCategory,
    performanceMetrics: PerformanceMonitoringMetrics
  ): Promise<void> {
    try {
      const key = `${agentId}:${toolCategory}`;
      const currentSettings = this.adaptiveOptimization.get(key) || this.createDefaultAdaptiveSettings();

      // Analyze performance and create optimizations
      const optimizations = this.analyzePerformanceForOptimizations(performanceMetrics);

      const updatedSettings: AdaptiveSettings = {
        ...currentSettings,
        lastUpdated: new Date(),
        performanceOptimizations: {
          ...currentSettings.performanceOptimizations,
          ...optimizations
        }
      };

      this.adaptiveOptimization.set(key, updatedSettings);

      this.logger.info('Adaptive optimizations updated', {
        agentId,
        toolCategory,
        optimizations: Object.keys(optimizations)
      });

    } catch (error) {
      this.logger.error('Failed to update adaptive optimizations', {
        agentId,
        toolCategory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get configuration recommendations based on usage patterns
   */
  async getConfigurationRecommendations(
    agentId: string,
    analysisWindow: { start: Date; end: Date }
  ): Promise<ConfigurationRecommendations> {
    try {
      const recommendations: ConfigurationRecommendation[] = [];

      // Analyze configuration change history
      const changes = this.getConfigurationChangesInWindow(agentId, analysisWindow);

      // Analyze performance patterns
      const performancePatterns = await this.analyzePerformancePatterns(agentId, analysisWindow);

      // Generate recommendations based on patterns
      if (performancePatterns.averageResponseTime > 2000) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: 'Optimize response generation speed',
          description: 'Average response time exceeds 2 seconds. Consider caching optimization.',
          configChanges: {
            enableCaching: true,
            cacheTTLSeconds: 3600
          }
        });
      }

      if (performancePatterns.userSatisfactionScore < 3.5) {
        recommendations.push({
          type: 'quality',
          priority: 'high',
          title: 'Improve response quality',
          description: 'User satisfaction below target. Consider adjusting response style.',
          configChanges: {
            responseStyle: 'conversational',
            includeNextSteps: true
          }
        });
      }

      // Generate category-specific recommendations
      const categoryRecommendations = this.generateCategoryRecommendations(agentId, performancePatterns);
      recommendations.push(...categoryRecommendations);

      return {
        agentId,
        analysisWindow,
        recommendations,
        generatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to generate configuration recommendations', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get agent configuration with defaults
   */
  private getAgentConfiguration(agentId: string): AdvancedToolResponseConfig {
    return this.agentConfigs.get(agentId) || this.getDefaultConfiguration();
  }

  /**
   * Get user preferences with defaults
   */
  private getUserPreferences(userId: string): MessagePreferences {
    return this.userPreferences.get(userId) || this.getDefaultUserPreferences();
  }

  /**
   * Apply category-specific configuration overrides
   */
  private applyCategoryOverrides(
    config: AdvancedToolResponseConfig,
    category: ToolCategory
  ): AdvancedToolResponseConfig {
    const categoryOverrides = this.categoryConfigs.get(category);
    if (!categoryOverrides) return config;

    return {
      ...config,
      ...categoryOverrides,
      toolCategoryOverrides: {
        ...config.toolCategoryOverrides,
        [category]: categoryOverrides
      }
    };
  }

  /**
   * Apply channel-specific configuration overrides
   */
  private applyChannelOverrides(
    config: AdvancedToolResponseConfig,
    channel: string
  ): AdvancedToolResponseConfig {
    const channelOverrides = this.channelConfigs.get(channel);
    if (!channelOverrides) return config;

    const channelSpecificConfig = config.channelSpecificConfigs[channel];
    const mergedChannelConfig = { ...channelOverrides, ...channelSpecificConfig };

    return {
      ...config,
      ...mergedChannelConfig,
      channelSpecificConfigs: {
        ...config.channelSpecificConfigs,
        [channel]: mergedChannelConfig
      }
    };
  }

  /**
   * Apply user preferences to configuration
   */
  private async applyUserPreferences(
    config: AdvancedToolResponseConfig,
    userId: string
  ): Promise<AdvancedToolResponseConfig> {
    const userPrefs = this.getUserPreferences(userId);

    // Map user preferences to configuration
    const styleMapping: Record<string, ResponseStyleType> = {
      'professional': 'business',
      'friendly': 'conversational',
      'casual': 'casual',
      'technical': 'technical'
    };

    return {
      ...config,
      responseStyle: styleMapping[userPrefs.preferredTone] || config.responseStyle,
      maxResponseLength: Math.min(userPrefs.maxMessageLength, config.maxResponseLength),
      includeEmojis: userPrefs.enableEmojis && config.includeEmojis,
      includeMetrics: userPrefs.includeMetrics && config.includeMetrics
    };
  }

  /**
   * Apply A/B test variant overrides
   */
  private applyABTestOverrides(
    config: AdvancedToolResponseConfig,
    variantId: string
  ): AdvancedToolResponseConfig {
    // This would integrate with ABTestingFramework to get variant configuration
    // For now, return config unchanged
    return config;
  }

  /**
   * Apply adaptive optimizations
   */
  private async applyAdaptiveOptimizations(
    config: AdvancedToolResponseConfig,
    agentId: string,
    category: ToolCategory
  ): Promise<AdvancedToolResponseConfig> {
    if (!config.adaptiveOptimization) return config;

    const key = `${agentId}:${category}`;
    const adaptiveSettings = this.adaptiveOptimization.get(key);

    if (!adaptiveSettings) return config;

    // Apply performance optimizations
    const optimizations = adaptiveSettings.performanceOptimizations;

    return {
      ...config,
      enableCaching: optimizations.enableCaching ?? config.enableCaching,
      cacheTTLSeconds: optimizations.cacheTTLSeconds ?? config.cacheTTLSeconds,
      maxResponseLength: optimizations.maxResponseLength ?? config.maxResponseLength,
      qualityWeights: {
        ...config.qualityWeights,
        ...optimizations.qualityWeights
      }
    };
  }

  /**
   * Validate configuration integrity
   */
  private validateConfiguration(config: AdvancedToolResponseConfig): void {
    if (config.maxResponseLength < 50 || config.maxResponseLength > 5000) {
      throw new Error('maxResponseLength must be between 50 and 5000 characters');
    }

    if (config.cacheTTLSeconds < 0 || config.cacheTTLSeconds > 86400) {
      throw new Error('cacheTTLSeconds must be between 0 and 86400 seconds');
    }

    // Validate quality weights sum to reasonable range
    const weightsSum = Object.values(config.qualityWeights).reduce((sum, weight) => sum + weight, 0);
    if (weightsSum < 0.8 || weightsSum > 1.2) {
      this.logger.warn('Quality weights sum outside recommended range', {
        weightsSum,
        recommended: '0.8-1.2'
      });
    }
  }

  /**
   * Record configuration change for audit trail
   */
  private recordConfigurationChange(entry: ConfigurationChangeEntry): void {
    this.configurationHistory.push(entry);

    // Keep only recent history (last 1000 entries)
    if (this.configurationHistory.length > 1000) {
      this.configurationHistory = this.configurationHistory.slice(-1000);
    }
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigurations(): void {
    // Initialize category-specific defaults
    this.categoryConfigs.set(ToolCategory.WORKSPACE, {
      responseStyle: 'business',
      includeMetrics: true,
      includeNextSteps: true
    });

    this.categoryConfigs.set(ToolCategory.SOCIAL_MEDIA, {
      responseStyle: 'casual',
      includeEmojis: true,
      maxResponseLength: 400
    });

    this.categoryConfigs.set(ToolCategory.EXTERNAL_API, {
      responseStyle: 'technical',
      includeMetrics: false,
      maxResponseLength: 600
    });

    this.categoryConfigs.set(ToolCategory.WORKFLOW, {
      responseStyle: 'business',
      includeNextSteps: true,
      includeMetrics: true
    });

    this.categoryConfigs.set(ToolCategory.RESEARCH, {
      responseStyle: 'conversational',
      maxResponseLength: 800,
      includeNextSteps: true
    });

    // Initialize channel-specific defaults
    this.channelConfigs.set('slack', {
      maxResponseLength: 300,
      includeEmojis: true
    });

    this.channelConfigs.set('email', {
      maxResponseLength: 800,
      responseStyle: 'business'
    });

    this.channelConfigs.set('mobile', {
      maxResponseLength: 200,
      includeEmojis: true
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): AdvancedToolResponseConfig {
    return {
      enableLLMFormatting: true,
      maxResponseLength: 500,
      includeEmojis: false,
      includeNextSteps: true,
      includeMetrics: false,
      responseStyle: 'conversational',
      enableCaching: true,
      cacheTTLSeconds: 1800,
      toolCategoryOverrides: {},
      abTestParticipation: true,
      qualityWeights: {
        contextRelevance: 0.25,
        personaConsistency: 0.15,
        clarityScore: 0.15,
        actionabilityScore: 0.15,
        lengthOptimization: 0.10,
        emojiAppropriateness: 0.05,
        businessValueAlignment: 0.10,
        userEngagementPrediction: 0.05
      },
      adaptiveOptimization: true,
      userEngagementTracking: true,
      performanceMonitoring: true,
      customPromptTemplates: {},
      lengthOptimizationRules: {
        chatInterface: { min: 50, max: 400, optimal: 200 },
        emailSummary: { min: 100, max: 800, optimal: 400 },
        slackNotification: { min: 30, max: 300, optimal: 150 },
        mobileNotification: { min: 20, max: 200, optimal: 100 },
        dashboardUpdate: { min: 50, max: 500, optimal: 250 }
      },
      emojiPreferences: {
        enabledContexts: ['success', 'celebration'],
        maxEmojisPerResponse: 2,
        businessContextEmojis: false,
        casualContextEmojis: true,
        technicalContextEmojis: false,
        culturalSensitivity: true
      },
      channelSpecificConfigs: {}
    };
  }

  /**
   * Get default user preferences
   */
  private getDefaultUserPreferences(): MessagePreferences {
    return {
      preferredTone: 'friendly',
      maxMessageLength: 500,
      enableEmojis: false,
      includeMetrics: false,
      communicationStyle: 'conversational'
    };
  }

  /**
   * Create default adaptive settings
   */
  private createDefaultAdaptiveSettings(): AdaptiveSettings {
    return {
      lastUpdated: new Date(),
      performanceOptimizations: {},
      userPreferenceAdaptations: {},
      qualityImprovements: {}
    };
  }

  /**
   * Analyze performance metrics for optimization opportunities
   */
  private analyzePerformanceForOptimizations(
    metrics: PerformanceMonitoringMetrics
  ): Record<string, any> {
    const optimizations: Record<string, any> = {};

    // Performance-based optimizations
    if (metrics.processingStages.totalProcessingTime > 2000) {
      optimizations.enableCaching = true;
      optimizations.cacheTTLSeconds = 3600;
    }

    if (metrics.processingStages.llmGeneration > 1500) {
      optimizations.maxResponseLength = Math.max(300, metrics.processingStages.totalProcessingTime * 0.1);
    }

    return optimizations;
  }

  /**
   * Additional helper methods would be implemented here...
   */

  private getConfigurationChangesInWindow(agentId: string, window: { start: Date; end: Date }): ConfigurationChangeEntry[] {
    return this.configurationHistory.filter(entry =>
      entry.agentId === agentId &&
      entry.timestamp >= window.start &&
      entry.timestamp <= window.end
    );
  }

  private async analyzePerformancePatterns(agentId: string, window: { start: Date; end: Date }): Promise<any> {
    // Implementation for performance pattern analysis
    return {
      averageResponseTime: 1500,
      userSatisfactionScore: 4.2
    };
  }

  private generateCategoryRecommendations(agentId: string, patterns: any): ConfigurationRecommendation[] {
    // Implementation for category-specific recommendations
    return [];
  }
}

// Supporting interfaces and types

interface AdaptiveSettings {
  readonly lastUpdated: Date;
  readonly performanceOptimizations: Record<string, any>;
  readonly userPreferenceAdaptations: Record<string, any>;
  readonly qualityImprovements: Record<string, any>;
}

interface ConfigurationChangeEntry {
  readonly type: string;
  readonly agentId?: string;
  readonly userId?: string;
  readonly changes: Record<string, any>;
  readonly updatedBy?: string;
  readonly source?: string;
  readonly reason?: string;
  readonly timestamp: Date;
}

interface ConfigurationRecommendations {
  readonly agentId: string;
  readonly analysisWindow: { start: Date; end: Date };
  readonly recommendations: readonly ConfigurationRecommendation[];
  readonly generatedAt: Date;
}

interface ConfigurationRecommendation {
  readonly type: 'performance' | 'quality' | 'user_experience' | 'cost_optimization';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly configChanges: Record<string, any>;
  readonly expectedImpact?: string;
  readonly riskLevel?: 'low' | 'medium' | 'high';
} 