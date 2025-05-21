/**
 * Agent Manager Utilities
 * 
 * This file provides utility functions for working with agent managers,
 * including getting information about all available manager types and
 * their implementation status.
 */

import { ManagerType } from '../agents/shared/base/managers/ManagerType';
import { DefaultMemoryManager } from '../lib/agents/implementations/managers/DefaultMemoryManager';
import { DefaultPlanningManager } from '../lib/agents/implementations/managers/DefaultPlanningManager';
import { DefaultToolManager } from '../lib/agents/implementations/managers/DefaultToolManager';
import { DefaultKnowledgeManager } from '../lib/agents/implementations/managers/DefaultKnowledgeManager';
import { DefaultSchedulerManager } from '../lib/agents/implementations/managers/DefaultSchedulerManager';
import { DefaultAutonomyManager } from '../agents/shared/autonomy/managers/DefaultAutonomyManager';
import { DefaultInputProcessor } from '../agents/shared/input/managers/DefaultInputProcessor';
import { DefaultOutputProcessor } from '../agents/shared/output/managers/DefaultOutputProcessor';
import { FileProcessingManager } from '../lib/agents/implementations/managers/FileProcessingManager';
import { DefaultResourceManager } from '../agents/shared/resource/DefaultResourceManager';
import { DefaultReflectionManager } from '../agents/shared/reflection/managers/DefaultReflectionManager';
import { StatusManager } from '../agents/shared/status/StatusManager';
import { DefaultNotificationManager } from '../agents/shared/notifications/DefaultNotificationManager';
import { AgentBase } from '../agents/shared/base/AgentBase.interface';
import { NotificationChannel } from '../agents/shared/notifications/interfaces/NotificationManager.interface';

/**
 * Implementation status for managers
 */
export enum ManagerImplementationStatus {
  FULL = 'FULL',               // Fully implemented
  PARTIAL = 'PARTIAL',         // Partially implemented
  PLACEHOLDER = 'PLACEHOLDER', // Only placeholder implementation
  MISSING = 'MISSING'          // No implementation available
}

/**
 * Manager information structure
 */
export interface ManagerInfo {
  /** Manager type identifier */
  type: ManagerType;
  
  /** Display name */
  name: string;
  
  /** Brief description */
  description: string;
  
  /** Implementation status */
  implementationStatus: ManagerImplementationStatus;
  
  /** Implementation class name if available */
  implementationClass?: string;
  
  /** Interface name */
  interfaceName: string;
  
  /** Whether the manager is required for basic agent functionality */
  isRequired: boolean;
  
  /** Capabilities provided by this manager */
  capabilities: string[];
}

/**
 * Get information about all available manager types
 * 
 * @returns Array of manager information objects
 */
