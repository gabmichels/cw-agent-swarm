/**
 * Capability Metrics Service
 * 
 * This module provides services for tracking and analyzing agent capability performance metrics
 * to enable data-driven capability optimization and agent selection.
 */

import { AnyMemoryService } from '../../../server/memory/services/memory/memory-service-wrappers';
import { MemoryType } from '../../../server/memory/config/types';
import { StructuredId, structuredIdToString } from '../../../types/structured-id';
import { v4 as uuidv4 } from 'uuid';
import { AgentCapability, CapabilityLevel } from './types';

/**
 * Capability usage record tracking a specific instance of an agent using a capability
 */
export interface CapabilityUsageRecord {
  id: string;
  agentId: string;
  capabilityId: string;
  timestamp: number;
  duration: number; // in milliseconds
  success: boolean;
  context: {
    requestId?: string;
    chatId?: string;
    taskId?: string;
  };
  performanceMetrics: {
    latency: number; // in milliseconds
    tokenCount?: number;
    confidenceScore?: number;
    qualityScore?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Capability performance metrics summarizing capability usage over time
 */
export interface CapabilityPerformanceMetrics {
  capabilityId: string;
  agentId: string;
  usageCount: number;
  successRate: number; // 0.0 to 1.0
  averageDuration: number; // in milliseconds
  averageLatency: number; // in milliseconds
  averageConfidence: number; // 0.0 to 1.0
  lastUsed: number; // timestamp
  trending: {
    usageFrequency: 'increasing' | 'decreasing' | 'stable';
    performanceDirection: 'improving' | 'degrading' | 'stable';
  };
  historicalData: {
    timeframe: string; // e.g., 'day', 'week', 'month'
    successRates: number[];
    latencies: number[];
  };
}

/**
 * Capability performance update options
 */
export interface CapabilityPerformanceUpdateOptions {
  duration: number;
  success: boolean;
  latency: number;
  tokenCount?: number;
  confidenceScore?: number;
  qualityScore?: number;
  context?: {
    requestId?: string;
    chatId?: string;
    taskId?: string;
  };
}

/**
 * Interface for the capability metrics service
 */
export interface ICapabilityMetricsService {
  /**
   * Record a capability usage event
   */
  recordCapabilityUsage(
    agentId: string | StructuredId,
    capabilityId: string,
    options: CapabilityPerformanceUpdateOptions
  ): Promise<CapabilityUsageRecord>;
  
  /**
   * Get performance metrics for a specific capability of an agent
   */
  getCapabilityPerformance(
    agentId: string | StructuredId,
    capabilityId: string
  ): Promise<CapabilityPerformanceMetrics | null>;
  
  /**
   * Get performance metrics for all capabilities of an agent
   */
  getAgentCapabilityPerformance(
    agentId: string | StructuredId
  ): Promise<CapabilityPerformanceMetrics[]>;
  
  /**
   * Get best-performing agents for a capability based on metrics
   */
  getBestPerformingAgents(
    capabilityId: string,
    limit?: number
  ): Promise<{ agentId: string; performance: CapabilityPerformanceMetrics }[]>;
  
  /**
   * Update capability level based on performance metrics
   */
  updateCapabilityLevel(
    agentId: string | StructuredId,
    capabilityId: string
  ): Promise<{
    previousLevel: CapabilityLevel;
    newLevel: CapabilityLevel;
    metrics: CapabilityPerformanceMetrics;
  } | null>;
}

// Constants for memory types
const CAPABILITY_USAGE_TYPE = 'capability_usage' as MemoryType;
const CAPABILITY_METRICS_TYPE = 'capability_metrics' as MemoryType;

/**
 * Implementation of the capability metrics service
 */
export class CapabilityMetricsService implements ICapabilityMetricsService {
  constructor(private readonly memoryService: AnyMemoryService) {}
  
  /**
   * Record a capability usage event
   */
  async recordCapabilityUsage(
    agentId: string | StructuredId,
    capabilityId: string,
    options: CapabilityPerformanceUpdateOptions
  ): Promise<CapabilityUsageRecord> {
    // Convert structured ID to string if needed
    const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
    
    // Create usage record
    const usageRecord: CapabilityUsageRecord = {
      id: uuidv4(),
      agentId: agentIdStr,
      capabilityId,
      timestamp: Date.now(),
      duration: options.duration,
      success: options.success,
      context: options.context || {},
      performanceMetrics: {
        latency: options.latency,
        tokenCount: options.tokenCount,
        confidenceScore: options.confidenceScore,
        qualityScore: options.qualityScore
      }
    };
    
    // Store usage record in memory
    await this.memoryService.addMemory({
      type: CAPABILITY_USAGE_TYPE,
      content: `${agentIdStr}:${capabilityId}:${options.success ? 'success' : 'failure'}`,
      metadata: usageRecord
    });
    
    // Update aggregated metrics
    await this.updateAggregatedMetrics(agentIdStr, capabilityId, usageRecord);
    
    return usageRecord;
  }
  
  /**
   * Get performance metrics for a specific capability of an agent
   */
  async getCapabilityPerformance(
    agentId: string | StructuredId,
    capabilityId: string
  ): Promise<CapabilityPerformanceMetrics | null> {
    // Convert structured ID to string if needed
    const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
    
    // Search for the capability metrics
    const metrics = await this.memoryService.searchMemories({
      type: CAPABILITY_METRICS_TYPE,
      filter: {
        'metadata.agentId': agentIdStr,
        'metadata.capabilityId': capabilityId
      },
      limit: 1
    });
    
    // Return null if no metrics found
    if (metrics.length === 0) {
      return null;
    }
    
    // Return the metrics
    return metrics[0].payload.metadata as unknown as CapabilityPerformanceMetrics;
  }
  
  /**
   * Get performance metrics for all capabilities of an agent
   */
  async getAgentCapabilityPerformance(
    agentId: string | StructuredId
  ): Promise<CapabilityPerformanceMetrics[]> {
    // Convert structured ID to string if needed
    const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
    
    // Search for all capability metrics for the agent
    const metrics = await this.memoryService.searchMemories({
      type: CAPABILITY_METRICS_TYPE,
      filter: {
        'metadata.agentId': agentIdStr
      }
    });
    
    // Return empty array if no metrics found
    if (metrics.length === 0) {
      return [];
    }
    
    // Map to performance metrics
    return metrics.map(m => m.payload.metadata as unknown as CapabilityPerformanceMetrics);
  }
  
  /**
   * Get best-performing agents for a capability based on metrics
   */
  async getBestPerformingAgents(
    capabilityId: string,
    limit: number = 5
  ): Promise<{ agentId: string; performance: CapabilityPerformanceMetrics }[]> {
    // Search for all metrics for the capability
    const metrics = await this.memoryService.searchMemories({
      type: CAPABILITY_METRICS_TYPE,
      filter: {
        'metadata.capabilityId': capabilityId,
        'metadata.usageCount': { $gt: 0 }
      }
    });
    
    // Return empty array if no metrics found
    if (metrics.length === 0) {
      return [];
    }
    
    // Map to performance metrics
    const performances = metrics.map(m => {
      const performanceMetrics = m.payload.metadata as unknown as CapabilityPerformanceMetrics;
      return {
        agentId: performanceMetrics.agentId,
        performance: performanceMetrics
      };
    });
    
    // Sort by success rate, then by average latency (faster is better)
    performances.sort((a, b) => {
      if (a.performance.successRate !== b.performance.successRate) {
        return b.performance.successRate - a.performance.successRate;
      }
      return a.performance.averageLatency - b.performance.averageLatency;
    });
    
    // Return top N
    return performances.slice(0, limit);
  }
  
  /**
   * Update capability level based on performance metrics
   */
  async updateCapabilityLevel(
    agentId: string | StructuredId,
    capabilityId: string
  ): Promise<{
    previousLevel: CapabilityLevel;
    newLevel: CapabilityLevel;
    metrics: CapabilityPerformanceMetrics;
  } | null> {
    // Get current metrics
    const metrics = await this.getCapabilityPerformance(agentId, capabilityId);
    if (!metrics) {
      return null;
    }
    
    // Get current capability level from registry
    const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
    const agentCapabilities = await this.memoryService.searchMemories({
      type: 'agent_capability' as MemoryType,
      filter: {
        'metadata.agentId': agentIdStr,
        'metadata.capability.capabilityId': capabilityId
      },
      limit: 1
    });
    
    if (agentCapabilities.length === 0) {
      return null;
    }
    
    // Extract capability from metadata - need to type cast since TypeScript doesn't know the shape
    const metadata = agentCapabilities[0].payload.metadata as unknown as Record<string, unknown>;
    const capability = metadata.capability as AgentCapability;
    const previousLevel = capability.level;
    
    // Determine new level based on performance metrics
    let newLevel = previousLevel;
    
    const { successRate, usageCount } = metrics;
    
    // Only update if there's a significant sample size
    if (usageCount >= 10) {
      if (successRate >= 0.95) {
        newLevel = CapabilityLevel.EXPERT;
      } else if (successRate >= 0.85) {
        newLevel = CapabilityLevel.ADVANCED;
      } else if (successRate >= 0.70) {
        newLevel = CapabilityLevel.INTERMEDIATE;
      } else {
        newLevel = CapabilityLevel.BASIC;
      }
    }
    
    // Only update if level has changed
    if (newLevel !== previousLevel) {
      // Update capability level
      capability.level = newLevel;
      
      // Update capability in memory
      await this.memoryService.updateMemory({
        type: 'agent_capability' as MemoryType,
        id: agentCapabilities[0].id,
        metadata: {
          capability
        }
      });
    }
    
    return {
      previousLevel,
      newLevel,
      metrics
    };
  }
  
  /**
   * Update aggregated metrics with a new usage record
   */
  private async updateAggregatedMetrics(
    agentId: string,
    capabilityId: string,
    usageRecord: CapabilityUsageRecord
  ): Promise<void> {
    try {
      // Find existing metrics
      const existingMetrics = await this.memoryService.searchMemories({
        type: CAPABILITY_METRICS_TYPE,
        filter: {
          'metadata.agentId': agentId,
          'metadata.capabilityId': capabilityId
        },
        limit: 1
      });
      
      let metrics: CapabilityPerformanceMetrics;
      
      if (existingMetrics.length > 0) {
        // Update existing metrics
        metrics = existingMetrics[0].payload.metadata as unknown as CapabilityPerformanceMetrics;
        
        // Update counts and rates
        const newUsageCount = metrics.usageCount + 1;
        const newSuccessCount = (metrics.successRate * metrics.usageCount) + (usageRecord.success ? 1 : 0);
        const newSuccessRate = newSuccessCount / newUsageCount;
        
        // Update durations and latencies
        const newTotalDuration = (metrics.averageDuration * metrics.usageCount) + usageRecord.duration;
        const newAverageDuration = newTotalDuration / newUsageCount;
        
        const newTotalLatency = (metrics.averageLatency * metrics.usageCount) + usageRecord.performanceMetrics.latency;
        const newAverageLatency = newTotalLatency / newUsageCount;
        
        // Update confidence if available
        let newAverageConfidence = metrics.averageConfidence;
        if (usageRecord.performanceMetrics.confidenceScore !== undefined) {
          const newTotalConfidence = (metrics.averageConfidence * metrics.usageCount) + usageRecord.performanceMetrics.confidenceScore;
          newAverageConfidence = newTotalConfidence / newUsageCount;
        }
        
        // Simple trending analysis
        const performanceDirection = 
          newSuccessRate > metrics.successRate ? 'improving' : 
          newSuccessRate < metrics.successRate ? 'degrading' : 'stable';
        
        // Update metrics object
        metrics = {
          ...metrics,
          usageCount: newUsageCount,
          successRate: newSuccessRate,
          averageDuration: newAverageDuration,
          averageLatency: newAverageLatency,
          averageConfidence: newAverageConfidence,
          lastUsed: usageRecord.timestamp,
          trending: {
            ...metrics.trending,
            performanceDirection
          }
        };
        
        // Update in memory
        await this.memoryService.updateMemory({
          type: CAPABILITY_METRICS_TYPE,
          id: existingMetrics[0].id,
          metadata: metrics
        });
      } else {
        // Create new metrics
        metrics = {
          capabilityId,
          agentId,
          usageCount: 1,
          successRate: usageRecord.success ? 1.0 : 0.0,
          averageDuration: usageRecord.duration,
          averageLatency: usageRecord.performanceMetrics.latency,
          averageConfidence: usageRecord.performanceMetrics.confidenceScore || 0.5,
          lastUsed: usageRecord.timestamp,
          trending: {
            usageFrequency: 'stable',
            performanceDirection: 'stable'
          },
          historicalData: {
            timeframe: 'day',
            successRates: [usageRecord.success ? 1.0 : 0.0],
            latencies: [usageRecord.performanceMetrics.latency]
          }
        };
        
        // Store in memory
        await this.memoryService.addMemory({
          type: CAPABILITY_METRICS_TYPE,
          content: `${agentId}:${capabilityId}:metrics`,
          metadata: metrics
        });
      }
    } catch (error) {
      console.error(`Error updating metrics for agent ${agentId}, capability ${capabilityId}:`, error);
    }
  }
} 