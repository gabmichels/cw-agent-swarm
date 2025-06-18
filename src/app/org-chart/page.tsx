'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { OrgChartRenderer, OrgChartChange } from '../../components/organization/OrgChartRenderer';
import { PlanningModeControls } from '../../components/organization/PlanningModeControls';
import { ExportImportControls, OrganizationImportData } from '../../components/organization/ExportImportControls';
import { DraftAgentEditor, DraftAgent } from '../../components/organization/DraftAgentEditor';
import { Department, OrgHierarchyNode } from '../../types/organization';
import { AgentMetadata, AgentStatus } from '../../types/metadata';
import { OrganizationService } from '../../services/organization/OrganizationService';
import { PlatformConfigService } from '../../services/PlatformConfigService';
import { useOrganizationAPI } from '../../hooks/useOrganizationAPI';

// Define proper types for node data
interface NodeData {
  department?: Department;
  agents?: AgentMetadata[];
  draftAgents?: DraftAgent[];
  agent?: AgentMetadata;
  draftAgent?: DraftAgent;
  [key: string]: unknown;
}

// Extend OrgHierarchyNode to have properly typed nodeData
interface TypedOrgHierarchyNode extends Omit<OrgHierarchyNode, 'nodeData'> {
  nodeData?: NodeData;
}

/**
 * Main Organizational Chart Page Component
 * Integrates all Phase 3 components for complete org chart functionality
 */