export function getAllManagerTypes(): ManagerInfo[] {
  return [
    {
      type: ManagerType.MEMORY,
      name: 'Memory Manager',
      description: 'Manages agent memory storage, retrieval, and processing',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultMemoryManager',
      interfaceName: 'MemoryManager',
      isRequired: true,
      capabilities: ['memory_storage', 'memory_retrieval', 'memory_processing']
    },
    {
      type: ManagerType.PLANNING,
      name: 'Planning Manager',
      description: 'Handles plan creation, execution, and adaptation',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultPlanningManager',
      interfaceName: 'PlanningManager',
      isRequired: false,
      capabilities: ['plan_creation', 'plan_execution', 'plan_adaptation']
    },
    {
      type: ManagerType.TOOL,
      name: 'Tool Manager',
      description: 'Manages agent tools and tool execution',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultToolManager',
      interfaceName: 'ToolManager',
      isRequired: false,
      capabilities: ['tool_discovery', 'tool_execution', 'tool_management']
    },
    {
      type: ManagerType.KNOWLEDGE,
      name: 'Knowledge Manager',
      description: 'Manages structured knowledge and knowledge graph',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultKnowledgeManager',
      interfaceName: 'KnowledgeManager',
      isRequired: false,
      capabilities: ['knowledge_storage', 'knowledge_retrieval', 'knowledge_graph']
    },
    {
      type: ManagerType.REFLECTION,
      name: 'Reflection Manager',
      description: 'Enables self-assessment and reflection capabilities',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultReflectionManager',
      interfaceName: 'ReflectionManager',
      isRequired: false,
      capabilities: ['self_assessment', 'performance_analysis', 'improvement']
    },
    {
      type: ManagerType.SCHEDULER,
      name: 'Scheduler Manager',
      description: 'Manages task scheduling and execution',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultSchedulerManager',
      interfaceName: 'SchedulerManager',
      isRequired: true,
      capabilities: ['task_scheduling', 'task_execution', 'task_prioritization']
    },
    {
      type: ManagerType.INPUT,
      name: 'Input Processor',
      description: 'Processes and validates input messages',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultInputProcessor',
      interfaceName: 'InputProcessor',
      isRequired: false,
      capabilities: ['input_processing', 'input_validation']
    },
    {
      type: ManagerType.OUTPUT,
      name: 'Output Processor',
      description: 'Formats and delivers output messages',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultOutputProcessor',
      interfaceName: 'OutputProcessor',
      isRequired: false,
      capabilities: ['output_formatting', 'output_delivery']
    },
    {
      type: ManagerType.AUTONOMY,
      name: 'Autonomy Manager',
      description: 'Controls autonomous behavior and goal-driven actions',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultAutonomyManager',
      interfaceName: 'AutonomyManager',
      isRequired: true,
      capabilities: ['autonomous_operation', 'goal_management', 'opportunity_detection']
    },
    {
      type: ManagerType.MESSAGING,
      name: 'Messaging Manager',
      description: 'Handles inter-agent communication',
      implementationStatus: ManagerImplementationStatus.PLACEHOLDER,
      interfaceName: 'MessagingManager',
      isRequired: false,
      capabilities: ['agent_communication', 'message_routing']
    },
    {
      type: ManagerType.LOGGER,
      name: 'Logger Manager',
      description: 'Provides specialized logging capabilities',
      implementationStatus: ManagerImplementationStatus.PLACEHOLDER,
      interfaceName: 'LoggerManager',
      isRequired: false,
      capabilities: ['structured_logging', 'log_filtering']
    },
    {
      type: ManagerType.FILE_PROCESSING,
      name: 'File Processing Manager',
      description: 'Manages file operations',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'FileProcessingManager',
      interfaceName: 'FileProcessingManager',
      isRequired: false,
      capabilities: ['file_reading', 'file_writing', 'file_processing']
    },
    {
      type: ManagerType.RESOURCE,
      name: 'Resource Manager',
      description: 'Manages and monitors resource utilization',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'DefaultResourceManager',
      interfaceName: 'ResourceManager',
      isRequired: false,
      capabilities: ['resource_monitoring', 'resource_allocation', 'resource_optimization']
    },
    {
      type: ManagerType.INTEGRATION,
      name: 'Integration Manager',
      description: 'Handles external service integrations',
      implementationStatus: ManagerImplementationStatus.PLACEHOLDER,
      interfaceName: 'IntegrationManager',
      isRequired: false,
      capabilities: ['service_integration', 'api_management']
    },
    {
      type: ManagerType.STATUS,
      name: 'Status Manager',
      description: 'Tracks and reports agent status',
      implementationStatus: ManagerImplementationStatus.FULL,
      implementationClass: 'StatusManager',
      interfaceName: 'StatusManager',
      isRequired: false,
      capabilities: ['status_tracking', 'status_reporting', 'status_visualization']
    },
    {
      type: ManagerType.NOTIFICATION,
      name: 'Notification Manager',
      description: 'Manages notifications and delivery across channels',
      implementationStatus: ManagerImplementationStatus.PARTIAL,
      implementationClass: 'DefaultNotificationManager',
      interfaceName: 'NotificationManager',
      isRequired: false,
      capabilities: ['notification_delivery', 'notification_channels', 'notification_actions']
    }
  ];
}

/**
 * Get manager info by type
 * 
 * @param type Manager type
 * @returns Manager info or undefined if not found
 */
export function getManagerInfo(type: ManagerType): ManagerInfo | undefined {
  return getAllManagerTypes().find(manager => manager.type === type);
}

/**
 * Get all fully implemented managers
 * 
 * @returns Array of fully implemented manager infos
 */
export function getFullyImplementedManagers(): ManagerInfo[] {
  return getAllManagerTypes().filter(
    manager => manager.implementationStatus === ManagerImplementationStatus.FULL
  );
}

