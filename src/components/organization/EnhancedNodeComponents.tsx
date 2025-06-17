'use client';

import React from 'react';
import { Department } from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';

export const ENHANCED_DEPARTMENT_THEMES = {
  engineering: { 
    color: '#2196F3', 
    bgColor: '#E3F2FD', 
    icon: '⚙️',
    gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
    shadowColor: 'rgba(33, 150, 243, 0.3)'
  },
  operations: { 
    color: '#FF9800', 
    bgColor: '#FFF3E0', 
    icon: '🔧',
    gradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
    shadowColor: 'rgba(255, 152, 0, 0.3)'
  },
  marketing: { 
    color: '#E91E63', 
    bgColor: '#FCE4EC', 
    icon: '📈',
    gradient: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)',
    shadowColor: 'rgba(233, 30, 99, 0.3)'
  },
  sales: { 
    color: '#4CAF50', 
    bgColor: '#E8F5E0', 
    icon: '💼',
    gradient: 'linear-gradient(135deg, #E8F5E0 0%, #C8E6C9 100%)',
    shadowColor: 'rgba(76, 175, 80, 0.3)'
  },
  finance: { 
    color: '#9C27B0', 
    bgColor: '#F3E5F5', 
    icon: '💰',
    gradient: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
    shadowColor: 'rgba(156, 39, 176, 0.3)'
  },
  hr: { 
    color: '#607D8B', 
    bgColor: '#ECEFF1', 
    icon: '👥',
    gradient: 'linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%)',
    shadowColor: 'rgba(96, 125, 139, 0.3)'
  },
  default: { 
    color: '#757575', 
    bgColor: '#F5F5F5', 
    icon: '🏢',
    gradient: 'linear-gradient(135deg, #F5F5F5 0%, #EEEEEE 100%)',
    shadowColor: 'rgba(117, 117, 117, 0.3)'
  }
} as const;

export const ENHANCED_AGENT_STATUS_CONFIG = {
  AVAILABLE: { 
    color: '#4CAF50', 
    icon: '●', 
    label: 'Available',
    pulse: false,
    bgColor: '#E8F5E0'
  },
  BUSY: { 
    color: '#FF9800', 
    icon: '●', 
    label: 'Busy',
    pulse: true,
    bgColor: '#FFF3E0'
  },
  OFFLINE: { 
    color: '#9E9E9E', 
    icon: '●', 
    label: 'Offline',
    pulse: false,
    bgColor: '#F5F5F5'
  },
  MAINTENANCE: { 
    color: '#F44336', 
    icon: '●', 
    label: 'Maintenance',
    pulse: true,
    bgColor: '#FFEBEE'
  }
} as const;

export const getEnhancedDepartmentTheme = (departmentName: string) => {
  const name = departmentName.toLowerCase();
  
  if (name.includes('engineering') || name.includes('tech') || name.includes('dev')) {
    return ENHANCED_DEPARTMENT_THEMES.engineering;
  }
  if (name.includes('operations') || name.includes('ops')) {
    return ENHANCED_DEPARTMENT_THEMES.operations;
  }
  if (name.includes('marketing')) {
    return ENHANCED_DEPARTMENT_THEMES.marketing;
  }
  if (name.includes('sales')) {
    return ENHANCED_DEPARTMENT_THEMES.sales;
  }
  if (name.includes('finance') || name.includes('accounting')) {
    return ENHANCED_DEPARTMENT_THEMES.finance;
  }
  if (name.includes('hr') || name.includes('human') || name.includes('people')) {
    return ENHANCED_DEPARTMENT_THEMES.hr;
  }
  
  return ENHANCED_DEPARTMENT_THEMES.default;
};

export const calculateDepartmentSize = (agentCount: number) => {
  const baseWidth = 280;
  const baseHeight = 180;
  const scaleFactor = Math.min(1.5, 1 + (agentCount / 20));
  
  return {
    width: Math.round(baseWidth * scaleFactor),
    height: Math.round(baseHeight * scaleFactor),
    scale: scaleFactor
  };
};

export const calculateAgentSize = (agent: AgentMetadata) => {
  const baseWidth = 160;
  const baseHeight = 70;
  
  const capabilityCount = agent.capabilities?.length || 0;
  const isManager = agent.managedAgents && agent.managedAgents.length > 0;
  
  let scaleFactor = 1;
  
  if (capabilityCount > 5) scaleFactor += 0.2;
  if (capabilityCount > 10) scaleFactor += 0.1;
  
  if (isManager) scaleFactor += 0.3;
  
  scaleFactor = Math.min(1.6, scaleFactor);
  
  return {
    width: Math.round(baseWidth * scaleFactor),
    height: Math.round(baseHeight * scaleFactor),
    scale: scaleFactor
  };
};

export interface EnhancedDepartmentNodeProps {
  data: {
    department: Department;
    agentCount: number;
    headName?: string;
    planningMode: boolean;
    onEdit?: (deptId: string) => void;
    onExpand?: (deptId: string) => void;
    isExpanded?: boolean;
  };
}

