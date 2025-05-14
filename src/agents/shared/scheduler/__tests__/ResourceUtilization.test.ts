/**
 * Unit tests for the ResourceUtilizationTracker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceUtilizationTracker, ResourceUsageListener } from '../ResourceUtilization';

describe('ResourceUtilizationTracker', () => {
  let tracker: ResourceUtilizationTracker;
  let mockListener: { 
    onResourceWarning: ReturnType<typeof vi.fn>;
    onResourceLimitExceeded: ReturnType<typeof vi.fn>;
    onResourceUsageNormalized: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockListener = {
      onResourceWarning: vi.fn(),
      onResourceLimitExceeded: vi.fn(),
      onResourceUsageNormalized: vi.fn()
    };
    
    // Create tracker with testing configuration
    tracker = new ResourceUtilizationTracker({
      samplingIntervalMs: 1000,
      maxHistorySamples: 10,
      defaultLimits: {
        cpuUtilization: 0.8,
        memoryBytes: 100000000,
        tokensPerMinute: 10000,
        apiCallsPerMinute: 100
      },
      limitWarningBuffer: 0.2,
      trackPerTaskUtilization: true
    });
    
    // Add mock listener
    tracker.addListener(mockListener as ResourceUsageListener);
  });
  
  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });
  
  it('should initialize with proper defaults', () => {
    expect(tracker.getCurrentUtilization()).toEqual(expect.objectContaining({
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0,
      activeTasks: 0,
      pendingTasks: 0
    }));
  });
  
  it('should track resource utilization', () => {
    tracker.start();
    
    // Advance timers to trigger sample
    vi.advanceTimersByTime(1000);
    
    // Verify that sampling occurred
    const utilization = tracker.getCurrentUtilization();
    expect(utilization.timestamp).toBeInstanceOf(Date);
    expect(utilization.cpuUtilization).toBeGreaterThanOrEqual(0);
    expect(utilization.memoryBytes).toBeGreaterThan(0);
  });
  
  it('should record task utilization', () => {
    tracker.start();
    
    // Record task utilization
    tracker.recordTaskUtilization('task1', {
      cpuUtilization: 0.2,
      memoryBytes: 50000000,
      tokensPerMinute: 5000,
      apiCallsPerMinute: 50
    });
    
    // Update task counts
    tracker.updateTaskCounts(1, 2);
    
    // Advance timers to trigger sample
    vi.advanceTimersByTime(1000);
    
    // Verify that task utilization was recorded
    const utilization = tracker.getCurrentUtilization();
    expect(utilization.activeTasks).toBe(1);
    expect(utilization.pendingTasks).toBe(2);
    expect(utilization.taskUtilization).toBeDefined();
    expect(utilization.taskUtilization?.task1).toBeDefined();
    expect(utilization.taskUtilization?.task1.cpuUtilization).toBe(0.2);
  });
  
  it('should maintain utilization history', () => {
    tracker.start();
    
    // Record multiple samples
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1000);
    }
    
    // Get history
    const history = tracker.getUtilizationHistory();
    
    // Verify history
    expect(history.length).toBe(5);
    expect(history[0].timestamp).toBeInstanceOf(Date);
    expect(history[0].cpuUtilization).toBeGreaterThanOrEqual(0);
  });
  
  it('should filter history by date range', () => {
    tracker.start();
    
    // Create dates for filtering
    const now = new Date();
    const future = new Date(now.getTime() + 10000);
    
    // Record multiple samples
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1000);
    }
    
    // Get filtered history
    const filteredHistory = tracker.getUtilizationHistory({
      from: now,
      to: future
    });
    
    // Verify filtering
    expect(filteredHistory.length).toBeLessThanOrEqual(5);
    filteredHistory.forEach(sample => {
      expect(sample.timestamp.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(sample.timestamp.getTime()).toBeLessThanOrEqual(future.getTime());
    });
  });
  
  it('should check resource limits and notify listeners', () => {
    // Set strict limits to trigger warnings
    tracker.setLimits({
      cpuUtilization: 0.1,
      memoryBytes: 10000000
    });
    
    // Simulate high resource usage
    tracker.recordTaskUtilization('task1', {
      cpuUtilization: 0.15,
      memoryBytes: 12000000
    });
    
    tracker.start();
    
    // Advance timers to trigger sample
    vi.advanceTimersByTime(1000);
    
    // Verify that listeners were notified
    expect(mockListener.onResourceLimitExceeded).toHaveBeenCalled();
  });
  
  it('should remove listeners', () => {
    // Remove listener
    tracker.removeListener(mockListener as ResourceUsageListener);
    
    // Set limits to trigger warnings
    tracker.setLimits({ cpuUtilization: 0.1 });
    
    // Simulate high resource usage
    tracker.recordTaskUtilization('task1', { cpuUtilization: 0.2 });
    
    tracker.start();
    
    // Advance timers to trigger sample
    vi.advanceTimersByTime(1000);
    
    // Verify that listeners were not notified
    expect(mockListener.onResourceLimitExceeded).not.toHaveBeenCalled();
  });
  
  it('should check if any resource limits are exceeded', () => {
    // Initial state should be no limits exceeded
    expect(tracker.areAnyResourceLimitsExceeded()).toBe(false);
    
    // Set strict limits to trigger warnings
    tracker.setLimits({ cpuUtilization: 0.1 });
    
    // Simulate high resource usage
    tracker.recordTaskUtilization('task1', { cpuUtilization: 0.2 });
    
    tracker.start();
    
    // Advance timers to trigger sample
    vi.advanceTimersByTime(1000);
    
    // Now limits should be exceeded
    expect(tracker.areAnyResourceLimitsExceeded()).toBe(true);
  });
}); 