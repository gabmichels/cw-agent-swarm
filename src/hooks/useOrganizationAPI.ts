import { useState, useCallback } from 'react';
import { Department, OrganizationChart, AgentConfigTemplate } from '../types/organization';
import { AgentMetadata } from '../types/metadata';
import { OrgChartChange } from '../components/organization/OrgChartRenderer';
import { AgentSpawnRequest } from '../services/organization/AgentTemplateService';

/**
 * API response interface
 */
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

/**
 * Organization chart data interface
 */
interface OrganizationChartData {
  chart: OrganizationChart;
  departments: Department[];
  mode: string;
  lastUpdated: string;
}

/**
 * Templates response interface
 */
interface TemplatesResponse {
  templates: AgentConfigTemplate[];
  mode: string;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * React hook for organization API operations
 */
export const useOrganizationAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generic API call handler
   */
  const apiCall = useCallback(async <T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }, []);

  /**
   * Fetch organization chart
   */
  const fetchOrganizationChart = useCallback(async (): Promise<OrganizationChartData | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<OrganizationChartData>('/api/organization/chart');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch organization chart');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Create department
   */
  const createDepartment = useCallback(async (departmentData: {
    name: string;
    description?: string;
    code?: string;
    budgetLimit?: number;
    currency?: string;
    managerId?: string;
    parentDepartmentId?: string;
  }): Promise<Department | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<Department>('/api/organization/departments', {
        method: 'POST',
        body: JSON.stringify(departmentData),
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to create department');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * List departments
   */
  const listDepartments = useCallback(async (): Promise<Department[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<Department[]>('/api/organization/departments');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to list departments');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Assign agent to department
   */
  const assignAgentToDepartment = useCallback(async (
    agentId: string,
    departmentId: string,
    position?: string,
    organizationLevel?: number
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/api/agents/${agentId}/department`, {
        method: 'PUT',
        body: JSON.stringify({
          departmentId,
          position,
          organizationLevel
        }),
      });
      
      if (response.success) {
        return true;
      } else {
        setError(response.error || 'Failed to assign agent to department');
        return false;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Remove agent from department
   */
  const removeAgentFromDepartment = useCallback(async (agentId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/api/agents/${agentId}/department`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        return true;
      } else {
        setError(response.error || 'Failed to remove agent from department');
        return false;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Fetch templates
   */
  const fetchTemplates = useCallback(async (params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<TemplatesResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.append('category', params.category);
      if (params?.search) searchParams.append('search', params.search);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.offset) searchParams.append('offset', params.offset.toString());

      const url = `/api/organization/templates${searchParams.toString() ? `?${searchParams}` : ''}`;
      const response = await apiCall<TemplatesResponse>(url);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch templates');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Create template from agent
   */
  const createTemplateFromAgent = useCallback(async (
    sourceAgentId: string,
    templateName: string,
    description?: string,
    category?: string
  ): Promise<AgentConfigTemplate | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<AgentConfigTemplate>('/api/organization/templates', {
        method: 'POST',
        body: JSON.stringify({
          sourceAgentId,
          templateName,
          description,
          category
        }),
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to create template');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Spawn agent from template
   */
  const spawnAgentFromTemplate = useCallback(async (
    spawnRequest: AgentSpawnRequest
  ): Promise<AgentMetadata | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<AgentMetadata>('/api/organization/spawn-agent', {
        method: 'POST',
        body: JSON.stringify(spawnRequest),
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to spawn agent from template');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  /**
   * Apply organizational changes
   */
  const applyOrganizationalChanges = useCallback(async (
    changes: OrgChartChange[]
  ): Promise<{
    appliedChanges: any[];
    errors: any[];
    summary: {
      totalChanges: number;
      successfulChanges: number;
      failedChanges: number;
    };
  } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall<{
        appliedChanges: any[];
        errors: any[];
        summary: {
          totalChanges: number;
          successfulChanges: number;
          failedChanges: number;
        };
      }>('/api/organization/apply-changes', {
        method: 'PUT',
        body: JSON.stringify({ changes }),
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to apply organizational changes');
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return {
    // State
    loading,
    error,
    
    // Actions
    fetchOrganizationChart,
    createDepartment,
    listDepartments,
    assignAgentToDepartment,
    removeAgentFromDepartment,
    fetchTemplates,
    createTemplateFromAgent,
    spawnAgentFromTemplate,
    applyOrganizationalChanges,
    
    // Utility
    clearError: () => setError(null)
  };
}; 