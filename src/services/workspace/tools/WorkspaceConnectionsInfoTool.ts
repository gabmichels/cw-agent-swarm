import { AgentTool, AgentContext } from './WorkspaceAgentTools';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { WorkspaceCapabilityType } from '../../database/types';

/**
 * Tool that provides information about available workspace connections
 * This allows the LLM to understand what options are available and ask users to clarify
 */
export class WorkspaceConnectionsInfoTool {
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Get available workspace connections for a specific capability
   */
  public getAvailableConnectionsTool: AgentTool<{ capability: WorkspaceCapabilityType }, any> = {
    name: "get_available_workspace_connections",
    description: "Get all available workspace connections for a specific capability (like EMAIL_SEND). Use this to understand what email accounts, calendar providers, etc. are available before performing actions.",
    parameters: {
      type: "object",
      properties: {
        capability: {
          type: "string",
          enum: [
            "EMAIL_SEND", "EMAIL_READ", 
            "CALENDAR_CREATE", "CALENDAR_READ", "CALENDAR_EDIT", "CALENDAR_DELETE",
            "SPREADSHEET_CREATE", "SPREADSHEET_READ", "SPREADSHEET_EDIT",
            "DRIVE_READ", "DRIVE_UPLOAD", "DRIVE_SHARE"
          ],
          description: "The workspace capability you want to use"
        }
      },
      required: ["capability"]
    },
    execute: async (params: { capability: WorkspaceCapabilityType }, context: AgentContext) => {
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(context.agentId);
      
      const relevantConnections = capabilities
        .filter(cap => cap.capability === params.capability)
        .map(cap => ({
          connectionId: cap.connectionId,
          provider: cap.provider,
          connectionName: cap.connectionName,
          accessLevel: cap.accessLevel
        }));

      if (relevantConnections.length === 0) {
        return {
          success: false,
          message: `No ${params.capability} connections available. Please connect a workspace provider first.`,
          connections: []
        };
      }

      if (relevantConnections.length === 1) {
        return {
          success: true,
          message: `One ${params.capability} connection available: ${relevantConnections[0].connectionName}`,
          connections: relevantConnections,
          recommendation: "You can proceed with this connection.",
          autoSelect: relevantConnections[0].connectionId
        };
      }

      // Multiple connections available
      const connectionsList = relevantConnections
        .map((conn, index) => `${index + 1}. ${conn.connectionName} (${conn.provider})`)
        .join('\n');

      return {
        success: true,
        message: `Multiple ${params.capability} connections available:\n${connectionsList}`,
        connections: relevantConnections,
        recommendation: "Please specify which connection to use, or ask the user to choose.",
        requiresUserChoice: true
      };
    }
  };

  /**
   * Get all workspace connections for the agent (overview)
   */
  public getAllConnectionsTool: AgentTool<{}, any> = {
    name: "get_all_workspace_connections",
    description: "Get an overview of all workspace connections available to this agent across all capabilities",
    parameters: {
      type: "object",
      properties: {},
      required: []
    },
    execute: async (params: {}, context: AgentContext) => {
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(context.agentId);
      
      if (capabilities.length === 0) {
        return {
          success: false,
          message: "No workspace connections available. Please connect to Google Workspace, Microsoft 365, or Zoho first.",
          connections: []
        };
      }

      // Group by connection ID to avoid duplicates
      const connectionsMap = new Map();
      capabilities.forEach(cap => {
        if (!connectionsMap.has(cap.connectionId)) {
          connectionsMap.set(cap.connectionId, {
            connectionId: cap.connectionId,
            connectionName: cap.connectionName,
            provider: cap.provider,
            capabilities: []
          });
        }
        connectionsMap.get(cap.connectionId).capabilities.push({
          capability: cap.capability,
          accessLevel: cap.accessLevel
        });
      });

      const connections = Array.from(connectionsMap.values());
      
      const summary = connections.map(conn => 
        `• ${conn.connectionName} (${conn.provider}): ${conn.capabilities.map((c: any) => c.capability).join(', ')}`
      ).join('\n');

      return {
        success: true,
        message: `Available workspace connections:\n${summary}`,
        connections,
        totalConnections: connections.length
      };
    }
  };
} 