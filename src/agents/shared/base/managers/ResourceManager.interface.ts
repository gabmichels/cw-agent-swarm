/**
 * ResourceManager.interface.ts - Resource Manager Interface
 * 
 * This file defines the resource manager interface that provides resource management
 * and allocation for agents. It extends the base manager interface with 
 * resource-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for resource managers
 */
export interface ResourceManagerConfig extends ManagerConfig {
  /** Whether to enable resource monitoring */
  enableMonitoring?: boolean;
  
  /** Interval for resource monitoring in milliseconds */
  monitoringIntervalMs?: number;
  
  /** Resource limits */
  resourceLimits?: {
    cpu?: number;
    memory?: number;
    storage?: number;
    network?: number;
  };
  
  /** Whether to enable resource prediction */
  enablePrediction?: boolean;
  
  /** Whether to enable automatic scaling */
  enableAutoScaling?: boolean;
  
  /** Whether to enable resource optimization */
  enableOptimization?: boolean;
}

/**
 * Resource requirements structure
 */
export interface ResourceRequirements {
  /** CPU units required */
  cpu?: number;
  
  /** Memory in MB required */
  memory?: number;
  
  /** Storage in MB required */
  storage?: number;
  
  /** Network bandwidth in MB/s required */
  network?: number;
  
  /** Custom resource requirements */
  custom?: Record<string, number>;
}

/**
 * Resource allocation structure
 */
export interface ResourceAllocation {
  /** Allocated resources */
  allocated: ResourceRequirements;
  
  /** Available resources */
  available: ResourceRequirements;
  
  /** Resource utilization percentage */
  utilization: number;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsageMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Memory usage in MB */
  memoryUsage: number;
  
  /** Storage usage in MB */
  storageUsage: number;
  
  /** Network usage in MB/s */
  networkUsage: number;
  
  /** Custom resource usage */
  customUsage?: Record<string, number>;
  
  /** Timestamp of measurement */
  timestamp: Date;
}

/**
 * Resource scaling event
 */
export interface ResourceScalingEvent {
  /** Event type */
  type: 'scale_up' | 'scale_down';
  
  /** Resources affected */
  resources: string[];
  
  /** Scale factor */
  factor: number;
  
  /** Reason for scaling */
  reason: string;
  
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Resource optimization result
 */
export interface ResourceOptimizationResult {
  /** Whether optimization was successful */
  success: boolean;
  
  /** Resources optimized */
  optimizedResources: string[];
  
  /** Optimization impact */
  impact: {
    /** Resource savings */
    savings: ResourceRequirements;
    
    /** Performance impact percentage */
    performanceImpact: number;
  };
  
  /** Applied optimizations */
  appliedOptimizations: string[];
  
  /** Optimization timestamp */
  timestamp: Date;
}

/**
 * Resource manager interface
 */
export interface ResourceManager extends BaseManager {
  /**
   * Get available resources
   * @returns Promise resolving to available resources
   */
  getAvailableResources(): Promise<ResourceRequirements>;
  
  /**
   * Allocate resources
   * @param requirements Resource requirements
   * @returns Promise resolving to allocated resources
   */
  allocateResources(requirements: ResourceRequirements): Promise<ResourceRequirements>;
  
  /**
   * Release allocated resources
   * @param resources Resources to release
   * @returns Promise resolving to success
   */
  releaseResources(resources: ResourceRequirements): Promise<boolean>;
  
  /**
   * Get current resource usage
   * @returns Promise resolving to resource usage metrics
   */
  getResourceUsage(): Promise<ResourceUsageMetrics>;
  
  /**
   * Check if resources are available
   * @param requirements Resource requirements
   * @returns Promise resolving to availability status
   */
  checkResourceAvailability(requirements: ResourceRequirements): Promise<boolean>;
  
  /**
   * Reserve resources for future use
   * @param requirements Resource requirements
   * @param duration Duration in milliseconds
   * @returns Promise resolving to reservation success
   */
  reserveResources(requirements: ResourceRequirements, duration: number): Promise<boolean>;
  
  /**
   * Scale resources
   * @param resources Resources to scale
   * @param factor Scale factor
   * @returns Promise resolving to scaling event
   */
  scaleResources(resources: string[], factor: number): Promise<ResourceScalingEvent>;
  
  /**
   * Optimize resource usage
   * @param target Target resources
   * @returns Promise resolving to optimization result
   */
  optimizeResources(target: string[]): Promise<ResourceOptimizationResult>;
  
  /**
   * Get resource usage history
   * @param timeRange Optional time range
   * @returns Promise resolving to resource usage history
   */
  getResourceHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceUsageMetrics[]>;
  
  /**
   * Get resource allocation history
   * @param timeRange Optional time range
   * @returns Promise resolving to resource allocation history
   */
  getAllocationHistory(timeRange?: { start: Date; end: Date }): Promise<Array<{
    allocation: ResourceAllocation;
    timestamp: Date;
  }>>;
  
  /**
   * Get resource scaling history
   * @param timeRange Optional time range
   * @returns Promise resolving to resource scaling history
   */
  getScalingHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceScalingEvent[]>;
  
  /**
   * Get resource optimization history
   * @param timeRange Optional time range
   * @returns Promise resolving to resource optimization history
   */
  getOptimizationHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceOptimizationResult[]>;
} 