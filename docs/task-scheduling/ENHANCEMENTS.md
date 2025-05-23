# Task Scheduling Enhancements

## 🚀 **Capacity-Based Execution Enhancement**

### **Current Behavior**
- Priority 7+ tasks execute immediately
- Priority 6 and below must age (12-27 minutes) before execution
- Aging prevents lower priority tasks from consuming capacity

### **Proposed: Capacity-Based Strategy**

Add a new strategy that executes lower priority tasks immediately when capacity is available:

```typescript
export class CapacityBasedStrategy implements SchedulingStrategy {
  constructor(
    private capacityThreshold: number = 0.7, // Use 70% capacity before executing low-priority
    private agentRegistry: TaskAgentRegistry
  ) {}

  async isTaskDue(task: Task): Promise<boolean> {
    // Only applies to low-priority tasks (priority < 7)
    if (task.priority >= 7) return false;
    
    // Check if we have available capacity
    const totalCapacity = await this.calculateTotalCapacity();
    const currentLoad = await this.calculateCurrentLoad();
    const utilizationRatio = currentLoad / totalCapacity;
    
    // Execute low-priority tasks when under capacity threshold
    return utilizationRatio < this.capacityThreshold;
  }
}
```

### **Benefits**
- ✅ **Better resource utilization** - Don't waste capacity waiting for aging
- ✅ **Faster task completion** - Low priority tasks execute sooner
- ✅ **Flexible priority** - High priority still takes precedence
- ✅ **Configurable threshold** - Control when to use spare capacity

### **Configuration Example**
```typescript
const strategies = [
  new ExplicitTimeStrategy(),           // Scheduled tasks first
  new IntervalStrategy(),               // Recurring tasks second  
  new PriorityBasedStrategy(7, 30*60*1000), // High priority + aged tasks
  new CapacityBasedStrategy(0.6)        // Use spare capacity for low priority
];
```

### **Execution Order**
1. **Explicit time tasks** (scheduled for specific times)
2. **Interval tasks** (recurring tasks due for execution)
3. **High priority tasks** (priority 7+)
4. **Aged lower priority tasks** (12-27 minutes old)
5. **🆕 Fresh lower priority tasks** (when < 60% capacity used)

## 🎯 **Alternative Approaches**

### **Option 1: Dynamic Priority Adjustment**
```typescript
// Automatically boost priority based on system load
const adjustedPriority = basePriority + (availableCapacity * priorityBoost);
```

### **Option 2: Time-Slice Allocation**
```typescript
// Reserve capacity slots for different priority ranges
const capacityAllocation = {
  highPriority: 0.7,    // 70% for priority 7+
  mediumPriority: 0.2,  // 20% for priority 4-6
  lowPriority: 0.1      // 10% for priority 1-3
};
```

### **Option 3: Burst Execution**
```typescript
// Execute multiple low-priority tasks in burst when idle
const burstConfig = {
  idleThresholdMs: 30000,     // 30 seconds of low activity
  burstBatchSize: 10,         // Execute 10 low-priority tasks
  burstCooldownMs: 300000     // 5 minute cooldown between bursts
};
```

## 📊 **Implementation Impact Analysis**

### **Performance Considerations**
- **CPU**: Capacity calculation adds ~5ms overhead per cycle
- **Memory**: Minimal additional memory for capacity tracking
- **Network**: No additional network calls
- **Database**: Possible additional queries for load calculation

### **Configuration Matrix**

| Scenario | Priority Threshold | Capacity Threshold | Aging Time | Outcome |
|----------|-------------------|--------------------|------------|---------|
| **Aggressive** | 6 | 0.8 | 10 min | Fast execution, higher capacity usage |
| **Balanced** | 7 | 0.7 | 30 min | Current behavior + spare capacity usage |
| **Conservative** | 8 | 0.5 | 60 min | Slower execution, guaranteed capacity reserve |

### **Risk Mitigation**
- **Capacity overflow**: Monitor and alert when approaching limits
- **Priority inversion**: Ensure high-priority tasks can preempt low-priority
- **Thrashing**: Implement cooldown periods between capacity adjustments

## 🔧 **Implementation Plan**

### **Phase 1: Capacity Monitoring** (1 hour)
- Add capacity calculation to `RuntimeAgentRegistry`
- Implement real-time load tracking
- Add capacity metrics to scheduler dashboard

### **Phase 2: Capacity-Based Strategy** (2 hours)
- Implement `CapacityBasedStrategy` class
- Add configuration options for capacity thresholds
- Integrate with existing strategy chain

### **Phase 3: Testing & Optimization** (1 hour)
- Load testing with various capacity scenarios
- Performance optimization for capacity calculations
- Edge case handling (agent failures, network issues)

### **Phase 4: Monitoring & Alerts** (30 minutes)
- Add capacity utilization alerts
- Implement capacity trend analysis
- Create capacity planning dashboard

---

## 🎯 **Recommendation**

**Implement Option 1: Capacity-Based Strategy** with these settings:

```typescript
const enhancedConfig = {
  // Existing settings
  priorityThreshold: 7,           // High priority threshold
  maxPendingTimeMs: 30*60*1000,   // 30 minute aging
  
  // New capacity-based settings
  enableCapacityExecution: true,   // Enable spare capacity usage
  capacityThreshold: 0.7,         // Use spare capacity when < 70% utilized
  capacityCheckIntervalMs: 30000, // Check capacity every 30 seconds
  
  // Safety limits
  maxCapacityBurstSize: 5,        // Max 5 low-priority tasks in burst
  capacityBurstCooldownMs: 60000  // 1 minute cooldown between bursts
};
```

This would give you:
- **Immediate execution** of high priority tasks (priority 7+)
- **Capacity-aware execution** of medium priority tasks when capacity available
- **Aging fallback** ensures all tasks eventually execute
- **Safety limits** prevent capacity overload 