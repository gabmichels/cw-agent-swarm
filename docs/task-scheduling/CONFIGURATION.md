# Task Scheduling Configuration Reference

## 🔧 **Core Configuration**

### **Polling & Execution Settings**
```typescript
const schedulerConfig = {
  // Scheduling frequency
  schedulingIntervalMs: 60000,        // 1 minute (60 seconds)
  
  // Task execution limits
  maxConcurrentTasks: 5,              // Maximum tasks executing simultaneously
  defaultTaskTimeoutMs: 120000,       // 2 minutes per task timeout
  
  // Task management
  enabled: true,                      // Enable/disable the scheduler
  enableAutoScheduling: true,         // Start polling automatically
}
```

### **Priority Strategy Settings**
```typescript
const priorityConfig = {
  priorityThreshold: 7,               // Priority 7+ executes immediately
  pendingTimeMs: 30 * 60 * 1000,     // 30 minutes for aging low priority tasks
}
```

### **Agent Capacity Settings**
```typescript
const agentConfig = {
  maxCapacity: 5,                     // Max concurrent tasks per agent
  healthCheckIntervalMs: 30000,       // Health check every 30 seconds
  capacityCacheMs: 30000,             // Cache capacity info for 30 seconds
}
```

## 📊 **Registry Configuration**

### **Qdrant Settings**
```typescript
const qdrantConfig = {
  url: 'http://localhost:6333',       // Qdrant server URL
  apiKey: undefined,                  // Optional API key
  collectionName: 'tasks',            // Collection name for tasks
  
  // Caching
  cacheMaxSize: 500,                  // Max cached tasks
  cacheTtlMs: 60000,                  // Cache TTL: 1 minute
}
```

### **Batch Processing**
```typescript
const batchConfig = {
  useBatching: true,                  // Enable batch operations
  batchSize: 50,                      // Tasks per batch
}
```

## ⚡ **Performance Tuning**

### **For High Volume (100+ tasks)**
```typescript
const highVolumeConfig = {
  schedulingIntervalMs: 30000,        // Check every 30 seconds
  maxConcurrentTasks: 10,             // Higher concurrency
  cacheMaxSize: 1000,                 // Larger cache
  batchSize: 100,                     // Larger batches
}
```

### **For Low Latency**
```typescript
const lowLatencyConfig = {
  schedulingIntervalMs: 15000,        // Check every 15 seconds
  defaultTaskTimeoutMs: 60000,       // 1 minute timeout
  capacityCacheMs: 10000,             // Faster cache refresh
}
```

### **For Development**
```typescript
const devConfig = {
  schedulingIntervalMs: 60000,        // Standard 1 minute
  maxConcurrentTasks: 3,              // Lower concurrency for debugging
  priorityThreshold: 5,               // Lower threshold for testing
  pendingTimeMs: 10 * 60 * 1000,     // 10 minutes for faster testing
}
```

## 🎯 **Task Priority Guide**

| Priority | Execution | Aging Time | Approval Required | Autonomy Mode |
|----------|-----------|------------|------------------|---------------|
| 10 | ⚡ Immediate | None | ❌ No | 🤖 Autonomous |
| 9 | ⚡ Immediate | None | ❌ No | 🤖 Autonomous |
| 8 | ⚡ Immediate | None | ❌ No | 🤖 Autonomous |
| 7 | ⚡ Immediate | None | ✅ Yes | 🤝 Collaborative |
| 6 | ⏰ Aged | ~12 minutes | ✅ Yes | 🤝 Collaborative |
| 5 | ⏰ Aged | ~15 minutes | ✅ Yes | 🤝 Collaborative |
| 4 | ⏰ Aged | ~18 minutes | ✅ Yes | 🤝 Collaborative |
| 3 | ⏰ Aged | ~21 minutes | ✅ Yes | 🤝 Collaborative |
| 2 | ⏰ Aged | ~24 minutes | ✅ Yes | 🤝 Collaborative |
| 1 | ⏰ Aged | ~27 minutes | ✅ Yes | 🤝 Collaborative |

> **Aging Formula**: `baseTime * (1 - priority/10)` where baseTime = 30 minutes
> 
> **Smart Aging**: Higher priority tasks within the aging group become due faster

## 🚨 **Error Handling Configuration**

### **Retry Settings**
```typescript
const retryConfig = {
  maxRetries: 3,                      // Maximum retry attempts
  retryDelayMs: 60000,                // 1 minute between retries
  exponentialBackoff: true,           // Increase delay each retry
}
```

### **Health Monitoring**
```typescript
const healthConfig = {
  healthCheckIntervalMs: 30000,       // Check agent health every 30s
  unhealthyThresholdMs: 300000,       // 5 minutes to mark unhealthy
  degradedThresholdMs: 120000,        // 2 minutes to mark degraded
}
```

## 📈 **Monitoring Configuration**

### **Logging Levels**
```typescript
const loggingConfig = {
  level: 'info',                      // info, debug, warn, error
  enableTaskLogging: true,            // Log individual task execution
  enableMetricsLogging: true,         // Log performance metrics
  enableAgentLogging: true,           // Log agent selection/execution
}
```

### **Metrics Collection**
```typescript
const metricsConfig = {
  enableMetrics: true,                // Collect performance metrics
  metricsIntervalMs: 60000,           // Collect metrics every minute
  retentionHours: 24,                 // Keep metrics for 24 hours
}
```

## 🔐 **Security Configuration**

### **Agent Validation**
```typescript
const securityConfig = {
  requireAgentValidation: true,       // Validate agents before use
  allowedAgentTypes: ['chloe'],       // Restrict agent types
  requireHealthyAgents: true,         // Only use healthy agents
}
```

## 🌐 **Environment-Specific Configs**

### **Production**
```typescript
const productionConfig = {
  schedulingIntervalMs: 60000,        // 1 minute standard
  maxConcurrentTasks: 20,             // High concurrency
  cacheMaxSize: 2000,                 // Large cache
  enableMetrics: true,                // Full monitoring
  retryConfig: { maxRetries: 5 },     // More retry attempts
}
```

### **Development**
```typescript
const developmentConfig = {
  schedulingIntervalMs: 30000,        // Faster for testing
  maxConcurrentTasks: 3,              // Lower for debugging
  priorityThreshold: 5,               // Lower threshold
  enableTaskLogging: true,            // Verbose logging
}
```

### **Testing**
```typescript
const testConfig = {
  schedulingIntervalMs: 5000,         // Very fast for tests
  maxConcurrentTasks: 1,              // Sequential execution
  pendingTimeMs: 1000,                // Fast aging
  cacheMaxSize: 100,                  // Small cache
}
```

---

## 📝 **Configuration Example**

```typescript
import { createSchedulerManager } from '@/lib/scheduler/factories/SchedulerFactory';

const config = {
  // Core settings
  schedulingIntervalMs: 60000,        // 1 minute polling
  maxConcurrentTasks: 5,              // 5 concurrent tasks
  defaultTaskTimeoutMs: 120000,       // 2 minute timeout
  
  // Registry settings  
  registryType: 'qdrant',             // Use Qdrant storage
  qdrantUrl: 'http://localhost:6333', // Qdrant URL
  qdrantCollectionName: 'tasks',      // Collection name
  
  // Caching
  cacheMaxSize: 500,                  // Cache 500 tasks
  cacheTtlMs: 60000,                  // 1 minute cache TTL
  
  // Performance
  useBatching: true,                  // Enable batching
  batchSize: 50,                      // 50 tasks per batch
};

// Create scheduler with config
const scheduler = await createSchedulerManager(config, agent);
``` 