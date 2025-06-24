import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

// Cache for workflow data
let workflowCache: Workflow[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds for testing

// Clear cache to ensure changes take effect immediately
workflowCache = null;
cacheTimestamp = 0;

async function loadWorkflows(): Promise<Workflow[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (workflowCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('Returning cached workflows:', workflowCache.length);
    return workflowCache;
  }

  console.log('Loading workflows from filesystem...');
  const workflowsDir = path.join(process.cwd(), 'data', 'n8n-workflows-repo', 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    console.warn('N8N workflows directory not found:', workflowsDir);
    return [];
  }

  const workflows: Workflow[] = [];

  try {
    // Check if workflows are in subdirectories or flat structure
    const dirContents = fs.readdirSync(workflowsDir, { withFileTypes: true });
    const hasSubdirectories = dirContents.some(item => item.isDirectory());

    if (hasSubdirectories) {
      // Handle subdirectory structure
      const categories = dirContents
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const category of categories) {
        const categoryPath = path.join(workflowsDir, category);

        try {
          const files = fs.readdirSync(categoryPath)
            .filter(file => file.endsWith('.json'));

          for (const file of files) {
            const workflowData = await parseWorkflowFile(
              path.join(categoryPath, file),
              category.replace(/_/g, ' '),
              file
            );
            if (workflowData) workflows.push(workflowData);
          }
        } catch (categoryError) {
          console.warn(`Error reading category ${category}:`, categoryError);
        }
      }
    } else {
      // Handle flat file structure - infer categories from filenames
      const files = dirContents
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .map(item => item.name);

      for (const file of files) {
        const category = inferCategoryFromFilename(file);
        const workflowData = await parseWorkflowFile(
          path.join(workflowsDir, file),
          category,
          file
        );
        if (workflowData) workflows.push(workflowData);
      }
    }

    // Cache the results
    workflowCache = workflows;
    cacheTimestamp = now;

    console.log(`Loaded ${workflows.length} workflows`);
    return workflows;
  } catch (error) {
    console.error('Error loading workflows:', error);
    return [];
  }
}

async function parseWorkflowFile(filePath: string, category: string, filename: string): Promise<Workflow | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const workflowData = JSON.parse(content);

    // Generate unique ID based on filename to prevent duplicates
    const uniqueId = `wf_${filename.replace('.json', '')}`;

    // Extract workflow information
    const workflow: Workflow = {
      id: uniqueId, // Always use unique filename-based ID
      name: workflowData.name || formatWorkflowName(filename),
      description: workflowData.description || generateDescription(filename, workflowData),
      category: category,
      nodes: workflowData.nodes || [],
      connections: workflowData.connections || {},
      tags: workflowData.tags || extractTagsFromFilename(filename),
      active: workflowData.active !== false,
      createdAt: workflowData.createdAt || new Date().toISOString(),
      updatedAt: workflowData.updatedAt || new Date().toISOString()
    };

    return workflow;
  } catch (parseError) {
    console.warn(`Error parsing workflow file ${filename}:`, parseError);
    return null;
  }
}

function inferCategoryFromFilename(filename: string): string {
  const name = filename.toLowerCase();

  // Define category patterns
  const categoryPatterns: Record<string, string[]> = {
    'Communication': ['telegram', 'slack', 'discord', 'email', 'whatsapp', 'gmail', 'mailjet'],
    'Data Processing': ['code', 'splitout', 'filter', 'aggregate', 'extractfromfile', 'converttofile'],
    'Automation': ['schedule', 'webhook', 'triggered', 'automation', 'automate', 'wait'],
    'Productivity': ['googledocs', 'googlesheets', 'googletasks', 'stickynote', 'jira', 'airtable', 'mondaycom'],
    'Development': ['github', 'http', 'postgres', 'graphql', 'executecommand', 'n8n'],
    'Social Media': ['linkedin', 'form'],
    'File Management': ['readbinaryfile', 'import'],
    'Monitoring': ['hunter', 'monitor', 'error', 'executiondata']
  };

  // Find matching category
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => name.includes(pattern))) {
      return category;
    }
  }

  return 'General';
}

function formatWorkflowName(filename: string): string {
  // Remove file extension and number prefix
  let name = filename.replace('.json', '').replace(/^\d+_/, '');

  // Split by underscores and capitalize
  return name.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractTagsFromFilename(filename: string): string[] {
  const name = filename.toLowerCase();
  const tags: string[] = [];

  // Extract common tags
  const tagPatterns = [
    'webhook', 'triggered', 'scheduled', 'automation', 'automate',
    'telegram', 'slack', 'email', 'http', 'code', 'manual'
  ];

  tagPatterns.forEach(pattern => {
    if (name.includes(pattern)) {
      tags.push(pattern);
    }
  });

  return tags;
}

function generateDescription(filename: string, workflowData: any): string {
  const category = inferCategoryFromFilename(filename);
  const nodeCount = workflowData.nodes ? workflowData.nodes.length : 0;
  const name = formatWorkflowName(filename);

  return `${category} workflow: ${name}. Contains ${nodeCount} nodes for automated processing.`;
}

function searchWorkflows(workflows: Workflow[], params: WorkflowSearchParams): Workflow[] {
  let filtered = [...workflows];

  // Apply search filter
  if (params.search) {
    const searchTerm = params.search.toLowerCase();
    filtered = filtered.filter(workflow =>
      workflow.name.toLowerCase().includes(searchTerm) ||
      workflow.description.toLowerCase().includes(searchTerm) ||
      workflow.category.toLowerCase().includes(searchTerm) ||
      (workflow.tags && Array.isArray(workflow.tags) && workflow.tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().includes(searchTerm)
      ))
    );
  }

  // Apply category filter
  if (params.category) {
    filtered = filtered.filter(workflow =>
      workflow.category.toLowerCase().includes(params.category!.toLowerCase())
    );
  }

  // Apply pagination
  const offset = params.offset || 0;
  const limit = params.limit || 50;

  return filtered.slice(offset, offset + limit);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Cache busting
    if (searchParams.get('bust') === 'true') {
      console.log('Cache busted - clearing workflow cache');
      workflowCache = null;
      cacheTimestamp = 0;
    }

    const searchQuery: WorkflowSearchParams = {
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Load all workflows
    const allWorkflows = await loadWorkflows();

    // Apply search and filters
    const filteredWorkflows = searchWorkflows(allWorkflows, searchQuery);

    // Get categories for metadata
    const categories = [...new Set(allWorkflows.map(w => w.category))].sort();

    return NextResponse.json({
      success: true,
      data: {
        workflows: filteredWorkflows,
        pagination: {
          total: allWorkflows.length,
          filtered: filteredWorkflows.length,
          offset: searchQuery.offset || 0,
          limit: searchQuery.limit || 50
        },
        metadata: {
          categories,
          totalWorkflows: allWorkflows.length,
          lastUpdated: new Date(cacheTimestamp).toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error in workflows API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load workflows',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get workflow categories
export async function OPTIONS() {
  try {
    const allWorkflows = await loadWorkflows();
    const categories = [...new Set(allWorkflows.map(w => w.category))].sort();

    return NextResponse.json({
      success: true,
      data: {
        categories,
        totalWorkflows: allWorkflows.length,
        supportedParams: ['search', 'category', 'limit', 'offset']
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load categories' },
      { status: 500 }
    );
  }
} 
