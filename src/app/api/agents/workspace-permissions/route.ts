import { NextRequest, NextResponse } from 'next/server';
import { AgentWorkspacePermissionService } from '../../../../services/workspace/AgentWorkspacePermissionService';
import { WorkspaceCapabilityType, AccessLevel } from '../../../../services/database/types';

const permissionService = new AgentWorkspacePermissionService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: agentId'
      }, { status: 400 });
    }

    // Get all workspace capabilities for the agent
    const capabilities = await permissionService.getAgentWorkspaceCapabilities(agentId);

    return NextResponse.json({
      success: true,
      capabilities
    });

  } catch (error) {
    console.error('Error fetching agent workspace permissions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, permissions, grantedBy } = body;

    if (!agentId || !permissions || !grantedBy) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, permissions, grantedBy'
      }, { status: 400 });
    }

    const grantedPermissions = [];

    // Process each workspace connection's permissions
    for (const connectionConfig of permissions) {
      const { connectionId, permissions: capabilityPermissions } = connectionConfig;

      // Grant each enabled capability
      for (const [capability, config] of Object.entries(capabilityPermissions)) {
        if (config && typeof config === 'object' && 'enabled' in config && config.enabled) {
          try {
            // Default to READ_WRITE access level if not specified
            const accessLevel = (config as any).accessLevel as AccessLevel || AccessLevel.WRITE;
            
            const permission = await permissionService.grantPermission({
              agentId,
              workspaceConnectionId: connectionId,
              capability: capability as WorkspaceCapabilityType,
              accessLevel,
              restrictions: (config as any).restrictions,
              grantedBy,
              justification: `Agent workspace permission granted during agent creation`
            });
            grantedPermissions.push(permission);
          } catch (error) {
            console.error(`Failed to grant permission ${capability} for connection ${connectionId}:`, error);
            // Log more details for debugging
            console.error('Config:', config);
            console.error('Capability:', capability);
            console.error('ConnectionId:', connectionId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      grantedPermissions,
      message: `Successfully granted ${grantedPermissions.length} workspace permissions`
    });

  } catch (error) {
    console.error('Error granting agent workspace permissions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to grant permissions'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { permissionId, revokedBy } = body;

    if (!permissionId || !revokedBy) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: permissionId, revokedBy'
      }, { status: 400 });
    }

    await permissionService.revokePermission(permissionId, revokedBy);

    return NextResponse.json({
      success: true,
      message: 'Permission revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking agent workspace permission:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke permission'
    }, { status: 500 });
  }
} 