import { ulid } from 'ulid';

/**
 * Connection state tracking
 */
export interface ConnectionMetrics {
  id: string; // ULID
  userId?: string;
  chatId?: string;
  connectedAt: number; // Unix timestamp
  disconnectedAt?: number; // Unix timestamp
  duration?: number; // milliseconds
  eventsDelivered: number;
  reconnectCount: number;
  lastEventAt?: number; // Unix timestamp
  userAgent?: string;
  ipAddress?: string;
  status: 'active' | 'disconnected' | 'error';
  errorCount: number;
  lastError?: string;
}

/**
 * Performance metrics aggregation
 */
export interface PerformanceMetrics {
  timestamp: number;
  activeConnections: number;
  totalConnections: number;
  eventsPerSecond: number;
  averageConnectionDuration: number;
  reconnectionRate: number;
  errorRate: number;
  memoryUsage?: number; // MB
  cpuUsage?: number; // percentage
}

/**
 * Error tracking for categorization
 */
export interface SSEError {
  id: string; // ULID
  timestamp: number;
  connectionId: string;
  type: 'connection' | 'delivery' | 'auth' | 'network' | 'server';
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  metrics: {
    activeConnections: number;
    errorRate: number;
    averageLatency: number;
    uptime: number;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * SSE Health Monitor - Comprehensive monitoring and analytics for SSE connections
 */
export class SSEHealthMonitor {
  private static instance: SSEHealthMonitor;
  private connections = new Map<string, ConnectionMetrics>();
  private performanceHistory: PerformanceMetrics[] = [];
  private errors: SSEError[] = [];
  private startTime = Date.now();
  private metricsInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  // Configuration
  private readonly maxHistorySize = 1000; // Keep last 1000 performance snapshots
  private readonly maxErrorHistory = 500; // Keep last 500 errors
  private readonly metricsIntervalMs = 10000; // Collect metrics every 10 seconds
  private readonly cleanupIntervalMs = 300000; // Cleanup every 5 minutes
  private readonly connectionTimeoutMs = 300000; // 5 minute timeout
  
  private constructor() {
    this.startMetricsCollection();
    this.startCleanupProcess();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SSEHealthMonitor {
    if (!SSEHealthMonitor.instance) {
      SSEHealthMonitor.instance = new SSEHealthMonitor();
    }
    return SSEHealthMonitor.instance;
  }

  /**
   * Register a new SSE connection
   */
  public registerConnection(
    connectionId: string,
    userId?: string,
    chatId?: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): void {
    const connection: ConnectionMetrics = {
      id: connectionId,
      userId,
      chatId,
      connectedAt: Date.now(),
      eventsDelivered: 0,
      reconnectCount: 0,
      status: 'active',
      errorCount: 0,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress
    };

    this.connections.set(connectionId, connection);
    this.logEvent('connection_established', { connectionId, userId, chatId });
  }

  /**
   * Update connection on reconnection
   */
  public recordReconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.reconnectCount++;
      connection.status = 'active';
      this.logEvent('connection_reconnected', { connectionId, reconnectCount: connection.reconnectCount });
    }
  }

  /**
   * Record event delivery
   */
  public recordEventDelivery(connectionId: string, eventType: string, latency?: number): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.eventsDelivered++;
      connection.lastEventAt = Date.now();
      this.logEvent('event_delivered', { 
        connectionId, 
        eventType, 
        totalEvents: connection.eventsDelivered,
        latency 
      });
    }
  }

  /**
   * Record connection error
   */
  public recordError(
    connectionId: string,
    type: SSEError['type'],
    message: string,
    stack?: string,
    metadata?: Record<string, any>
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.errorCount++;
      connection.lastError = message;
      if (type === 'connection' || type === 'network') {
        connection.status = 'error';
      }
    }

    const error: SSEError = {
      id: ulid(),
      timestamp: Date.now(),
      connectionId,
      type,
      message,
      stack,
      metadata,
      resolved: false
    };

    this.errors.push(error);
    
    // Keep error history manageable
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory);
    }

    this.logEvent('error_recorded', { connectionId, type, message });
  }

  /**
   * Mark connection as disconnected
   */
  public recordDisconnection(connectionId: string, reason?: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.status === 'active') {
      connection.disconnectedAt = Date.now();
      connection.duration = connection.disconnectedAt - connection.connectedAt;
      connection.status = 'disconnected';
      
      this.logEvent('connection_disconnected', { 
        connectionId, 
        duration: connection.duration,
        eventsDelivered: connection.eventsDelivered,
        reason 
      });
    }
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'active');
    
    const recentEvents = Array.from(this.connections.values())
      .map(conn => conn.lastEventAt || 0)
      .filter(timestamp => timestamp > now - 60000); // Events in last minute
    
    const recentErrors = this.errors.filter(error => error.timestamp > now - 60000);
    
    const totalConnections = this.connections.size;
    const errorRate = totalConnections > 0 ? recentErrors.length / totalConnections : 0;
    
    const connectionDurations = Array.from(this.connections.values())
      .filter(conn => conn.duration)
      .map(conn => conn.duration!);
    
    const averageConnectionDuration = connectionDurations.length > 0
      ? connectionDurations.reduce((sum, duration) => sum + duration, 0) / connectionDurations.length
      : 0;

    const reconnections = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.reconnectCount, 0);
    
    const reconnectionRate = totalConnections > 0 ? reconnections / totalConnections : 0;

    return {
      timestamp: now,
      activeConnections: activeConnections.length,
      totalConnections,
      eventsPerSecond: recentEvents.length / 60, // Approximate events per second
      averageConnectionDuration,
      reconnectionRate,
      errorRate,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCPUUsage()
    };
  }

  /**
   * Get performance history
   */
  public getPerformanceHistory(limit = 100): PerformanceMetrics[] {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Get connection details
   */
  public getConnectionDetails(connectionId: string): ConnectionMetrics | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all active connections
   */
  public getActiveConnections(): ConnectionMetrics[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === 'active');
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(limit = 50): SSEError[] {
    return this.errors.slice(-limit);
  }

  /**
   * Perform health check
   */
  public performHealthCheck(): HealthCheckResult {
    const metrics = this.getCurrentMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: HealthCheckResult['status'] = 'healthy';

    // Check error rate
    if (metrics.errorRate > 0.1) { // More than 10% error rate
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate connection stability and server resources');
      status = 'degraded';
    }

    // Check reconnection rate
    if (metrics.reconnectionRate > 0.5) { // More than 50% reconnection rate
      issues.push(`High reconnection rate: ${(metrics.reconnectionRate * 100).toFixed(1)}%`);
      recommendations.push('Check network stability and connection timeout settings');
      status = 'degraded';
    }

    // Check active connections vs historical
    const avgConnections = this.performanceHistory.length > 0
      ? this.performanceHistory.reduce((sum, m) => sum + m.activeConnections, 0) / this.performanceHistory.length
      : metrics.activeConnections;
    
    if (metrics.activeConnections < avgConnections * 0.5) {
      issues.push('Significant drop in active connections');
      recommendations.push('Check for service disruptions or deployment issues');
      status = 'degraded';
    }

    // Check memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > 1000) { // More than 1GB
      issues.push(`High memory usage: ${metrics.memoryUsage}MB`);
      recommendations.push('Consider implementing connection limits or memory optimization');
      if (metrics.memoryUsage > 2000) status = 'unhealthy';
    }

    // Check for stuck connections
    const stuckConnections = this.getActiveConnections()
      .filter(conn => conn.lastEventAt && Date.now() - conn.lastEventAt > 600000); // No events for 10 minutes
    
    if (stuckConnections.length > 0) {
      issues.push(`${stuckConnections.length} connections appear stuck`);
      recommendations.push('Implement connection cleanup for inactive connections');
    }

    if (issues.length > 3) status = 'unhealthy';

    return {
      status,
      timestamp: Date.now(),
      metrics: {
        activeConnections: metrics.activeConnections,
        errorRate: metrics.errorRate,
        averageLatency: 0, // TODO: Implement latency tracking
        uptime: Date.now() - this.startTime
      },
      issues,
      recommendations
    };
  }

  /**
   * Get system resource comparison data
   */
  public getResourceComparison(): {
    sse: { requests: number; bandwidth: number; connections: number };
    polling: { requests: number; bandwidth: number; connections: number };
    savings: { requests: number; bandwidth: number; percentage: number };
  } {
    const activeConnections = this.getActiveConnections().length;
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);

    // SSE: ~5 requests per hour per connection (keepalives)
    const sseRequests = Math.round(activeConnections * 5 * uptimeHours);
    const sseBandwidth = sseRequests * 0.1; // ~100 bytes per keepalive

    // Polling: 240 requests per hour per connection (every 15 seconds)
    const pollingRequests = Math.round(activeConnections * 240 * uptimeHours);
    const pollingBandwidth = pollingRequests * 1; // ~1KB per polling request

    const requestSavings = pollingRequests - sseRequests;
    const bandwidthSavings = pollingBandwidth - sseBandwidth;
    const percentageSavings = pollingRequests > 0 ? (requestSavings / pollingRequests) * 100 : 0;

    return {
      sse: {
        requests: sseRequests,
        bandwidth: sseBandwidth,
        connections: activeConnections
      },
      polling: {
        requests: pollingRequests,
        bandwidth: pollingBandwidth,
        connections: activeConnections
      },
      savings: {
        requests: requestSavings,
        bandwidth: bandwidthSavings,
        percentage: percentageSavings
      }
    };
  }

  /**
   * Export metrics for external monitoring
   */
  public exportMetrics(): {
    connections: ConnectionMetrics[];
    performance: PerformanceMetrics[];
    errors: SSEError[];
    health: HealthCheckResult;
  } {
    return {
      connections: Array.from(this.connections.values()),
      performance: this.performanceHistory,
      errors: this.errors,
      health: this.performHealthCheck()
    };
  }

  /**
   * Start collecting metrics periodically
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.performanceHistory.push(metrics);
      
      // Keep history manageable
      if (this.performanceHistory.length > this.maxHistorySize) {
        this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
      }
    }, this.metricsIntervalMs);
  }

  /**
   * Start cleanup process for old connections
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [id, connection] of this.connections) {
        // Remove old disconnected connections
        if (connection.status === 'disconnected' && 
            connection.disconnectedAt && 
            now - connection.disconnectedAt > this.connectionTimeoutMs) {
          toRemove.push(id);
        }
        // Mark stale active connections as timed out
        else if (connection.status === 'active' && 
                 now - connection.connectedAt > this.connectionTimeoutMs &&
                 (!connection.lastEventAt || now - connection.lastEventAt > this.connectionTimeoutMs)) {
          connection.status = 'disconnected';
          connection.disconnectedAt = now;
          connection.duration = now - connection.connectedAt;
          this.logEvent('connection_timeout', { connectionId: id });
        }
      }

      // Remove old connections
      toRemove.forEach(id => this.connections.delete(id));
      
      if (toRemove.length > 0) {
        this.logEvent('cleanup_completed', { removedConnections: toRemove.length });
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Get memory usage (Node.js specific)
   */
  private getMemoryUsage(): number | undefined {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024); // Convert to MB
    }
    return undefined;
  }

  /**
   * Get CPU usage estimate (simplified)
   */
  private getCPUUsage(): number | undefined {
    // This is a simplified implementation
    // In production, you might want to use more sophisticated CPU monitoring
    return undefined;
  }

  /**
   * Log events for debugging and monitoring
   */
  private logEvent(event: string, data: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSEHealthMonitor] ${event}:`, data);
    }
    
    // In production, you might want to send this to your logging service
    // Example: logger.info(event, data);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connections.clear();
    this.performanceHistory = [];
    this.errors = [];
  }
} 