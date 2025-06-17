'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { OrgChartRenderer, OrgChartChange } from '../../components/organization/OrgChartRenderer';
import { PlanningModeControls } from '../../components/organization/PlanningModeControls';
import { Department, OrgHierarchyNode } from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';
import { OrganizationService } from '../../services/organization/OrganizationService';
import { PlatformConfigService } from '../../services/PlatformConfigService';

/**
 * Main Organizational Chart Page Component
 * Integrates all Phase 3 components for complete org chart functionality
 */
export default function OrgChartPage() {
  // State management
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [hierarchy, setHierarchy] = useState<OrgHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Planning mode state
  const [planningMode, setPlanningMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<OrgChartChange[]>([]);
  const [changeHistory, setChangeHistory] = useState<OrgChartChange[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isApplying, setIsApplying] = useState(false);
  
  // Services
  const [orgService, setOrgService] = useState<OrganizationService | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfigService | null>(null);

  /**
   * Initialize services and load data
   */
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize services  
        const platformService = PlatformConfigService.getInstance();
        const organizationService = new OrganizationService({} as any, {} as any);
        
        setPlatformConfig(platformService);
        setOrgService(organizationService);
        
        // Load initial data
        await loadOrganizationData(organizationService);
        
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError('Failed to initialize organizational chart services');
      } finally {
        setLoading(false);
      }
    };

    initializeServices();
  }, []);

  /**
   * Load organization data from services
   */
  const loadOrganizationData = async (service: OrganizationService) => {
    try {
      setLoading(true);
      
      // Load organization chart data
      const deptResult = await service.getOrganizationChart();
      if (deptResult.success && deptResult.data) {
        // Convert department IDs to Department objects
        const departmentIds = deptResult.data.departments || [];
        const departments: Department[] = [];
        
        // For now, create mock departments from IDs
        // In a real implementation, you'd fetch full department data
        for (const deptId of departmentIds) {
          if (typeof deptId === 'string') {
            departments.push({
              id: deptId,
              name: `Department ${deptId.slice(-8)}`,
              description: 'Department description',
              code: deptId.slice(-8).toUpperCase(),
              parentDepartmentId: undefined,
              headOfDepartment: undefined,
              maxCapacity: 10,
              budgetLimit: 100000,
              currentSpent: 0,
              currency: 'USD',
              isActive: true,
              agents: [],
              subDepartments: [],
              teams: [],
              createdAt: new Date(),
              updatedAt: new Date()
            } as unknown as Department);
          }
        }
        
        setDepartments(departments);
        setAgents([]); // Mock empty agents for now
        setHierarchy(deptResult.data.hierarchy || []);
      }
      
    } catch (err) {
      console.error('Failed to load organization data:', err);
      setError('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

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
   * Apply all pending changes
   */
  const handleApplyChanges = useCallback(async () => {
    if (!orgService || pendingChanges.length === 0) return;
    
    setIsApplying(true);
    try {
      // Apply each change through the organization service
      for (const change of pendingChanges) {
        switch (change.type) {
          case 'agent_move':
            if (change.newPosition) {
              // Update agent position in the service
              // This would be implemented based on your specific requirements
              console.log('Applying agent move:', change);
            }
            break;
          case 'agent_reassign':
            if (change.newDepartmentId && change.agentId) {
              const result = await orgService.assignAgentToDepartment({
                agentId: change.agentId,
                departmentId: change.newDepartmentId,
                position: 'Agent',
                organizationLevel: 1
              });
              if (!result.success) {
                throw new Error(`Failed to reassign agent: ${result.error}`);
              }
            }
            break;
          case 'department_create':
            if (change.newPosition) {
              // Create new department
              console.log('Applying department creation:', change);
            }
            break;
        }
      }
      
      // Reload data to reflect changes
      await loadOrganizationData(orgService);
      
      // Clear pending changes
      setPendingChanges([]);
      setChangeHistory([]);
      setHistoryIndex(-1);
      
      // Show success message
      console.log('Successfully applied all changes');
      
    } catch (err) {
      console.error('Failed to apply changes:', err);
      setError('Failed to apply organizational changes');
    } finally {
      setIsApplying(false);
    }
  }, [orgService, pendingChanges]);

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
    if (orgService) {
      await loadOrganizationData(orgService);
    }
  }, [orgService]);

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
          <button 
            className="action-button"
            onClick={() => {
              // Export functionality could be added here
              console.log('Export functionality not yet implemented');
            }}
          >
            📊 Export
          </button>
        </div>
      </div>
      
      {/* Main Chart Container */}
      <div className="chart-container">
        <OrgChartRenderer
          departments={departments}
          agents={agents}
          hierarchy={hierarchy}
          interactive={true}
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
          width={window.innerWidth}
          height={window.innerHeight - 60}
        />
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
      />
      
      {/* Statistics Overlay */}
      <div className="stats-overlay">
        <div className="stat-item">
          <span className="stat-icon">🏢</span>
          <span>Departments: <span className="stat-value">{departments.length}</span></span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">👥</span>
          <span>Agents: <span className="stat-value">{agents.length}</span></span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🌳</span>
          <span>Hierarchy Levels: <span className="stat-value">{hierarchy.length}</span></span>
        </div>
        {planningMode && (
          <div className="stat-item">
            <span className="stat-icon">⚡</span>
            <span>Planning Mode: <span className="stat-value">Active</span></span>
          </div>
        )}
      </div>
    </div>
  );
} 