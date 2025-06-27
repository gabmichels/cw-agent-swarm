import { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { SocialMediaCapability, SocialMediaProvider } from '../social-media/database/ISocialMediaDatabase';

export interface SocialMediaToolApprovalSetting {
  id: string;
  agentId: string;
  toolName: string;
  needsApproval: boolean;
  grantedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialMediaToolApprovalService {
  /**
   * Check if a specific social media tool requires approval for an agent
   */
  requiresApproval(agentId: string, toolName: string): Promise<boolean>;

  /**
   * Set approval requirement for a social media tool/agent combination
   */
  setApprovalRequirement(
    agentId: string,
    toolName: string,
    needsApproval: boolean,
    grantedBy?: string
  ): Promise<SocialMediaToolApprovalSetting>;

  /**
   * Get all social media approval settings for an agent
   */
  getAgentApprovalSettings(agentId: string): Promise<SocialMediaToolApprovalSetting[]>;

  /**
   * Get approval settings for all agents for a specific social media tool
   */
  getToolApprovalSettings(toolName: string): Promise<SocialMediaToolApprovalSetting[]>;

  /**
   * Remove social media approval setting
   */
  removeApprovalSetting(agentId: string, toolName: string): Promise<void>;

  /**
   * Generate tool name from capability and provider
   */
  generateToolName(capability: SocialMediaCapability, provider: SocialMediaProvider): string;
}

export class SocialMediaToolApprovalService implements ISocialMediaToolApprovalService {
  constructor() { }

  async requiresApproval(agentId: string, toolName: string): Promise<boolean> {
    try {
      const setting = await prisma.agentSocialMediaToolApproval.findUnique({
        where: {
          unique_agent_social_tool_approval: {
            agentId,
            toolName
          }
        }
      });

      // If no explicit setting exists, default to false (no approval required)
      return setting?.needsApproval || false;
    } catch (error) {
      console.error(`Error checking social media approval requirement for agent ${agentId} tool ${toolName}:`, error);
      // Fail safe: if error checking, don't require approval
      return false;
    }
  }

  async setApprovalRequirement(
    agentId: string,
    toolName: string,
    needsApproval: boolean,
    grantedBy?: string
  ): Promise<SocialMediaToolApprovalSetting> {
    const data = {
      agentId,
      toolName,
      needsApproval,
      grantedBy,
      updatedAt: new Date()
    };

    const setting = await prisma.agentSocialMediaToolApproval.upsert({
      where: {
        unique_agent_social_tool_approval: {
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

  async getAgentApprovalSettings(agentId: string): Promise<SocialMediaToolApprovalSetting[]> {
    const settings = await prisma.agentSocialMediaToolApproval.findMany({
      where: { agentId },
      orderBy: { toolName: 'asc' }
    });

    return settings.map(setting => ({
      id: setting.id,
      agentId: setting.agentId,
      toolName: setting.toolName,
      needsApproval: setting.needsApproval,
      grantedBy: setting.grantedBy || undefined,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    }));
  }

  async getToolApprovalSettings(toolName: string): Promise<SocialMediaToolApprovalSetting[]> {
    const settings = await prisma.agentSocialMediaToolApproval.findMany({
      where: { toolName },
      orderBy: { agentId: 'asc' }
    });

    return settings.map(setting => ({
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
    await prisma.agentSocialMediaToolApproval.delete({
      where: {
        unique_agent_social_tool_approval: {
          agentId,
          toolName
        }
      }
    });
  }

  generateToolName(capability: SocialMediaCapability, provider: SocialMediaProvider): string {
    // Generate consistent tool names for social media capabilities
    // Format: {provider}_{capability_action}
    const action = capability.toLowerCase().replace(/_/g, '_');
    return `${provider}_${action}`;
  }
} 