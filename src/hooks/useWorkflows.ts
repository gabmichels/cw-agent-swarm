import { useCallback, useEffect, useState } from 'react';

export interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  platform: 'n8n' | 'zapier';
  category: string;
  parameters: WorkflowParameter[];
  isActive: boolean;
  executionCount: number;
  lastExecuted?: Date;
  agentId: string;
  assignedAt: Date;
}

export interface AvailableWorkflow {
  id: string;
  name: string;
  description: string;
  platform: 'n8n' | 'zapier';
  category: string;
  parameters: WorkflowParameter[];
  tags: string[];
  popularity: number;
  complexity: 'simple' | 'medium' | 'complex';
  nodeCount: number;
  isAssigned?: boolean;
}

export interface WorkflowSearchResult {
  workflows: AvailableWorkflow[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

interface UseWorkflowsOptions {
  agentId?: string;
  autoFetch?: boolean;
}

interface UseWorkflowsReturn {
  agentWorkflows: AgentWorkflow[];
  agentWorkflowsLoading: boolean;
  agentWorkflowsError: string | null;
  availableWorkflows: AvailableWorkflow[];
  availableWorkflowsLoading: boolean;
  availableWorkflowsError: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  fetchAgentWorkflows: () => Promise<void>;
  fetchAvailableWorkflows: (query?: string, page?: number) => Promise<void>;
  assignWorkflowToAgent: (workflowId: string) => Promise<boolean>;
  removeWorkflowFromAgent: (workflowId: string) => Promise<boolean>;
  executeWorkflow: (workflowId: string, parameters?: Record<string, any>) => Promise<string>;
  toggleWorkflowStatus: (workflowId: string, active: boolean) => Promise<boolean>;
  refreshAll: () => Promise<void>;
  getWorkflowById: (id: string) => AgentWorkflow | AvailableWorkflow | null;
}

const FASTAPI_BASE_URL = 'http://127.0.0.1:8080';

export const useWorkflows = ({
  agentId,
  autoFetch = true
}: UseWorkflowsOptions = {}): UseWorkflowsReturn => {
  const [agentWorkflows, setAgentWorkflows] = useState<AgentWorkflow[]>([]);
  const [agentWorkflowsLoading, setAgentWorkflowsLoading] = useState(false);
  const [agentWorkflowsError, setAgentWorkflowsError] = useState<string | null>(null);

  const [availableWorkflows, setAvailableWorkflows] = useState<AvailableWorkflow[]>([]);
  const [availableWorkflowsLoading, setAvailableWorkflowsLoading] = useState(false);
  const [availableWorkflowsError, setAvailableWorkflowsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const checkServerHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.warn('FastAPI server not available:', error);
      return false;
    }
  };

  const fetchAgentWorkflows = useCallback(async () => {
    if (!agentId) return;

    setAgentWorkflowsLoading(true);
    setAgentWorkflowsError(null);

    try {
      const serverAvailable = await checkServerHealth();

      if (serverAvailable) {
        const response = await fetch(`/api/agents/${agentId}/workflows`);
        if (response.ok) {
          const data = await response.json();
          setAgentWorkflows(data.workflows || []);
        } else {
          throw new Error('Failed to fetch agent workflows');
        }
      } else {
        const mockAgentWorkflows: AgentWorkflow[] = [
          {
            id: 'agent_wf_email_automation',
            name: 'Email Automation',
            description: 'Automatically send personalized emails based on triggers',
            platform: 'n8n',
            category: 'Communication',
            parameters: [
              { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
              { name: 'subject', type: 'string', required: true, description: 'Email subject' },
              { name: 'content', type: 'string', required: true, description: 'Email content' }
            ],
            isActive: true,
            executionCount: 12,
            lastExecuted: new Date('2024-01-15'),
            agentId: agentId,
            assignedAt: new Date('2024-01-01')
          },
          {
            id: 'agent_wf_slack_notification',
            name: 'Slack Notification',
            description: 'Send notifications to Slack channels',
            platform: 'zapier',
            category: 'Communication',
            parameters: [
              { name: 'channel', type: 'string', required: true, description: 'Slack channel' },
              { name: 'message', type: 'string', required: true, description: 'Message content' }
            ],
            isActive: true,
            executionCount: 8,
            lastExecuted: new Date('2024-01-14'),
            agentId: agentId,
            assignedAt: new Date('2024-01-02')
          }
        ];
        setAgentWorkflows(mockAgentWorkflows);
      }
    } catch (error) {
      console.error('Error fetching agent workflows:', error);
      setAgentWorkflowsError(error instanceof Error ? error.message : 'Failed to fetch workflows');
    } finally {
      setAgentWorkflowsLoading(false);
    }
  }, [agentId]);

  const fetchAvailableWorkflows = useCallback(async (query = searchQuery, page = currentPage) => {
    setAvailableWorkflowsLoading(true);
    setAvailableWorkflowsError(null);

    try {
      const serverAvailable = await checkServerHealth();

      if (serverAvailable) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('page', page.toString());
        params.set('per_page', '20');

        const response = await fetch(`${FASTAPI_BASE_URL}/api/workflows?${params.toString()}`);

        if (response.ok) {
          const data: WorkflowSearchResult = await response.json();

          const agentWorkflowIds = new Set(agentWorkflows.map(wf => wf.id));
          const workflowsWithAssignmentStatus = data.workflows.map(wf => ({
            ...wf,
            isAssigned: agentWorkflowIds.has(wf.id)
          }));

          setAvailableWorkflows(workflowsWithAssignmentStatus);
          setTotalPages(data.pages);
          setCurrentPage(data.page);
        } else {
          throw new Error('Failed to fetch available workflows');
        }
      } else {
        const mockAvailableWorkflows: AvailableWorkflow[] = [
          {
            id: 'disc_wf_gmail_parser',
            name: 'Gmail Email Parser',
            description: 'Parse and extract data from Gmail emails automatically',
            platform: 'n8n',
            category: 'Email',
            parameters: [
              { name: 'email_filter', type: 'string', required: true, description: 'Email filter criteria' },
              { name: 'extract_fields', type: 'object', required: true, description: 'Fields to extract' }
            ],
            tags: ['email', 'gmail', 'parsing', 'automation'],
            popularity: 85,
            complexity: 'medium',
            nodeCount: 8,
            isAssigned: false
          },
          {
            id: 'disc_wf_calendar_sync',
            name: 'Calendar Sync Automation',
            description: 'Synchronize events between different calendar systems',
            platform: 'n8n',
            category: 'Calendar',
            parameters: [
              { name: 'source_calendar', type: 'string', required: true, description: 'Source calendar ID' },
              { name: 'target_calendar', type: 'string', required: true, description: 'Target calendar ID' }
            ],
            tags: ['calendar', 'sync', 'google', 'outlook'],
            popularity: 72,
            complexity: 'simple',
            nodeCount: 5,
            isAssigned: false
          },
          {
            id: 'disc_wf_social_media_post',
            name: 'Social Media Auto-Post',
            description: 'Automatically post content to multiple social media platforms',
            platform: 'n8n',
            category: 'Social Media',
            parameters: [
              { name: 'content', type: 'string', required: true, description: 'Post content' },
              { name: 'platforms', type: 'object', required: true, description: 'Target platforms' },
              { name: 'schedule_time', type: 'string', required: false, description: 'Schedule time' }
            ],
            tags: ['social', 'twitter', 'linkedin', 'facebook', 'automation'],
            popularity: 91,
            complexity: 'complex',
            nodeCount: 12,
            isAssigned: false
          }
        ];

        const filtered = query
          ? mockAvailableWorkflows.filter(wf =>
            wf.name.toLowerCase().includes(query.toLowerCase()) ||
            wf.description.toLowerCase().includes(query.toLowerCase()) ||
            wf.category.toLowerCase().includes(query.toLowerCase()) ||
            wf.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
          )
          : mockAvailableWorkflows;

        setAvailableWorkflows(filtered);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching available workflows:', error);
      setAvailableWorkflowsError(error instanceof Error ? error.message : 'Failed to fetch workflows');
    } finally {
      setAvailableWorkflowsLoading(false);
    }
  }, [searchQuery, currentPage, agentWorkflows]);

  const assignWorkflowToAgent = useCallback(async (workflowId: string): Promise<boolean> => {
    if (!agentId) return false;

    try {
      const response = await fetch(`/api/agents/${agentId}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId })
      });

      if (response.ok) {
        await Promise.all([fetchAgentWorkflows(), fetchAvailableWorkflows()]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error assigning workflow:', error);
      return false;
    }
  }, [agentId, fetchAgentWorkflows, fetchAvailableWorkflows]);

  const removeWorkflowFromAgent = useCallback(async (workflowId: string): Promise<boolean> => {
    if (!agentId) return false;

    try {
      const response = await fetch(`/api/agents/${agentId}/workflows/${workflowId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await Promise.all([fetchAgentWorkflows(), fetchAvailableWorkflows()]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing workflow:', error);
      return false;
    }
  }, [agentId, fetchAgentWorkflows, fetchAvailableWorkflows]);

  const executeWorkflow = useCallback(async (
    workflowId: string,
    parameters: Record<string, any> = {}
  ): Promise<string> => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters })
      });

      if (response.ok) {
        const data = await response.json();
        await fetchAgentWorkflows();
        return data.executionId;
      }
      throw new Error('Execution failed');
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    }
  }, [fetchAgentWorkflows]);

  const toggleWorkflowStatus = useCallback(async (
    workflowId: string,
    active: boolean
  ): Promise<boolean> => {
    if (!agentId) return false;

    try {
      const response = await fetch(`/api/agents/${agentId}/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active })
      });

      if (response.ok) {
        await fetchAgentWorkflows();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error toggling workflow status:', error);
      return false;
    }
  }, [agentId, fetchAgentWorkflows]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchAgentWorkflows(), fetchAvailableWorkflows()]);
  }, [fetchAgentWorkflows, fetchAvailableWorkflows]);

  const getWorkflowById = useCallback((id: string): AgentWorkflow | AvailableWorkflow | null => {
    const agentWorkflow = agentWorkflows.find(wf => wf.id === id);
    if (agentWorkflow) return agentWorkflow;

    const availableWorkflow = availableWorkflows.find(wf => wf.id === id);
    return availableWorkflow || null;
  }, [agentWorkflows, availableWorkflows]);

  useEffect(() => {
    if (autoFetch) {
      fetchAgentWorkflows();
    }
  }, [autoFetch, fetchAgentWorkflows]);

  useEffect(() => {
    if (autoFetch) {
      fetchAvailableWorkflows();
    }
  }, [autoFetch, searchQuery, currentPage]);

  return {
    agentWorkflows,
    agentWorkflowsLoading,
    agentWorkflowsError,
    availableWorkflows,
    availableWorkflowsLoading,
    availableWorkflowsError,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    fetchAgentWorkflows,
    fetchAvailableWorkflows,
    assignWorkflowToAgent,
    removeWorkflowFromAgent,
    executeWorkflow,
    toggleWorkflowStatus,
    refreshAll,
    getWorkflowById
  };
};
