import { NextRequest, NextResponse } from 'next/server';
import { WorkflowImportService } from '../../../../services/workflow/WorkflowImportService';
import { logger } from '../../../../lib/logging';

interface ImportToAccountRequest {
  connectionId: string;
  workflowId: string; // From the library
  customName?: string;
  customDescription?: string;
  parameters?: Record<string, any>;
  activate?: boolean;
}

/**
 * POST /api/workflows/import-to-account
 * Import a workflow from the library to user's N8N account
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ImportToAccountRequest = await request.json();

    // Validate required fields
    if (!body.connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    if (!body.workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    logger.info('Starting workflow import to user account', {
      connectionId: body.connectionId,
      workflowId: body.workflowId,
      customName: body.customName
    });

    // Initialize the import service
    const importService = new WorkflowImportService();

    // First, validate the workflow can be imported
    const validation = await importService.validateWorkflowForImport(
      body.connectionId,
      body.workflowId
    );

    if (!validation.canImport) {
      logger.warn('Workflow import validation failed', {
        connectionId: body.connectionId,
        workflowId: body.workflowId,
        issues: validation.issues
      });

      return NextResponse.json({
        success: false,
        error: 'Workflow cannot be imported',
        issues: validation.issues,
        suggestions: validation.suggestions
      }, { status: 400 });
    }

    // Import the workflow
    const result = await importService.importWorkflow({
      connectionId: body.connectionId,
      workflowId: body.workflowId,
      customName: body.customName,
      customDescription: body.customDescription,
      parameters: body.parameters,
      activate: body.activate || false
    });

    if (result.success) {
      logger.info('Workflow import completed successfully', {
        connectionId: body.connectionId,
        workflowId: body.workflowId,
        importedWorkflowId: result.importedWorkflowId,
        conflictResolution: result.conflictResolution
      });

      return NextResponse.json({
        success: true,
        importedWorkflowId: result.importedWorkflowId,
        conflictResolution: result.conflictResolution,
        message: 'Workflow imported successfully to your N8N account'
      });
    } else {
      logger.error('Workflow import failed', {
        connectionId: body.connectionId,
        workflowId: body.workflowId,
        error: result.error
      });

      return NextResponse.json({
        success: false,
        error: result.error || 'Import failed'
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('Workflow import API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
} 