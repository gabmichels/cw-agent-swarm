import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '../../../../../services/organization/OrganizationService';
import { PlatformConfigService } from '../../../../../services/PlatformConfigService';
import { AgentDepartmentAssignment } from '../../../../../types/organization';

/**
 * PUT /api/agents/[agentId]/department
 * Assign agent to a department
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId  } = await params;
    const { departmentId } = await request.json();

    if (!agentId || !departmentId) {
      return NextResponse.json(
        { error: 'Agent ID and department ID are required' },
        { status: 400 }
      );
    }

    // Get platform configuration
    const platformConfig = PlatformConfigService.getInstance();
    
    // Only allow in organizational mode
    if (!platformConfig.isOrganizationalMode()) {
      return NextResponse.json(
        { error: 'Department assignment only available in organizational mode' },
        { status: 403 }
      );
    }

    // Initialize organization service
    const organizationService = new OrganizationService({} as any, {} as any);

    // Assign agent to department
    const assignment: AgentDepartmentAssignment = {
      agentId,
      departmentId
    };
    const result = await organizationService.assignAgentToDepartment(assignment);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to assign agent to department' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        departmentId,
        assignment: result.data
      }
    });

  } catch (error) {
    console.error('Error assigning agent to department:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[agentId]/department
 * Remove agent from department
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId  } = await params;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Get platform configuration
    const platformConfig = PlatformConfigService.getInstance();
    
    // Only allow in organizational mode
    if (!platformConfig.isOrganizationalMode()) {
      return NextResponse.json(
        { error: 'Department operations only available in organizational mode' },
        { status: 403 }
      );
    }

    // Initialize organization service
    const organizationService = new OrganizationService({} as any, {} as any);

    // Remove agent from department
    const result = await organizationService.removeAgentFromDepartment(agentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to remove agent from department' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        removed: true
      }
    });

  } catch (error) {
    console.error('Error removing agent from department:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 