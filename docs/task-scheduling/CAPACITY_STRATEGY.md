# Capacity-Based Strategy Implementation

## 🚀 **Overview**

The **CapacityBasedStrategy** is a new scheduling strategy that executes lower priority tasks immediately when system capacity is available, improving resource utilization while respecting priority ordering.

## 🎯 **How It Works**

### **Strategy Logic**
```typescript
// Only applies to low-priority, pending tasks without explicit scheduling
const applies = (
  task.status === TaskStatus.PENDING &&
  task.priority < 7 &&                    // Below high-priority threshold
  task.scheduledTime === undefined &&     // No explicit schedule
  task.scheduleType !== TaskScheduleType.INTERVAL  // Not recurring
);

// Execute when utilization is below capacity threshold
const isDue = utilizationRatio < 0.7;    // Default 70% threshold
```

### **Capacity Calculation**
The strategy calculates system-wide capacity utilization by:

1. **Agent Discovery**: Gets all available agents from the agent registry
2. **Capacity Aggregation**: Sums `maxCapacity` and `currentLoad` across all agents
3. **Utilization Ratio**: `currentLoad / totalCapacity`
4. **Threshold Check**: Execute tasks when ratio < 70% (configurable)

### **Caching**
- **Cache TTL**: 30 seconds (configurable)
- **Purpose**: Avoid expensive capacity calculations on every task evaluation
- **Cache Keys**: `totalCapacity`, `currentLoad`, `lastUpdated`

## ⚙️ **Configuration**

### **Default Settings**
```typescript
const capacityStrategy = new CapacityBasedStrategy(
  agentRegistry,          // TaskAgentRegistry instance
  0.7,                   // 70% capacity threshold
  7                      // Priority threshold (tasks < 7 are low-priority)
);
```

### **Configuration Options**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `agentRegistry` | TaskAgentRegistry | Required | Registry for agent capacity info |
| `capacityThreshold` | number | 0.7 | Utilization threshold (0-1) |
| `lowPriorityThreshold` | number | 7 | Priority below which tasks are low-priority |

### **Runtime Configuration**
```typescript
// Update capacity threshold
capacityStrategy.updateCapacityThreshold(0.6);  // 60% threshold

// Clear cache to force recalculation
capacityStrategy.clearCapacityCache();

// Get current capacity statistics
const stats = await capacityStrategy.getCapacityStats();
```

## 📊 **Integration with Scheduler**

### **Strategy Chain Order**
The CapacityBasedStrategy is added to the scheduling chain as the 4th strategy:

```typescript
const strategies = [
  new ExplicitTimeStrategy(),     // 1. Scheduled tasks first
  new IntervalStrategy(),         // 2. Recurring tasks second
  new PriorityBasedStrategy(),    // 3. High priority + aged tasks
  new CapacityBasedStrategy()     // 4. 🆕 Low priority with spare capacity
];
```

### **Execution Order**
Tasks are evaluated and executed in this order:

1. **Explicit Time Tasks**: Tasks scheduled for specific times
2. **Interval Tasks**: Recurring tasks due for execution
3. **High Priority Tasks**: Priority 7+ execute immediately
4. **Aged Low Priority Tasks**: Priority < 7 that have aged 30+ minutes
5. **🆕 Fresh Low Priority Tasks**: Priority < 7 when < 70% capacity used

## 📈 **Benefits**

### **Resource Efficiency**
- ✅ **Better utilization**: Don't waste capacity waiting for task aging
- ✅ **Faster completion**: Low priority tasks execute sooner when possible
- ✅ **Flexible scaling**: Automatically adjusts to system load

### **Priority Respect**
- ✅ **High priority first**: Priority 7+ always takes precedence
- ✅ **Aging fallback**: All tasks eventually execute via aging mechanism
- ✅ **Capacity protection**: Prevents overload with configurable thresholds

### **Performance**
- ✅ **Cached calculations**: 30-second TTL reduces computational overhead
- ✅ **Smart evaluation**: Only applies to relevant task types
- ✅ **Error handling**: Conservative approach on calculation failures

## 🔍 **Monitoring**

### **Capacity Statistics**
```typescript
const stats = await capacityStrategy.getCapacityStats();

console.log(stats);
// Output:
{
  strategyId: "capacity-strategy-01J8...",
  capacityThreshold: 0.7,
  lowPriorityThreshold: 7,
  totalCapacity: 25,
  currentLoad: 12,
  utilizationRatio: 0.48,
  availableCapacity: 13,
  canExecuteLowPriority: true,
  cacheLastUpdated: "2024-01-15T10:30:00.000Z",
  cacheTtlMs: 30000
}
```

### **Logging**
The strategy provides detailed logging for:
- Task evaluation decisions
- Capacity calculations
- Cache operations
- Error handling

```typescript
// Example log output
[INFO] CapacityBasedStrategy: Task approved for capacity-based execution
{
  taskId: "task_123",
  taskPriority: 5,
  utilizationRatio: 0.48,
  capacityThreshold: 0.7
}
```

## 🛠 **Troubleshooting**

### **Common Issues**

**1. Tasks Not Executing Despite Spare Capacity**
- Check if tasks meet criteria (priority < 7, no explicit schedule, pending status)
- Verify agent registry is returning accurate capacity info
- Check cache TTL - may need to wait 30 seconds for fresh calculation

**2. Capacity Calculation Errors**
- Ensure agent registry is properly configured
- Verify agents implement required capacity methods
- Check network connectivity to agent services

**3. Performance Issues**
- Monitor cache hit rate
- Consider increasing cache TTL for stable systems
- Review agent capacity calculation efficiency

### **Debug Commands**
```typescript
// Force cache refresh
capacityStrategy.clearCapacityCache();

// Get detailed capacity breakdown
const stats = await capacityStrategy.getCapacityStats();

// Check if strategy applies to a specific task
const applies = capacityStrategy.appliesTo(task);

// Check if task is due
const isDue = await capacityStrategy.isTaskDue(task);
```

## 🔮 **Future Enhancements**

### **Planned Features**
- **Burst Execution**: Execute multiple low-priority tasks when idle
- **Predictive Capacity**: Use historical data to predict capacity availability
- **Agent-Specific Thresholds**: Different capacity thresholds per agent type
- **Priority Adjustment**: Dynamic priority boost based on capacity availability

### **Configuration Examples**

**Conservative Settings** (high capacity reserve):
```typescript
new CapacityBasedStrategy(agentRegistry, 0.5, 8)  // 50% threshold, priority 8+
```

**Aggressive Settings** (maximum utilization):
```typescript
new CapacityBasedStrategy(agentRegistry, 0.9, 6)  // 90% threshold, priority 6+
```

**Development Settings** (frequent execution):
```typescript
const strategy = new CapacityBasedStrategy(agentRegistry, 0.7, 5);
strategy.capacityCache.ttlMs = 10000;  // 10-second cache for testing
```

---

## 📋 **Summary**

The CapacityBasedStrategy enhances the task scheduling system by:

- **Improving resource utilization** through intelligent spare capacity usage
- **Maintaining priority order** while enabling faster low-priority execution
- **Providing configurable thresholds** for different operational environments
- **Offering comprehensive monitoring** for capacity planning and optimization

This strategy works seamlessly with existing scheduling strategies, providing an additional layer of intelligence to maximize system efficiency. 