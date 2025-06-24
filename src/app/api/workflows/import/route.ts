import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { WorkflowImportOptions, N8nWorkflowTemplate, WorkflowIdGenerator } from '../../../../types/workflow';
import { WorkflowSearchService } from '../../../../services/external-workflows/integrations/WorkflowSearchService';
import { N8nWorkflowApiClient } from '../../../../services/external-workflows/integrations/N8nWorkflowApiClient';

interface ImportWorkflowRequest {
  readonly workflowId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly source: 'n8n-library' | 'custom';
  readonly options?: WorkflowImportOptions;
}

interface ImportWorkflowResponse {
  readonly success: boolean;
  readonly workflowId: string;
  readonly name: string;
  readonly message: string;
  readonly importedAt: string;
  readonly externalWorkflowId?: string;
}

/**
 * POST /api/workflows/import
 * Import a workflow from the n8n library into the user's workspace
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ImportWorkflowRequest = await request.json();

    // Validate required fields
    if (!body.workflowId || !body.name || !body.source) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, name, and source are required' },
        { status: 400 }
      );
    }

    // Generate new workflow ID for the imported workflow
    const importedWorkflowId = WorkflowIdGenerator.generate();
    
    // Initialize the search service to get workflow details
    const apiClient = new N8nWorkflowApiClient(8001);
    const searchService = new WorkflowSearchService(apiClient);

    let workflowDetails: N8nWorkflowTemplate | null = null;

    if (body.source === 'n8n-library') {
      try {
        // Search for the workflow by ID (using search instead of direct getById)
        const searchResults = await searchService.searchWorkflows({
          q: body.workflowId,
          limit: 1
        });
        
        workflowDetails = searchResults.workflows.find((w: any) => w.id.toString() === body.workflowId) || null;
        
        if (!workflowDetails) {
          return NextResponse.json(
            { error: `Workflow with ID ${body.workflowId} not found in library` },
            { status: 404 }
          );
        }
      } catch (error) {
        console.error('Failed to fetch workflow from library:', error);
        return NextResponse.json(
          { error: 'Failed to fetch workflow from library. Please ensure the n8n service is running.' },
          { status: 502 }
        );
      }
    }

    // Create the imported workflow record
    const importedWorkflow = {
      id: importedWorkflowId.toString(),
      externalId: body.workflowId,
      name: body.options?.customName || body.name,
      description: body.description,
      category: body.category,
      source: body.source,
      isActive: body.options?.enabledByDefault !== false,
      assignedAgent: body.options?.assignToAgent || null,
      customTags: body.options?.customTags || [],
      triggerSettings: body.options?.triggerSettings || {},
      importedAt: new Date().toISOString(),
      originalWorkflow: workflowDetails ? {
        filename: workflowDetails.filename,
        nodeCount: workflowDetails.nodeCount,
        complexity: workflowDetails.complexity,
        triggerType: workflowDetails.triggerType,
        integrations: workflowDetails.integrations,
        downloadUrl: workflowDetails.downloadUrl
      } : null
    };

    // TODO: In a real implementation, this would:
    // 1. Save the workflow to the database
    // 2. Download the actual workflow JSON
    // 3. Transform it for the target platform
    // 4. Set up required credentials/integrations
    // 5. Deploy to the workflow execution engine
    // 6. Run validation tests

    // For now, we'll simulate the import process
    console.log('Importing workflow:', {
      importedWorkflowId: importedWorkflow.id,
      originalId: body.workflowId,
      name: importedWorkflow.name,
      source: body.source,
      options: body.options
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response: ImportWorkflowResponse = {
      success: true,
      workflowId: importedWorkflow.id,
      name: importedWorkflow.name,
      message: `Workflow "${importedWorkflow.name}" imported successfully`,
      importedAt: importedWorkflow.importedAt,
      externalWorkflowId: body.workflowId
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Workflow import error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `Import failed: ${error.message}` 
          : 'Unknown error occurred during workflow import'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/import
 * Get import status or list imported workflows
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (workflowId) {
      // Get specific import status
      // TODO: Implement database lookup
      return NextResponse.json({
        workflowId,
        status: 'completed',
        importedAt: new Date().toISOString(),
        message: 'Workflow import completed successfully'
      });
    }

    // List all imported workflows
    // TODO: Implement database query with pagination
    return NextResponse.json({
      imports: [],
      total: 0,
      page: 1,
      pageSize: 20
    });

  } catch (error) {
    console.error('Failed to get import status:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve import information' },
      { status: 500 }
    );
  }
} 