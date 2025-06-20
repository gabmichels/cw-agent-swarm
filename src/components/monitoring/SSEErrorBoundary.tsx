import React, { Component, ReactNode } from 'react';
import { SSEHealthMonitor } from '../../lib/monitoring/SSEHealthMonitor';

interface SSEErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  enableFallbackMode?: boolean;
  chatId?: string;
}

interface SSEErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  fallbackMode: 'polling' | 'offline' | null;
  retryCount: number;
  lastRetryAt: number;
}

/**
 * Error Boundary specifically designed for SSE connection failures
 * Provides automatic fallback to polling mode and recovery options
 */
export class SSEErrorBoundary extends Component<SSEErrorBoundaryProps, SSEErrorBoundaryState> {
  private healthMonitor: SSEHealthMonitor;
  private retryTimeout?: NodeJS.Timeout;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000;

  constructor(props: SSEErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: null,
      retryCount: 0,
      lastRetryAt: 0
    };

    this.healthMonitor = SSEHealthMonitor.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<SSEErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to health monitor
    if (this.props.chatId) {
      this.healthMonitor.recordError(
        this.props.chatId,
        'connection',
        error.message,
        error.stack,
        { errorInfo, component: 'SSEErrorBoundary' }
      );
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      lastRetryAt: Date.now()
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Determine if we should enable fallback mode
    if (this.props.enableFallbackMode && this.isSSERelatedError(error)) {
      this.enableFallbackMode();
    }

    // Log error for debugging
    console.error('SSE Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  /**
   * Check if the error is related to SSE connections
   */
  private isSSERelatedError(error: Error): boolean {
    const sseKeywords = [
      'eventsource',
      'server-sent',
      'connection',
      'network',
      'fetch',
      'stream'
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();

    return sseKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorStack.includes(keyword)
    );
  }

  /**
   * Enable fallback mode (polling or offline)
   */
  private enableFallbackMode() {
    // Check if we're online
    if (navigator.onLine) {
      this.setState({ fallbackMode: 'polling' });
    } else {
      this.setState({ fallbackMode: 'offline' });
    }
  }

  /**
   * Attempt to recover from the error
   */
  private handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        fallbackMode: null,
        retryCount: prevState.retryCount + 1,
        lastRetryAt: Date.now()
      }));
    } else {
      // Max retries reached, enable permanent fallback
      this.enableFallbackMode();
    }
  };

  /**
   * Schedule automatic retry
   */
  private scheduleRetry() {
    if (this.state.retryCount < this.maxRetries) {
      this.retryTimeout = setTimeout(() => {
        this.handleRetry();
      }, this.retryDelayMs * (this.state.retryCount + 1)); // Exponential backoff
    }
  }

  /**
   * Reset error boundary state
   */
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: null,
      retryCount: 0,
      lastRetryAt: 0
    });
  };

  /**
   * Handle manual fallback mode toggle
   */
  private handleFallbackToggle = (mode: 'polling' | 'offline' | null) => {
    this.setState({ fallbackMode: mode });
  };

  render() {
    const { hasError, error, fallbackMode, retryCount } = this.state;
    const { children, fallback } = this.props;

    // If there's an error, show error UI
    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Connection Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {this.isSSERelatedError(error) 
                    ? 'Real-time connection failed. The system can continue in fallback mode.'
                    : 'An unexpected error occurred in the chat system.'
                  }
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto">
                      {error.message}
                      {error.stack && `\n\n${error.stack}`}
                    </pre>
                  </details>
                )}
              </div>
              
              {/* Fallback Mode Options */}
              {this.props.enableFallbackMode && this.isSSERelatedError(error) && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Fallback Options:</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.handleFallbackToggle('polling')}
                      className={`px-3 py-1 text-xs rounded ${
                        fallbackMode === 'polling'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      Use Polling Mode
                    </button>
                    <button
                      onClick={() => this.handleFallbackToggle('offline')}
                      className={`px-3 py-1 text-xs rounded ${
                        fallbackMode === 'offline'
                          ? 'bg-gray-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Offline Mode
                    </button>
                  </div>
                  
                  {fallbackMode && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      {fallbackMode === 'polling' && (
                        <>
                          <strong>Polling Mode:</strong> Messages will be checked every 5 seconds. 
                          Real-time features may be limited.
                        </>
                      )}
                      {fallbackMode === 'offline' && (
                        <>
                          <strong>Offline Mode:</strong> You can compose messages that will be sent 
                          when connection is restored.
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                {retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Retry Connection ({this.maxRetries - retryCount} attempts left)
                  </button>
                )}
                
                <button
                  onClick={this.handleReset}
                  className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                >
                  Reset
                </button>
                
                {this.props.chatId && (
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Reload Page
                  </button>
                )}
              </div>
              
              {/* Retry Schedule Info */}
              {retryCount > 0 && retryCount < this.maxRetries && (
                <div className="mt-2 text-xs text-red-600">
                  Next automatic retry in {this.retryDelayMs * (retryCount + 1) / 1000} seconds...
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}

/**
 * Hook for using SSE Error Boundary in functional components
 */
export function useSSEErrorHandler(chatId?: string) {
  const healthMonitor = SSEHealthMonitor.getInstance();

  const reportError = React.useCallback((error: Error, context?: string) => {
    if (chatId) {
      healthMonitor.recordError(
        chatId,
        'connection',
        error.message,
        error.stack,
        { context, timestamp: Date.now() }
      );
    }
    console.error('SSE Error:', error);
  }, [chatId, healthMonitor]);

  const checkHealth = React.useCallback(() => {
    return healthMonitor.performHealthCheck();
  }, [healthMonitor]);

  return {
    reportError,
    checkHealth
  };
} 