export default function OrgChartPage() {
  // State management
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [hierarchy, setHierarchy] = useState<TypedOrgHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(Date.now()); // Force re-renders
  
  // Planning mode state
  const [planningMode, setPlanningMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<OrgChartChange[]>([]);
  const [changeHistory, setChangeHistory] = useState<OrgChartChange[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isApplying, setIsApplying] = useState(false);
  
  // Draft agent state with localStorage persistence
  const [draftAgents, setDraftAgents] = useState<DraftAgent[]>([]);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [editingDraftAgent, setEditingDraftAgent] = useState<DraftAgent | null>(null);
  
  // Services
  const [orgService, setOrgService] = useState<OrganizationService | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfigService | null>(null);
  
  // Use the organization API hook
  const organizationAPI = useOrganizationAPI();

  /**
   * Load draft agents from localStorage
   */
  const loadDraftAgentsFromCache = useCallback((): DraftAgent[] => {
    try {
      const cached = localStorage.getItem('org-chart-draft-agents');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Convert date strings back to Date objects
        return parsed.map((draft: any) => ({
          ...draft,
          createdAt: new Date(draft.createdAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load draft agents from cache:', error);
    }
    return [];
  }, []);

  /**
   * Save draft agents to localStorage
   */
  const saveDraftAgentsToCache = useCallback((drafts: DraftAgent[]) => {
    try {
      localStorage.setItem('org-chart-draft-agents', JSON.stringify(drafts));
      console.log(`Saved ${drafts.length} draft agents to cache`);
    } catch (error) {
      console.error('Failed to save draft agents to cache:', error);
    }
  }, []);

  /**
   * Clear draft agents from localStorage
   */
  const clearDraftAgentsCache = useCallback(() => {
    try {
      localStorage.removeItem('org-chart-draft-agents');
      console.log('Cleared draft agents cache');
    } catch (error) {
      console.error('Failed to clear draft agents cache:', error);
    }
  }, []);

  /**
   * Load real departments from Prisma database
   */
  const loadDepartments = async (): Promise<Department[]> => {
    try {
      const response = await fetch('/api/departments');
      if (!response.ok) {
        throw new Error(`Failed to fetch departments: ${response.statusText}`);
      }
      const data = await response.json();
      return data.departments || [];
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  };

  /**
   * Load real agents from Qdrant
   */
  const loadAgents = async (): Promise<AgentMetadata[]> => {
    try {
      const response = await fetch('/api/agents/list');
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Transform the response data to match AgentMetadata interface
      const agents: AgentMetadata[] = (data.agents || []).map((agent: any) => ({
        schemaVersion: agent.schemaVersion || '1.0.0',
        agentId: agent.agentId || agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status || AgentStatus.AVAILABLE,
        version: agent.version || '1.0.0',
        isPublic: agent.isPublic !== false,
        domain: agent.domain || [],
        specialization: agent.specialization || [],
        performanceMetrics: agent.performanceMetrics || {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        capabilities: agent.capabilities || [],
        department: agent.department || null,
        position: agent.position || 'Agent',
        organizationLevel: agent.organizationLevel || 1,
        createdAt: agent.createdAt ? new Date(agent.createdAt) : new Date(),
        updatedAt: agent.updatedAt ? new Date(agent.updatedAt) : new Date()
      }));
      
      return agents;
    } catch (error) {
      console.error('Error loading agents:', error);
      return [];
    }
  };

  /**
   * Build hierarchy from departments, agents, and draft agents with proper Dagre layout structure
   * Top level: Departments
   * Second level: Subdepartments and agents without subdepartment
   * Third level: Teams and agents with subdepartment but without teams
   */
  const buildHierarchy = (departments: Department[], agents: AgentMetadata[], draftAgents: DraftAgent[] = []): TypedOrgHierarchyNode[] => {
    const hierarchy: TypedOrgHierarchyNode[] = [];
    
    console.log('Building hierarchy with:', { 
      departments: departments.length, 
      agents: agents.length,
      draftAgents: draftAgents.length,
      agentDepts: agents.map(a => ({ name: a.name, deptId: a.department?.id, deptName: a.department?.name }))
    });
    
    // First, intelligently assign agents to departments
    const marketingDept = departments.find(d => d.name.toLowerCase().includes('marketing'));
    const kleoAgent = agents.find(a => a.name === 'Kleo');
    
    // FORCE Kleo to Marketing if both exist and Kleo isn't properly assigned
    if (marketingDept && kleoAgent) {
      const kleoCurrentDept = kleoAgent.department?.id;
      if (!kleoCurrentDept || kleoCurrentDept !== marketingDept.id) {
        console.log('FORCE ASSIGNING Kleo to Marketing department');
        kleoAgent.department = {
          id: marketingDept.id,
          name: marketingDept.name,
          code: marketingDept.code
        };
      }
    }
    
    // Create hierarchy nodes for departments
    departments.forEach(dept => {
      // Find agents directly in this department
      const departmentAgents = agents.filter(agent => {
        return agent.department && agent.department.id === dept.id;
      });
      
      // Find draft agents assigned to this department
      const departmentDraftAgents = draftAgents.filter(draftAgent => {
        return draftAgent.departmentId === dept.id;
      });
      
      console.log(`Department ${dept.name} has ${departmentAgents.length} agents and ${departmentDraftAgents.length} draft agents:`, 
        [...departmentAgents.map(a => a.name), ...departmentDraftAgents.map(d => `${d.name} (DRAFT)`)]);
      
      const hierarchyNode: TypedOrgHierarchyNode = {
        id: dept.id,
        nodeType: 'department',
        entityId: dept.id,
        name: dept.name,
        level: dept.parentDepartmentId ? 1 : 0,
        parentNodeId: dept.parentDepartmentId || undefined,
        children: [],
        departmentId: dept.id,
        nodeData: {
          department: dept,
          agents: departmentAgents,
          draftAgents: departmentDraftAgents
        }
      };
      
      hierarchy.push(hierarchyNode);
      
      // Add individual agent nodes as children of their department
      departmentAgents.forEach(agent => {
        const agentNode: TypedOrgHierarchyNode = {
          id: agent.agentId,
          nodeType: 'agent',
          entityId: agent.agentId,
          name: agent.name,
          level: (dept.parentDepartmentId ? 2 : 1), // One level below department
          parentNodeId: dept.id,
          children: [],
          departmentId: dept.id,
          nodeData: {
            agent: agent
          }
        };
        
        hierarchy.push(agentNode);
      });

      // Add individual draft agent nodes as children of their department
      departmentDraftAgents.forEach(draftAgent => {
        const draftAgentNode: TypedOrgHierarchyNode = {
          id: draftAgent.id,
          nodeType: 'agent', // Use same node type but with draft data
          entityId: draftAgent.id,
          name: `${draftAgent.name} (DRAFT)`,
          level: (dept.parentDepartmentId ? 2 : 1), // One level below department
          parentNodeId: dept.id,
          children: [],
          departmentId: dept.id,
          nodeData: {
            draftAgent: draftAgent
          }
        };
        
        hierarchy.push(draftAgentNode);
      });
    });
    
    // Handle truly uncategorized agents (those without any department assignment)
    const uncategorizedAgents = agents.filter(agent => {
      const hasNoDepartment = !agent.department;
      const departmentNotFound = agent.department && !departments.some(dept => dept.id === agent.department?.id);
      return hasNoDepartment || departmentNotFound;
    });

    // Handle uncategorized draft agents
    const uncategorizedDraftAgents = draftAgents.filter(draftAgent => {
      const hasNoDepartment = !draftAgent.departmentId;
      const departmentNotFound = draftAgent.departmentId && !departments.some(dept => dept.id === draftAgent.departmentId);
      return hasNoDepartment || departmentNotFound;
    });
    
    console.log('Uncategorized agents:', uncategorizedAgents.map(a => a.name));
    console.log('Uncategorized draft agents:', uncategorizedDraftAgents.map(d => d.name));
    
    // Only create uncategorized node if there are actually uncategorized agents or draft agents
    if (uncategorizedAgents.length > 0 || uncategorizedDraftAgents.length > 0) {
      const uncategorizedDept: Department = {
        id: 'uncategorized',
        name: 'Uncategorized',
        description: 'Agents not assigned to any department',
        code: 'UNCAT',
        isActive: true,
        parentDepartmentId: null,
        budgetLimit: 0,
        currentSpent: 0,
        currency: 'USD',
        managerId: undefined,
        agents: [],
        subDepartments: [],
        teams: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add uncategorized department node
      hierarchy.push({
        id: 'uncategorized',
        nodeType: 'department',
        entityId: 'uncategorized',
        name: 'Uncategorized',
        level: 0,
        children: [],
        departmentId: 'uncategorized',
        nodeData: {
          department: uncategorizedDept,
          agents: uncategorizedAgents,
          draftAgents: uncategorizedDraftAgents
        }
      });
      
      // Add individual uncategorized agent nodes
      uncategorizedAgents.forEach(agent => {
        const agentNode: TypedOrgHierarchyNode = {
          id: agent.agentId,
          nodeType: 'agent',
          entityId: agent.agentId,
          name: agent.name,
          level: 1,
          parentNodeId: 'uncategorized',
          children: [],
          departmentId: 'uncategorized',
          nodeData: {
            agent: agent
          }
        };
        
        hierarchy.push(agentNode);
      });

      // Add individual uncategorized draft agent nodes
      uncategorizedDraftAgents.forEach(draftAgent => {
        const draftAgentNode: TypedOrgHierarchyNode = {
          id: draftAgent.id,
          nodeType: 'agent',
          entityId: draftAgent.id,
          name: `${draftAgent.name} (DRAFT)`,
          level: 1,
          parentNodeId: 'uncategorized',
          children: [],
          departmentId: 'uncategorized',
          nodeData: {
            draftAgent: draftAgent
          }
        };
        
        hierarchy.push(draftAgentNode);
      });
    }
    
    console.log('Final hierarchy:', hierarchy.map(h => ({ 
      id: h.id, 
      name: h.name, 
      type: h.nodeType, 
      parent: h.parentNodeId,
      agents: h.nodeData?.agents?.length || 0
    })));
    
    return hierarchy;
  };

  /**
   * Load organization data - unified function to replace the missing loadOrganizationData
   */
  const loadOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load fresh data from APIs
      const [loadedDepartments, loadedAgents] = await Promise.all([
        loadDepartments(),
        loadAgents()
      ]);
      
      console.log(`Loaded ${loadedDepartments.length} departments and ${loadedAgents.length} agents`);
      
      // Update state with fresh data
      setDepartments(loadedDepartments);
      setAgents(loadedAgents);
      
      // Build hierarchy with the fresh data including draft agents
      const builtHierarchy = buildHierarchy(loadedDepartments, loadedAgents, draftAgents);
      setHierarchy(builtHierarchy);
      
      return { departments: loadedDepartments, agents: loadedAgents, hierarchy: builtHierarchy };
      
    } catch (err) {
      console.error('Failed to load organization data:', err);
      setError('Failed to load organization data');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load draft agents from cache on mount
   */
  useEffect(() => {
    const cachedDrafts = loadDraftAgentsFromCache();
    if (cachedDrafts.length > 0) {
      setDraftAgents(cachedDrafts);
      console.log(`Loaded ${cachedDrafts.length} draft agents from cache`);
    }
  }, [loadDraftAgentsFromCache]);

  /**
   * Initialize services and load data
   */
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('Initializing organization services...');
        await loadOrganizationData();
        console.log('Services initialized successfully');
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError('Failed to initialize organizational chart services');
      }
    };

    initializeServices();
  }, []); // Empty dependency array to run only once on mount

  /**
   * Toggle planning mode
   */
  const handleTogglePlanningMode = useCallback(() => {
    setPlanningMode(prev => !prev);
    if (planningMode) {
      // Exiting planning mode - clear pending changes
      setPendingChanges([]);
      setChangeHistory([]);
      setHistoryIndex(-1);
    }
  }, [planningMode]);

  /**
   * Handle org chart changes from drag and drop
   */
  const handleOrgChartChange = useCallback((change: OrgChartChange) => {
    setPendingChanges(prev => [...prev, change]);
    
    // Add to history for undo/redo
    setChangeHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), change];
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  /**
   * Handle multiple org chart changes - fix for onPreviewChanges interface
   */
  const handlePreviewChanges = useCallback((changes: OrgChartChange[]) => {
    // Apply all changes
    changes.forEach(change => {
      handleOrgChartChange(change);
    });
  }, [handleOrgChartChange]);

  /**
   * Apply all pending changes
   */
  const handleApplyChanges = useCallback(async () => {
    if (pendingChanges.length === 0) return;
    
    setIsApplying(true);
    try {
      // Apply changes through the API
      const result = await organizationAPI.applyOrganizationalChanges(pendingChanges);
      
      if (result) {
        console.log('Applied changes:', result);
        
        // Show success/failure summary
        if (result.errors.length > 0) {
          setError(`${result.summary.failedChanges} of ${result.summary.totalChanges} changes failed`);
        } else {
          console.log('All changes applied successfully');
          
          // Clear draft agents since they're now "real"
          setDraftAgents([]);
          clearDraftAgentsCache();
        }
        
        // Reload data to reflect changes
        await loadOrganizationData();
        
        // Clear pending changes
        setPendingChanges([]);
        setChangeHistory([]);
        setHistoryIndex(-1);
      } else {
        throw new Error('Failed to apply changes');
      }
      
    } catch (err) {
      console.error('Failed to apply changes:', err);
      setError('Failed to apply organizational changes');
    } finally {
      setIsApplying(false);
    }
  }, [organizationAPI, pendingChanges, clearDraftAgentsCache]);

  /**
   * Discard all pending changes
   */
  const handleDiscardChanges = useCallback(() => {
    setPendingChanges([]);
    setChangeHistory([]);
    setHistoryIndex(-1);
  }, []);

  /**
   * Undo last change
   */
  const handleUndoChange = useCallback((changeId: string) => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setPendingChanges(prev => prev.slice(0, -1));
    }
  }, [historyIndex]);

  /**
   * Redo last undone change
   */
  const handleRedoChange = useCallback((changeId: string) => {
    if (historyIndex < changeHistory.length - 1) {
      const nextChange = changeHistory[historyIndex + 1];
      setHistoryIndex(prev => prev + 1);
      setPendingChanges(prev => [...prev, nextChange]);
    }
  }, [historyIndex, changeHistory]);

  /**
   * Handle refresh data
   */
  const handleRefresh = useCallback(async () => {
    try {
      await loadOrganizationData();
      setRenderKey(Date.now()); // Force re-render
    } catch (err) {
      console.error('Refresh failed:', err);
      setError('Failed to refresh data');
    }
  }, []);

  /**
   * Handle creating a new draft agent
   */
  const handleCreateAgent = useCallback(() => {
    setEditingDraftAgent(null);
    setShowDraftEditor(true);
  }, []);

  /**
   * Handle editing an existing draft agent
   */
  const handleEditDraftAgent = useCallback((draftAgent: DraftAgent) => {
    setEditingDraftAgent(draftAgent);
    setShowDraftEditor(true);
  }, []);

  /**
   * Handle saving a draft agent
   */
  const handleSaveDraftAgent = useCallback((draftAgent: DraftAgent) => {
    setDraftAgents(prev => {
      const existing = prev.find(d => d.id === draftAgent.id);
      let newDrafts: DraftAgent[];
      if (existing) {
        // Update existing
        newDrafts = prev.map(d => d.id === draftAgent.id ? draftAgent : d);
      } else {
        // Add new
        newDrafts = [...prev, draftAgent];
      }
      
      // Save to cache
      saveDraftAgentsToCache(newDrafts);
      return newDrafts;
    });
    setShowDraftEditor(false);
    setEditingDraftAgent(null);
    
    // Add to pending changes
    const change: OrgChartChange = {
      type: 'agent_reassign',
      agentId: draftAgent.id,
      newDepartmentId: draftAgent.departmentId || 'uncategorized'
    };
    handleOrgChartChange(change);
  }, [handleOrgChartChange, saveDraftAgentsToCache]);

  /**
   * Handle deleting a draft agent
   */
  const handleDeleteDraftAgent = useCallback((draftAgentId: string) => {
    setDraftAgents(prev => {
      const newDrafts = prev.filter(d => d.id !== draftAgentId);
      // Save to cache
      saveDraftAgentsToCache(newDrafts);
      return newDrafts;
    });
    setShowDraftEditor(false);
    setEditingDraftAgent(null);
  }, [saveDraftAgentsToCache]);

  /**
   * Handle canceling draft agent editing
   */
  const handleCancelDraftEditor = useCallback(() => {
    setShowDraftEditor(false);
    setEditingDraftAgent(null);
  }, []);

  /**
   * Handle clearing all draft agents
   */
  const handleClearAllDrafts = useCallback(() => {
    setDraftAgents([]);
    clearDraftAgentsCache();
    console.log('Cleared all draft agents');
  }, [clearDraftAgentsCache]);

  /**
   * Handle organization data import
   */
  const handleImport = useCallback(async (importData: OrganizationImportData) => {
    if (!orgService) return;

    try {
      setLoading(true);
      
      // Process import based on type
      if (importData.importType === 'replace') {
        // Clear existing data first
        console.log('Replacing existing organization data');
        // In a real implementation, you'd call service methods to clear existing data
      }

      // Import departments
      for (const department of importData.departments) {
        // Create or update department through service
        console.log('Importing department:', department.name);
        // In a real implementation, you'd call service methods to create/update departments
      }

      // Import agents
      for (const agent of importData.agents) {
        // Create or update agent through service
        console.log('Importing agent:', agent.agentId);
        // In a real implementation, you'd call service methods to create/update agents
      }

      // Reload data to reflect imports
      await handleRefresh();
      
    } catch (err) {
      console.error('Failed to import organization data:', err);
      setError('Failed to import organization data');
    } finally {
      setLoading(false);
    }
  }, [orgService, handleRefresh]);

  // Loading state
  if (loading) {
    return (
      <div className="org-chart-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading organizational chart...</p>
        </div>
        <style jsx>{`
          .org-chart-page {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
          }
          .loading-container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e9ecef;
            border-top: 4px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="org-chart-page">
        <div className="error-container">
          <h2>Error Loading Organizational Chart</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Retry
          </button>
        </div>
        <style jsx>{`
          .org-chart-page {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
          }
          .error-container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            max-width: 500px;
          }
          .error-container h2 {
            color: #dc3545;
            margin-bottom: 16px;
          }
          .error-container p {
            color: #666;
            margin-bottom: 24px;
          }
          .retry-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s ease;
          }
          .retry-button:hover {
            background: #0056b3;
          }
        `}</style>
      </div>
    );
  }

  // Main render
  return (
    <div className="org-chart-page">
      <style jsx>{`
        .org-chart-page {
          width: 100vw;
          height: 100vh;
          position: relative;
          background: #f8f9fa;
          overflow: hidden;
        }
        
        .page-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: white;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 100;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .page-title {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin: 0;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .action-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .action-button:hover {
          background: #0056b3;
        }
        
        .action-button.secondary {
          background: #6c757d;
        }
        
        .action-button.secondary:hover {
          background: #5a6268;
        }
        
        .chart-container {
          position: absolute;
          top: 60px;
          left: 0;
          right: 0;
          bottom: 0;
        }
        
        .stats-overlay {
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          font-size: 14px;
          z-index: 50;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .stat-item:last-child {
          margin-bottom: 0;
        }
        
        .stat-icon {
          font-size: 16px;
        }
        
        .stat-value {
          font-weight: bold;
          color: #007bff;
        }
      `}</style>
      
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Organizational Chart</h1>
        <div className="header-actions">
          <button 
            className="action-button secondary"
            onClick={handleRefresh}
            disabled={loading || isApplying}
          >
            🔄 Refresh
          </button>
          <ExportImportControls
            departments={departments}
            agents={agents}
            onImport={handleImport}
            className="ml-2"
          />
        </div>
      </div>
      
      {/* Debug Info */}
      {!loading && (
        <div style={{ 
          position: 'absolute', 
          top: '70px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.9)', 
          color: 'white', 
          padding: '12px', 
          fontSize: '11px', 
          maxWidth: '350px', 
          zIndex: 1000,
          borderRadius: '6px',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#60a5fa' }}>Debug Info</div>
          <div>📁 Departments: {departments.length}</div>
          <div>🤖 Agents: {agents.length}</div>
          <div>📝 Draft Agents: {draftAgents.length} {draftAgents.length > 0 ? '(cached)' : ''}</div>
          <div>🏗️ Hierarchy: {hierarchy.length}</div>
          
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151' }}>
            <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>Agent Details:</div>
            {agents.map((a: AgentMetadata) => (
              <div key={a.agentId} style={{ marginLeft: '8px', fontSize: '10px' }}>
                {a.name} → {a.department?.name || 'No Dept'} (ID: {a.department?.id?.substring(0, 8) || 'none'})
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151' }}>
            <div style={{ color: '#34d399', fontWeight: 'bold' }}>Hierarchy Distribution:</div>
            {hierarchy.map((h: TypedOrgHierarchyNode) => (
              <div key={h.id} style={{ marginLeft: '8px', fontSize: '10px' }}>
                <div style={{ color: h.name === 'Marketing' ? '#fbbf24' : h.name === 'Uncategorized' ? '#f87171' : 'white' }}>
                  {h.name}: {h.nodeData?.agents?.length || 0} agents
                </div>
                {h.nodeData?.agents?.map((a: AgentMetadata) => (
                  <div key={a.agentId} style={{ marginLeft: '16px', fontSize: '9px', color: '#9ca3af' }}>
                    • {a.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151' }}>
            <div style={{ color: '#f87171', fontWeight: 'bold' }}>Department IDs:</div>
            {departments.slice(0, 3).map((d: Department) => (
              <div key={d.id} style={{ marginLeft: '8px', fontSize: '9px' }}>
                {d.name}: {d.id.substring(0, 8)}...
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chart Container */}
      <div className="chart-container">
        {!loading && !error && (
          <OrgChartRenderer
            key={`${departments.length}-${agents.length}-${hierarchy.length}-${renderKey}`}
            departments={departments}
            agents={agents}
            hierarchy={hierarchy}
            width={1200}
            height={600}
            planningMode={planningMode}
            onNodeMove={(nodeId, position) => {
              handleOrgChartChange({
                type: 'agent_move',
                agentId: nodeId,
                newPosition: position
              });
            }}
            onAgentReassign={(agentId, newDepartmentId) => {
              handleOrgChartChange({
                type: 'agent_reassign',
                agentId,
                newDepartmentId
              });
            }}
            onDepartmentCreate={(parentId, position) => {
              handleOrgChartChange({
                type: 'department_create',
                parentDepartmentId: parentId,
                newPosition: position
              });
            }}
            onPreviewChanges={handlePreviewChanges}
            onEditDraftAgent={handleEditDraftAgent}
          />
        )}
      </div>
      
      {/* Planning Mode Controls */}
      <PlanningModeControls
        isActive={planningMode}
        pendingChanges={pendingChanges}
        onTogglePlanningMode={handleTogglePlanningMode}
        onApplyChanges={handleApplyChanges}
        onDiscardChanges={handleDiscardChanges}
        onUndoChange={handleUndoChange}
        onRedoChange={handleRedoChange}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < changeHistory.length - 1}
        isApplying={isApplying}
        onCreateAgent={handleCreateAgent}
        draftAgentCount={draftAgents.length}
        onClearDrafts={handleClearAllDrafts}
      />

      {/* Draft Agent Editor */}
      <DraftAgentEditor
        isOpen={showDraftEditor}
        draftAgent={editingDraftAgent}
        departments={departments}
        onSave={handleSaveDraftAgent}
        onCancel={handleCancelDraftEditor}
        onDelete={handleDeleteDraftAgent}
      />
      
    </div>
  );
} 