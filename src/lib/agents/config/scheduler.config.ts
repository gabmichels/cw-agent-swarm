import { SchedulerConfig } from '../../scheduler/models/SchedulerConfig.model';

export const schedulerConfig: SchedulerConfig = {
  enabled: true,
  enableAutoScheduling: true, // Re-enabled for agent-specific schedulers with agent ID filtering
  schedulingIntervalMs: 120000, // Reduced from 60s to 2min to reduce noise
  maxConcurrentTasks: 10, // Reduced from 20 to save memory
  enableTaskPrioritization: true,
  enableTaskDependencies: true,
  enableTaskRetries: true,
  maxRetryAttempts: 3,
  enableTaskTimeouts: true,
  defaultTaskTimeoutMs: 300000,
  defaultPriority: 5,
  adaptiveScheduling: false,
  schedulingAlgorithm: 'priority',
  preemptionAggressiveness: 0.5,
  trackResourceUtilization: false, // Disabled to reduce logging
  trackDependencies: false, // Disabled to reduce logging
  enableBatching: false,
  maxBatchSize: 5,
  defaultDeadlineBufferMs: 300000,
  defaultPeriodicIntervalMs: 3600000,
  logSchedulingActivity: false, // Disabled excessive logging
  enableVisualization: false,
  resourceLimits: {
    maxCpuUtilization: 0.8,
    maxMemoryBytes: 1073741824, // Increased to 1GB to prevent OOM
    maxTokensPerMinute: 50000,
    maxApiCallsPerMinute: 100,
  },
  storage: {
    type: 'memory'
  }
}; 