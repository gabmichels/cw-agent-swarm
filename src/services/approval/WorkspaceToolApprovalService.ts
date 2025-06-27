import { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface WorkspaceToolApprovalSetting {
  id: string;
  agentId: string;
  toolName: string;
  needsApproval: boolean;
  grantedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceToolApprovalService {
  /**
   * Check if a specific tool requires approval for an agent
   */
  requiresApproval(agentId: string, toolName: string): Promise<boolean>;

  /**
   * Set approval requirement for a tool/agent combination
   */
  setApprovalRequirement(
    agentId: string,
    toolName: string,
    needsApproval: boolean,
    grantedBy?: string
  ): Promise<WorkspaceToolApprovalSetting>;

  /**
   * Get all approval settings for an agent
   */
  getAgentApprovalSettings(agentId: string): Promise<WorkspaceToolApprovalSetting[]>;

  /**
   * Get approval settings for all agents for a specific tool
   */
  getToolApprovalSettings(toolName: string): Promise<WorkspaceToolApprovalSetting[]>;

  /**
   * Remove approval setting
   */
  removeApprovalSetting(agentId: string, toolName: string): Promise<void>;
}

export class WorkspaceToolApprovalService implements IWorkspaceToolApprovalService {
  private readonly prismaClient: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prismaClient = prismaClient || prisma;
  }

  async requiresApproval(agentId: string, toolName: string): Promise<boolean> {
    try {
      // Check if AgentWorkspaceToolApproval table exists
      if (!this.prismaClient.agentWorkspaceToolApproval) {
        console.warn(`[WorkspaceToolApprovalService] AgentWorkspaceToolApproval table not available for agent ${agentId} tool ${toolName}. Defaulting to no approval required.`);
        return false;
      }

      const setting = await this.prismaClient.agentWorkspaceToolApproval.findUnique({
        where: {
          unique_agent_tool_approval: {
            agentId,
            toolName
          }
        }
      });

      // If no explicit setting exists, default to false (no approval required)
      return setting?.needsApproval || false;
    } catch (error) {
      console.error(`Error checking approval requirement for agent ${agentId} tool ${toolName}:`, error);
      // Fail safe: if error checking, don't require approval
      return false;
    }
  }

  async setApprovalRequirement(
    agentId: string,
    toolName: string,
    needsApproval: boolean,
    grantedBy?: string
  ): Promise<WorkspaceToolApprovalSetting> {
    const data = {
      agentId,
      toolName,
      needsApproval,
      grantedBy,
      updatedAt: new Date()
    };

    const setting = await this.prismaClient.agentWorkspaceToolApproval.upsert({
      where: {
        unique_agent_tool_approval: {
          agentId,
          toolName
        }
      },
      update: data,
      create: {
        ...data,
        createdAt: new Date()
      }
    });

    return {
      id: setting.id,
      agentId: setting.agentId,
      toolName: setting.toolName,
      needsApproval: setting.needsApproval,
      grantedBy: setting.grantedBy || undefined,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    };
  }

  async getAgentApprovalSettings(agentId: string): Promise<WorkspaceToolApprovalSetting[]> {
    const settings = await this.prismaClient.agentWorkspaceToolApproval.findMany({
      where: { agentId },
      orderBy: { toolName: 'asc' }
    });

    return settings.map((setting: any) => ({
      id: setting.id,
      agentId: setting.agentId,
      toolName: setting.toolName,
      needsApproval: setting.needsApproval,
      grantedBy: setting.grantedBy || undefined,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    }));
  }

  async getToolApprovalSettings(toolName: string): Promise<WorkspaceToolApprovalSetting[]> {
    const settings = await this.prismaClient.agentWorkspaceToolApproval.findMany({
      where: { toolName },
      orderBy: { agentId: 'asc' }
    });

    return settings.map((setting: any) => ({
      id: setting.id,
      agentId: setting.agentId,
      toolName: setting.toolName,
      needsApproval: setting.needsApproval,
      grantedBy: setting.grantedBy || undefined,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    }));
  }

  async removeApprovalSetting(agentId: string, toolName: string): Promise<void> {
    await this.prismaClient.agentWorkspaceToolApproval.delete({
      where: {
        unique_agent_tool_approval: {
          agentId,
          toolName
        }
      }
    });
  }
} 