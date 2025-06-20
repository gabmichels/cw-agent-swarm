import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatEventEmitter } from '../../src/lib/events/ChatEventEmitter';
import { SSEHealthMonitor } from '../../src/services/monitoring/SSEHealthMonitor';

// Mock dependencies
vi.mock('../../src/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('SSE Chat System Integration Tests', () => {
  let chatEventEmitter: ChatEventEmitter;
  let healthMonitor: SSEHealthMonitor;

  beforeEach(() => {
    // Reset singletons for each test
    vi.clearAllMocks();
    
    // Get fresh instances
    chatEventEmitter = ChatEventEmitter.getInstance();
    healthMonitor = SSEHealthMonitor.getInstance();
    
    // Reset any existing state
    chatEventEmitter.removeAllListeners();
    healthMonitor.reset();
  });

  afterEach(() => {
    // Clean up after each test
    chatEventEmitter.removeAllListeners();
    healthMonitor.reset();
  });

  describe('ChatEventEmitter', () => {
    it('should maintain singleton pattern', () => {
      const instance1 = ChatEventEmitter.getInstance();
      const instance2 = ChatEventEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should emit and receive chat events', async () => {
      const mockListener = vi.fn();
      const testMessage = {
        id: 'test-message-1',
        content: 'Hello, world!',
        userId: 'user-123',
        timestamp: new Date().toISOString()
      };

      chatEventEmitter.on('message', mockListener);
      chatEventEmitter.emit('message', testMessage);

      expect(mockListener).toHaveBeenCalledWith(testMessage);
    });

    it('should handle multiple event types', async () => {
      const messageListener = vi.fn();
      const notificationListener = vi.fn();
      const statusListener = vi.fn();

      chatEventEmitter.on('message', messageListener);
      chatEventEmitter.on('notification', notificationListener);
      chatEventEmitter.on('status', statusListener);

      // Emit different event types
      chatEventEmitter.emit('message', { content: 'Test message' });
      chatEventEmitter.emit('notification', { type: 'info', message: 'Test notification' });
      chatEventEmitter.emit('status', { online: true });

      expect(messageListener).toHaveBeenCalledTimes(1);
      expect(notificationListener).toHaveBeenCalledTimes(1);
      expect(statusListener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener removal', () => {
      const mockListener = vi.fn();
      
      chatEventEmitter.on('message', mockListener);
      chatEventEmitter.emit('message', { content: 'First message' });
      
      chatEventEmitter.off('message', mockListener);
      chatEventEmitter.emit('message', { content: 'Second message' });

      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('SSEHealthMonitor', () => {
    it('should maintain singleton pattern', () => {
      const instance1 = SSEHealthMonitor.getInstance();
      const instance2 = SSEHealthMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should track connections', () => {
      const connectionId = 'conn-123';
      
      healthMonitor.registerConnection(connectionId);
      const metrics = healthMonitor.getCurrentMetrics();
      
      expect(metrics.activeConnections).toBe(1);
    });

    it('should record event delivery', () => {
      const connectionId = 'conn-123';
      
      healthMonitor.registerConnection(connectionId);
      healthMonitor.recordEventDelivery(connectionId, 'message', true);
      
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsDelivered).toBe(1);
      expect(metrics.eventsDelivered).toBeGreaterThan(0);
    });

    it('should calculate health status', () => {
      const connectionId = 'conn-123';
      
      healthMonitor.registerConnection(connectionId);
      healthMonitor.recordEventDelivery(connectionId, 'message', true);
      
      const healthStatus = healthMonitor.performHealthCheck();
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.activeConnections).toBe(1);
    });

    it('should handle connection disconnection', () => {
      const connectionId = 'conn-123';
      
      healthMonitor.registerConnection(connectionId);
      expect(healthMonitor.getCurrentMetrics().activeConnections).toBe(1);
      
      healthMonitor.recordDisconnection(connectionId);
      expect(healthMonitor.getCurrentMetrics().activeConnections).toBe(0);
    });

    it('should track failed deliveries', () => {
      const connectionId = 'conn-123';
      
      healthMonitor.registerConnection(connectionId);
      healthMonitor.recordEventDelivery(connectionId, 'message', false);
      
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsFailed).toBe(1);
    });
  });

  describe('Event Flow Integration', () => {
    it('should handle complete message flow with monitoring', async () => {
      const connectionId = 'conn-integration-test';
      const mockListener = vi.fn();
      
      // Set up monitoring
      healthMonitor.registerConnection(connectionId);
      
      // Set up event listening
      chatEventEmitter.on('message', mockListener);
      
      // Simulate message flow
      const testMessage = {
        id: 'integration-msg-1',
        content: 'Integration test message',
        userId: 'user-integration',
        timestamp: new Date().toISOString()
      };
      
      chatEventEmitter.emit('message', testMessage);
      healthMonitor.recordEventDelivery(connectionId, 'message', true);
      
      // Verify event was received
      expect(mockListener).toHaveBeenCalledWith(testMessage);
      
      // Verify monitoring recorded the event
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsDelivered).toBe(1);
      expect(metrics.activeConnections).toBe(1);
      
      // Verify health status
      const health = healthMonitor.performHealthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should handle multiple concurrent connections', () => {
      const connections = ['conn-1', 'conn-2', 'conn-3'];
      
      // Register multiple connections
      connections.forEach(connId => {
        healthMonitor.registerConnection(connId);
      });
      
      // Verify all connections are tracked
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.activeConnections).toBe(3);
      
      // Simulate events for each connection
      connections.forEach(connId => {
        healthMonitor.recordEventDelivery(connId, 'message', true);
      });
      
      // Verify events were recorded
      const updatedMetrics = healthMonitor.getCurrentMetrics();
      expect(updatedMetrics.eventsDelivered).toBe(3);
    });

    it('should handle error scenarios gracefully', () => {
      const connectionId = 'conn-error-test';
      
      healthMonitor.registerConnection(connectionId);
      
      // Simulate failed delivery
      healthMonitor.recordEventDelivery(connectionId, 'message', false);
      
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsFailed).toBe(1);
      
      // Health should still be calculable
      const health = healthMonitor.performHealthCheck();
      expect(health).toBeDefined();
      expect(health.activeConnections).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should handle cleanup properly', () => {
      const connectionIds = Array.from({ length: 10 }, (_, i) => `conn-${i}`);
      
      // Create many connections
      connectionIds.forEach(connId => {
        healthMonitor.registerConnection(connId);
      });
      
      expect(healthMonitor.getCurrentMetrics().activeConnections).toBe(10);
      
      // Disconnect all
      connectionIds.forEach(connId => {
        healthMonitor.recordDisconnection(connId);
      });
      
      expect(healthMonitor.getCurrentMetrics().activeConnections).toBe(0);
    });

    it('should handle event listener cleanup', () => {
      const listeners = Array.from({ length: 5 }, () => vi.fn());
      
      // Add multiple listeners
      listeners.forEach(listener => {
        chatEventEmitter.on('message', listener);
      });
      
      // Emit event - all should receive
      chatEventEmitter.emit('message', { content: 'Test' });
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
      
      // Remove all listeners
      chatEventEmitter.removeAllListeners();
      
      // Emit again - none should receive
      chatEventEmitter.emit('message', { content: 'Test 2' });
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics accurately', () => {
      const startTime = Date.now();
      const connectionId = 'perf-test-conn';
      
      healthMonitor.registerConnection(connectionId);
      
      // Simulate some activity
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordEventDelivery(connectionId, 'message', true);
      }
      
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsDelivered).toBe(10);
      expect(metrics.activeConnections).toBe(1);
      
      // Performance should be reasonable
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle high-frequency events', () => {
      const connectionId = 'high-freq-conn';
      const eventCount = 100;
      
      healthMonitor.registerConnection(connectionId);
      
      const startTime = Date.now();
      
      // Rapid-fire events
      for (let i = 0; i < eventCount; i++) {
        healthMonitor.recordEventDelivery(connectionId, 'message', true);
        chatEventEmitter.emit('message', { id: i, content: `Message ${i}` });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle high frequency efficiently
      expect(duration).toBeLessThan(5000); // Under 5 seconds for 100 events
      
      const metrics = healthMonitor.getCurrentMetrics();
      expect(metrics.eventsDelivered).toBe(eventCount);
    });
  });

  describe('System Notifications', () => {
    it('should handle system notification events', () => {
      const notificationListener = vi.fn();
      
      chatEventEmitter.on('system-notification', notificationListener);
      
      const systemNotification = {
        type: 'system-update',
        message: 'System maintenance scheduled',
        severity: 'info',
        timestamp: new Date().toISOString()
      };
      
      chatEventEmitter.emit('system-notification', systemNotification);
      
      expect(notificationListener).toHaveBeenCalledWith(systemNotification);
    });

    it('should handle user status changes', () => {
      const statusListener = vi.fn();
      
      chatEventEmitter.on('user-status', statusListener);
      
      const statusUpdate = {
        userId: 'user-123',
        status: 'online',
        timestamp: new Date().toISOString()
      };
      
      chatEventEmitter.emit('user-status', statusUpdate);
      
      expect(statusListener).toHaveBeenCalledWith(statusUpdate);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid connection IDs gracefully', () => {
      expect(() => {
        healthMonitor.recordEventDelivery('non-existent-conn', 'message', true);
      }).not.toThrow();
      
      expect(() => {
        healthMonitor.recordDisconnection('non-existent-conn');
      }).not.toThrow();
    });

    it('should handle malformed events gracefully', () => {
      const errorListener = vi.fn();
      
      chatEventEmitter.on('message', errorListener);
      
      // Try to emit malformed data
      expect(() => {
        chatEventEmitter.emit('message', null);
        chatEventEmitter.emit('message', undefined);
        chatEventEmitter.emit('message', 'invalid-data');
      }).not.toThrow();
    });
  });
}); 