export const EnhancedDepartmentNode: React.FC<EnhancedDepartmentNodeProps> = ({ data }) => {
  const theme = getEnhancedDepartmentTheme(data.department.name);
  const size = calculateDepartmentSize(data.agentCount);
  
  return (
    <div 
      className="enhanced-department-node"
      style={{
        width: size.width,
        height: size.height,
        background: theme.gradient,
        border: `2px solid ${theme.color}`,
        borderRadius: '16px',
        padding: '16px',
        boxShadow: `0 8px 24px ${theme.shadowColor}`,
        position: 'relative',
        transition: 'all 0.3s ease',
        cursor: data.planningMode ? 'grab' : 'default'
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '12px',
        borderBottom: `1px solid ${theme.color}`,
        paddingBottom: '8px'
      }}>
        <span style={{ fontSize: `${24 * size.scale}px`, marginRight: '12px' }}>{theme.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            margin: 0, 
            color: theme.color, 
            fontSize: `${16 * size.scale}px`, 
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {data.department.name}
          </h3>
          {data.department.description && (
            <p style={{ 
              margin: 0, 
              color: '#666', 
              fontSize: `${12 * size.scale}px`,
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {data.department.description}
            </p>
          )}
        </div>
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: `${11 * size.scale}px`, color: '#666', gap: '4px' }}>
          <span style={{ fontSize: `${14 * size.scale}px` }}>👥</span>
          <span>{data.agentCount} agents</span>
        </div>
        {data.headName && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: `${11 * size.scale}px`, color: '#666', gap: '4px' }}>
            <span style={{ fontSize: `${14 * size.scale}px` }}>👤</span>
            <span>{data.headName}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: `${11 * size.scale}px`, color: '#666', gap: '4px' }}>
          <span style={{ fontSize: `${14 * size.scale}px` }}>📊</span>
          <span>{Math.round((data.agentCount / Number(data.department.maxCapacity || 10)) * 100)}% util</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: `${11 * size.scale}px`, color: '#666', gap: '4px' }}>
          <span style={{ fontSize: `${14 * size.scale}px` }}>⚡</span>
          <span>Active</span>
        </div>
      </div>
      
      <div style={{
        width: '100%',
        height: '6px',
        background: 'rgba(0,0,0,0.1)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginTop: '8px'
      }}>
        <div 
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${theme.color} 0%, ${theme.color} 100%)`,
            width: `${Math.min(100, (data.agentCount / Number(data.department.maxCapacity || 10)) * 100)}%`,
            transition: 'width 0.3s ease',
            borderRadius: '3px'
          }}
        />
      </div>
      
      {data.planningMode && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '6px'
        }}>
          <button 
            style={{
              background: theme.color,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: `${10 * size.scale}px`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onClick={() => data.onEdit?.(data.department.id)}
            title="Edit department"
          >
            ✏️
          </button>
        </div>
      )}
    </div>
  );
};

export interface EnhancedAgentNodeProps {
  data: {
    agent: AgentMetadata;
    planningMode: boolean;
    departmentTheme?: any;
    onAgentClick?: (agentId: string) => void;
    onStatusChange?: (agentId: string, newStatus: string) => void;
    showAvatar?: boolean;
  };
}

export const EnhancedAgentNode: React.FC<EnhancedAgentNodeProps> = ({ data }) => {
  const statusConfig = ENHANCED_AGENT_STATUS_CONFIG[data.agent.status as unknown as keyof typeof ENHANCED_AGENT_STATUS_CONFIG] || ENHANCED_AGENT_STATUS_CONFIG.OFFLINE;
  const size = calculateAgentSize(data.agent);
  const isManager = data.agent.managedAgents && data.agent.managedAgents.length > 0;
  
  return (
    <div 
      className="enhanced-agent-node"
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: statusConfig.bgColor,
        border: `2px solid ${statusConfig.color}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: data.planningMode ? 'grab' : 'pointer',
        transition: 'all 0.3s ease'
      }}
      onClick={() => data.onAgentClick?.(data.agent.agentId)}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0
        }}>
          {data.showAvatar && (
            <div style={{
              width: `${24 * size.scale}px`,
              height: `${24 * size.scale}px`,
              borderRadius: '50%',
              background: `linear-gradient(45deg, ${statusConfig.color}, ${statusConfig.color})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${12 * size.scale}px`,
              marginRight: '8px',
                             border: `2px solid ${statusConfig.color}`
            }}>
              {data.agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div 
            style={{
              width: `${10 * size.scale}px`,
              height: `${10 * size.scale}px`,
              borderRadius: '50%',
              backgroundColor: statusConfig.color,
              marginRight: '8px',
              flexShrink: 0
            }}
            title={statusConfig.label}
          />
          <h4 style={{ 
            margin: 0, 
            fontSize: `${14 * size.scale}px`, 
            fontWeight: 'bold',
            color: '#333',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1
          }}>
            {data.agent.name}
          </h4>
          {isManager && (
            <span style={{
              background: 'linear-gradient(45deg, #FFD700, #FFA500)',
              color: '#333',
              borderRadius: '8px',
              padding: '2px 6px',
              fontSize: `${10 * size.scale}px`,
              fontWeight: 'bold',
              marginLeft: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              MGR
            </span>
          )}
        </div>
        
        {data.planningMode && (
          <div style={{
            fontSize: `${12 * size.scale}px`,
            color: '#999',
            cursor: 'grab',
            padding: '2px'
          }} title="Drag to move">
            ⋮⋮
          </div>
        )}
      </div>
      
      {data.agent.position && (
        <div style={{ 
          fontSize: `${12 * size.scale}px`, 
          color: '#666', 
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          💼 {data.agent.position}
        </div>
      )}
      
      <div style={{ 
        fontSize: `${11 * size.scale}px`, 
        color: '#999',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span>🔧</span>
        <span style={{
          background: statusConfig.bgColor,
          color: statusConfig.color,
          borderRadius: '10px',
          padding: '2px 6px',
          fontWeight: '500'
        }}>
          {data.agent.capabilities?.length || 0}
        </span>
        <span>capabilities</span>
      </div>
    </div>
  );
};

export default {
  EnhancedDepartmentNode,
  EnhancedAgentNode,
  getEnhancedDepartmentTheme,
  calculateDepartmentSize,
  calculateAgentSize
}; 