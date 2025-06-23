import { useCallback } from 'react';
import { N8nWorkflowTemplate } from '../types/workflow';

interface WorkflowEvent {
  readonly event: 'view' | 'preview' | 'import' | 'favorite' | 'unfavorite' | 'search';
  readonly workflowId?: string;
  readonly workflowName?: string;
  readonly category?: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly metadata?: Record<string, unknown>;
}

interface UseWorkflowAnalyticsReturn {
  readonly trackWorkflowView: (workflow: N8nWorkflowTemplate) => void;
  readonly trackWorkflowPreview: (workflow: N8nWorkflowTemplate) => void;
  readonly trackWorkflowImport: (workflow: N8nWorkflowTemplate) => void;
  readonly trackWorkflowFavorite: (workflow: N8nWorkflowTemplate, favorited: boolean) => void;
  readonly trackWorkflowSearch: (query: string, resultCount: number) => void;
}

// Generate a session ID that persists for the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('workflow-analytics-session');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('workflow-analytics-session', sessionId);
  }
  return sessionId;
};

/**
 * Hook for tracking workflow usage analytics
 * Implements privacy-friendly local analytics collection
 */
export const useWorkflowAnalytics = (): UseWorkflowAnalyticsReturn => {
  const trackEvent = useCallback((event: Omit<WorkflowEvent, 'timestamp' | 'sessionId'>): void => {
    const analyticsEvent: WorkflowEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId()
    };

    // Log to console for development
    console.log('Workflow Analytics:', analyticsEvent);

    // Store in localStorage for local analytics
    try {
      const existingEvents = localStorage.getItem('workflow-analytics-events');
      const events: WorkflowEvent[] = existingEvents ? JSON.parse(existingEvents) : [];
      
      // Add new event
      events.push(analyticsEvent);
      
      // Keep only last 1000 events to prevent storage overflow
      const trimmedEvents = events.slice(-1000);
      
      localStorage.setItem('workflow-analytics-events', JSON.stringify(trimmedEvents));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }

    // TODO: In production, send to analytics service
    // This could be sent to a dedicated analytics endpoint
    // or third-party service like Google Analytics, Mixpanel, etc.
  }, []);

  const trackWorkflowView = useCallback((workflow: N8nWorkflowTemplate): void => {
    trackEvent({
      event: 'view',
      workflowId: workflow.id.toString(),
      workflowName: workflow.name,
      category: workflow.category,
      metadata: {
        complexity: workflow.complexity,
        nodeCount: workflow.nodeCount,
        triggerType: workflow.triggerType
      }
    });
  }, [trackEvent]);

  const trackWorkflowPreview = useCallback((workflow: N8nWorkflowTemplate): void => {
    trackEvent({
      event: 'preview',
      workflowId: workflow.id.toString(),
      workflowName: workflow.name,
      category: workflow.category,
      metadata: {
        complexity: workflow.complexity,
        integrations: workflow.integrations
      }
    });
  }, [trackEvent]);

  const trackWorkflowImport = useCallback((workflow: N8nWorkflowTemplate): void => {
    trackEvent({
      event: 'import',
      workflowId: workflow.id.toString(),
      workflowName: workflow.name,
      category: workflow.category,
      metadata: {
        complexity: workflow.complexity,
        nodeCount: workflow.nodeCount,
        integrations: workflow.integrations
      }
    });
  }, [trackEvent]);

  const trackWorkflowFavorite = useCallback((workflow: N8nWorkflowTemplate, favorited: boolean): void => {
    trackEvent({
      event: favorited ? 'favorite' : 'unfavorite',
      workflowId: workflow.id.toString(),
      workflowName: workflow.name,
      category: workflow.category,
      metadata: {
        complexity: workflow.complexity
      }
    });
  }, [trackEvent]);

  const trackWorkflowSearch = useCallback((query: string, resultCount: number): void => {
    trackEvent({
      event: 'search',
      metadata: {
        query: query.trim(),
        resultCount,
        queryLength: query.trim().length
      }
    });
  }, [trackEvent]);

  return {
    trackWorkflowView,
    trackWorkflowPreview,
    trackWorkflowImport,
    trackWorkflowFavorite,
    trackWorkflowSearch
  };
}; 