/**
 * Get all required managers
 * 
 * @returns Array of required manager infos
 */
export function getRequiredManagers(): ManagerInfo[] {
  return getAllManagerTypes().filter(manager => manager.isRequired);
}

/**
 * Get missing or placeholder managers in an agent
 * 
 * @param agent Agent instance
 * @returns Array of manager types that are missing or just placeholders
 */
export function getMissingManagers(agent: AgentBase): ManagerType[] {
  const missingManagerTypes: ManagerType[] = [];
  
  for (const managerInfo of getAllManagerTypes()) {
    // Skip managers that aren't fully implemented in the system
    if (managerInfo.implementationStatus === ManagerImplementationStatus.PLACEHOLDER ||
        managerInfo.implementationStatus === ManagerImplementationStatus.MISSING) {
      continue;
    }
    
    // Check if agent has this manager
    const manager = agent.getManager(managerInfo.type);
    if (!manager) {
      missingManagerTypes.push(managerInfo.type);
    }
  }
  
  return missingManagerTypes;
}

/**
 * Check if an agent is fully capable (has all required managers)
 * 
 * @param agent Agent instance
 * @returns True if the agent has all required managers
 */
export function isFullyCapableAgent(agent: AgentBase): boolean {
  const requiredManagers = getRequiredManagers();
  
  for (const managerInfo of requiredManagers) {
    const manager = agent.getManager(managerInfo.type);
    if (!manager) {
      return false;
    }
  }
  
  return true;
}

/**
 * Gets an instance of the specified manager class
 * 
 * @param type Manager type
 * @param agent Agent to attach the manager to
 * @returns A new instance of the specified manager or undefined if not implemented
 */
export function createManagerInstance(type: ManagerType, agent: AgentBase): any | undefined {
  switch (type) {
    case ManagerType.MEMORY:
      return new DefaultMemoryManager(agent, { enabled: true });
    
    case ManagerType.PLANNING:
      return new DefaultPlanningManager(agent, { enabled: true });
    
    case ManagerType.TOOL:
      return new DefaultToolManager(agent, { enabled: true });
    
    case ManagerType.KNOWLEDGE:
      return new DefaultKnowledgeManager(agent, { enabled: true });
    
    case ManagerType.REFLECTION:
      return new DefaultReflectionManager(agent, { enabled: true });
    
    case ManagerType.SCHEDULER:
      return new DefaultSchedulerManager(agent, { enabled: true });
    
    case ManagerType.INPUT:
      return new DefaultInputProcessor(agent, { enabled: true });
    
    case ManagerType.OUTPUT:
      return new DefaultOutputProcessor(agent, { enabled: true });

    case ManagerType.NOTIFICATION:
      const notificationManager = new DefaultNotificationManager();
      // Initialize with basic config
      notificationManager.initialize({
        defaultSenderId: agent.getAgentId(),
        channels: [
          {
            type: NotificationChannel.UI,
            name: 'UI Notifications',
            enabled: true,
            config: {}
          }
        ]
      }).catch(error => {
        console.error('Failed to initialize notification manager:', error);
      });
      return notificationManager;
    
    case ManagerType.AUTONOMY:
      return new DefaultAutonomyManager(agent, { 
        enabled: true,
        autonomyConfig: {
          enableAutonomyOnStartup: true,
          enableOpportunityDetection: true,
          maxConcurrentTasks: 3
        }
      });
    
    case ManagerType.FILE_PROCESSING:
      return new FileProcessingManager(agent, { enabled: true });
    
    case ManagerType.RESOURCE:
      return new DefaultResourceManager(agent, { enabled: true });
    
    case ManagerType.STATUS:
      return new StatusManager(agent, { enabled: true });
    
    // Placeholders or missing implementations return undefined
    default:
      return undefined;
  }
}

/**
 * Get a list of all capabilities provided by fully implemented managers
 * 
 * @returns Array of capability strings
 */
export function getAllAvailableCapabilities(): string[] {
  const capabilities = new Set<string>();
  
  getAllManagerTypes()
    .filter(manager => manager.implementationStatus === ManagerImplementationStatus.FULL)
    .forEach(manager => {
      manager.capabilities.forEach(capability => capabilities.add(capability));
    });
  
  return Array.from(capabilities);
} 