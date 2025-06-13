/**
 * Database provider interface for abstracting database operations
 * This allows switching between different database technologies (PostgreSQL, Firebase, MongoDB, etc.)
 */

import { PrismaClient } from '@prisma/client';
import {
  WorkspaceConnection,
  WorkspaceConnectionCreateInput,
  WorkspaceConnectionUpdateInput,
  WorkspaceConnectionQuery,
  AgentWorkspacePermission,
  AgentWorkspacePermissionCreateInput,
  AgentWorkspacePermissionUpdateInput,
  AgentWorkspacePermissionQuery,
  WorkspaceAuditLog,
  WorkspaceAuditLogCreateInput,
  WorkspaceAuditLogQuery,
  AgentNotification,
  AgentNotificationCreateInput,
  AgentNotificationQuery,
  NotificationStatus
} from './types';

/**
 * Database provider interface that abstracts database operations
 * Implementations can use Prisma, Firebase, MongoDB, etc.
 */
export interface IDatabaseProvider {
  /**
   * Initialize the database connection
   */
  initialize(): Promise<void>;
  
  /**
   * Close the database connection
   */
  close(): Promise<void>;
  
  /**
   * Get the underlying database client/instance
   * Type depends on the specific implementation
   */
  getClient(): any;
  
  // Workspace Connection Operations
  createWorkspaceConnection(input: WorkspaceConnectionCreateInput): Promise<WorkspaceConnection>;
  getWorkspaceConnection(id: string): Promise<WorkspaceConnection | null>;
  updateWorkspaceConnection(id: string, input: WorkspaceConnectionUpdateInput): Promise<WorkspaceConnection>;
  deleteWorkspaceConnection(id: string): Promise<void>;
  findWorkspaceConnections(query: WorkspaceConnectionQuery): Promise<WorkspaceConnection[]>;
  
  // Agent Workspace Permission Operations
  createAgentWorkspacePermission(input: AgentWorkspacePermissionCreateInput): Promise<AgentWorkspacePermission>;
  getAgentWorkspacePermission(id: string): Promise<AgentWorkspacePermission | null>;
  updateAgentWorkspacePermission(id: string, input: AgentWorkspacePermissionUpdateInput): Promise<AgentWorkspacePermission>;
  deleteAgentWorkspacePermission(id: string): Promise<void>;
  findAgentWorkspacePermissions(query: AgentWorkspacePermissionQuery): Promise<AgentWorkspacePermission[]>;
  
  // Workspace Audit Log Operations
  createWorkspaceAuditLog(input: WorkspaceAuditLogCreateInput): Promise<WorkspaceAuditLog>;
  getWorkspaceAuditLog(id: string): Promise<WorkspaceAuditLog | null>;
  findWorkspaceAuditLogs(query: WorkspaceAuditLogQuery): Promise<WorkspaceAuditLog[]>;
  deleteWorkspaceAuditLog(id: string): Promise<void>;
  
  // Agent Notification Operations
  createAgentNotification(input: AgentNotificationCreateInput): Promise<AgentNotification>;
  getAgentNotification(id: string): Promise<AgentNotification | null>;
  updateAgentNotificationStatus(id: string, status: NotificationStatus, errorMessage?: string): Promise<AgentNotification>;
  findAgentNotifications(query: AgentNotificationQuery): Promise<AgentNotification[]>;
  deleteAgentNotification(id: string): Promise<void>;
}
