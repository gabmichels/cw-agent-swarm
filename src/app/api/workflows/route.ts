import { NextRequest, NextResponse } from 'next/server';

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes?: any[];
  connections?: any;
  tags?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkflowSearchParams {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

// FastAPI server configuration
const FASTAPI_BASE_URL = 'http://127.0.0.1:8080';
const CACHE_DURATION = 30 * 1000; // 30 seconds

// Cache for workflow data
let workflowCache: any = null;
let cacheTimestamp: number = 0;

async function fetchFromFastAPI(endpoint: string): Promise<any> {
  try {
    const response = await fetch(`${FASTAPI_BASE_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`FastAPI request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`FastAPI request error for ${endpoint}:`, error);
    throw error;
  }
}

async function loadWorkflowsFromFastAPI(params: WorkflowSearchParams): Promise<{ workflows: Workflow[], total: number, pagination: any }> {
  const now = Date.now();

  // Build query parameters
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('q', params.search);
  if (params.category && params.category !== 'all') searchParams.set('trigger', params.category);
  if (params.limit) searchParams.set('per_page', params.limit.toString());
  if (params.offset) {
    const page = Math.floor(params.offset / (params.limit || 20)) + 1;
    searchParams.set('page', page.toString());
  }

  const endpoint = `/api/workflows?${searchParams.toString()}`;

  try {
    const data = await fetchFromFastAPI(endpoint);

    // Transform FastAPI response to our format
    const workflows: Workflow[] = data.workflows.map((w: any) => ({
      id: w.filename.replace('.json', ''),
      name: w.name,
      description: w.description || generateDescription(w),
      category: mapTriggerToCategory(w.trigger_type),
      nodes: [], // We don't load full node data in list view
      connections: {},
      tags: w.tags || [],
      active: w.active,
      createdAt: w.created_at,
      updatedAt: w.updated_at
    }));

    return {
      workflows,
      total: data.total,
      pagination: {
        page: data.page,
        per_page: data.per_page,
        pages: data.pages,
        total: data.total
      }
    };
  } catch (error) {
    console.error('Error fetching from FastAPI server:', error);
    // Fallback to empty results if FastAPI is not available
    return { workflows: [], total: 0, pagination: { page: 1, per_page: 20, pages: 0, total: 0 } };
  }
}

function mapTriggerToCategory(triggerType: string): string {
  const triggerToCategory: Record<string, string> = {
    'Manual': 'General',
    'Webhook': 'Automation',
    'Schedule': 'Automation',
    'Telegram': 'Communication',
    'Slack': 'Communication',
    'Email': 'Communication',
    'HTTP': 'Data Processing',
    'Database': 'Data Processing',
    'File': 'File Management',
    'Code': 'Development'
  };

  return triggerToCategory[triggerType] || 'General';
}

function generateDescription(workflow: any): string {
  const { name, node_count, trigger_type, complexity } = workflow;
  return `${trigger_type} workflow: ${name}. Contains ${node_count} nodes with ${complexity} complexity.`;
}

function searchWorkflows(workflows: Workflow[], params: WorkflowSearchParams): Workflow[] {
  let filtered = workflows;

  // Apply search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter(workflow =>
      workflow.name.toLowerCase().includes(searchLower) ||
      workflow.description.toLowerCase().includes(searchLower) ||
      workflow.category.toLowerCase().includes(searchLower) ||
      (workflow.tags && workflow.tags.some(tag => tag.toLowerCase().includes(searchLower)))
    );
  }

  // Apply category filter
  if (params.category && params.category !== 'all') {
    filtered = filtered.filter(workflow =>
      workflow.category.toLowerCase() === params.category.toLowerCase()
    );
  }

  return filtered;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: WorkflowSearchParams = {
      search: searchParams.get('search') || searchParams.get('q') || '',
      category: searchParams.get('category') || 'all',
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    console.log('Workflow API request:', params);

    // Load workflows from FastAPI
    const result = await loadWorkflowsFromFastAPI(params);

    // Additional client-side filtering if needed
    let workflows = result.workflows;
    if (params.search && !searchParams.get('q')) {
      // If search was passed as 'search' but not 'q', do additional filtering
      workflows = searchWorkflows(workflows, { search: params.search });
    }

    // Apply pagination if needed
    const startIndex = params.offset || 0;
    const endIndex = startIndex + (params.limit || 20);
    const paginatedWorkflows = workflows.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        workflows: paginatedWorkflows,
        pagination: result.pagination,
        metadata: {
          categories: ['Communication', 'Automation', 'Data Processing', 'File Management', 'General', 'Development'],
          totalWorkflows: result.total,
          lastUpdated: new Date().toISOString(),
          source: 'fastapi'
        }
      }
    });

  } catch (error) {
    console.error('Workflow API error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        workflows: [],
        pagination: { page: 1, per_page: 20, pages: 0, total: 0 },
        metadata: {
          categories: [],
          totalWorkflows: 0,
          lastUpdated: new Date().toISOString(),
          source: 'error'
        }
      }
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
} 
