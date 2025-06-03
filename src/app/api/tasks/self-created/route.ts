import { NextRequest, NextResponse } from 'next/server';
import { QdrantTaskRegistry } from '@/lib/scheduler/implementations/registry/QdrantTaskRegistry';
import { QdrantClient } from '@qdrant/js-client-rest';
import { TaskStatus, TaskScheduleType } from '@/lib/scheduler/models/Task.model';

// Initialize Qdrant client and registry
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
});

const taskRegistry = new QdrantTaskRegistry(qdrantClient);

// Types for the API response
interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

interface TaskMetadata {
  source: string;
  originalMessage?: string;
  intent?: string;
  complexity?: number;
  userId?: string;
  chatId?: string;
  executionTime?: number;
  retryCount?: number;
  errorInfo?: string;
}

interface SelfCreatedTaskResponse {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledTime: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  metadata?: TaskMetadata;
}

// Helper function to map Task status to our frontend status
function mapTaskStatus(status: TaskStatus): 'pending' | 'in_progress' | 'completed' | 'failed' {
  switch (status) {
    case TaskStatus.PENDING:
      return 'pending';
    case TaskStatus.RUNNING:
      return 'in_progress';
    case TaskStatus.COMPLETED:
      return 'completed';
    case TaskStatus.FAILED:
      return 'failed';
    default:
      return 'pending';
  }
}

// Helper function to determine priority from task metadata
function determinePriority(metadata?: TaskMetadata): 'low' | 'medium' | 'high' | 'urgent' {
  if (!metadata) return 'medium';
  
  // Check for explicit priority indicators in the original message
  const message = metadata.originalMessage?.toLowerCase() || '';
  
  if (message.includes('urgent') || message.includes('asap') || message.includes('immediately')) {
    return 'urgent';
  }
  if (message.includes('important') || message.includes('critical') || message.includes('crucial')) {
    return 'high';
  }
  if (message.includes('when you can') || message.includes('no rush') || message.includes('low priority')) {
    return 'low';
  }
  
  // Use complexity as a fallback
  if (metadata.complexity) {
    if (metadata.complexity >= 8) return 'high';
    if (metadata.complexity >= 6) return 'medium';
    return 'low';
  }
  
  return 'medium';
}

// Helper function to extract task result from metadata and status
function extractTaskResult(task: any): TaskResult | undefined {
  if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
    return undefined;
  }
  
  const metadata = task.metadata || {};
  const isSuccess = task.status === TaskStatus.COMPLETED;
  
  const result: TaskResult = {
    success: isSuccess,
    duration: metadata.executionTime || undefined
  };
  
  if (isSuccess) {
    // Try to extract result data from metadata
    if (metadata.result) {
      result.data = metadata.result;
    } else if (metadata.output) {
      result.data = metadata.output;
    } else {
      // Default success message
      result.data = {
        message: 'Task completed successfully',
        taskName: task.name
      };
    }
  } else {
    // Failed task
    result.error = metadata.errorInfo || metadata.error || 'Task execution failed';
  }
  
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chatId = searchParams.get('chatId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    console.log('Fetching self-created tasks', { userId, chatId, status, limit, offset });
    
    // Initialize registry if needed
    await taskRegistry.initialize();
    
    // Build filter criteria
    const filter: any = {
      limit,
      offset
    };
    
    // Filter by status if specified
    if (status && status !== 'all') {
      switch (status) {
        case 'pending':
          filter.status = TaskStatus.PENDING;
          break;
        case 'in_progress':
          filter.status = TaskStatus.RUNNING;
          break;
        case 'completed':
          filter.status = TaskStatus.COMPLETED;
          break;
        case 'failed':
          filter.status = TaskStatus.FAILED;
          break;
      }
    }
    
    // Fetch tasks from Qdrant
    const tasks = await taskRegistry.findTasks(filter);
    
    console.log(`Found ${tasks.length} tasks in database`);
    
    // Filter tasks by user/chat context if specified
    let filteredTasks = tasks;
    
    if (userId || chatId) {
      filteredTasks = tasks.filter(task => {
        const metadata = task.metadata as TaskMetadata | undefined;
        if (!metadata) return false;
        
        // Check if task belongs to the user or chat
        if (userId && metadata.userId === userId) return true;
        if (chatId && metadata.chatId === chatId) return true;
        
        return false;
      });
      
      console.log(`Filtered to ${filteredTasks.length} tasks for user/chat context`);
    }
    
    // Convert tasks to frontend format
    const formattedTasks: SelfCreatedTaskResponse[] = filteredTasks.map(task => {
      const metadata = task.metadata as TaskMetadata | undefined;
      
      return {
        id: task.id,
        name: task.name || 'Unnamed Task',
        description: task.description || 'No description provided',
        status: mapTaskStatus(task.status),
        priority: determinePriority(metadata),
        scheduledTime: task.scheduledTime?.toISOString() || task.createdAt?.toISOString() || new Date().toISOString(),
        createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
        startedAt: task.lastExecutedAt?.toISOString(),
        completedAt: task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED 
          ? (task.lastExecutedAt?.toISOString() || task.updatedAt?.toISOString()) 
          : undefined,
        result: extractTaskResult(task),
        metadata: {
          source: metadata?.source || 'unknown',
          originalMessage: metadata?.originalMessage,
          intent: metadata?.intent,
          complexity: metadata?.complexity,
          userId: metadata?.userId,
          chatId: metadata?.chatId
        }
      };
    });
    
    // Sort by created date (newest first)
    formattedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`Returning ${formattedTasks.length} formatted tasks`);
    
    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
      total: formattedTasks.length,
      filters: {
        userId,
        chatId,
        status,
        limit,
        offset
      }
    });
    
  } catch (error) {
    console.error('Error fetching self-created tasks:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      tasks: [],
      total: 0
    }, { status: 500 });
  }
}

// POST endpoint to create a new self-created task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, scheduledTime, metadata } = body;
    
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Task name is required'
      }, { status: 400 });
    }
    
    console.log('Creating new self-created task', { name, description });
    
    // Initialize registry if needed
    await taskRegistry.initialize();
    
    // Create the task
    const now = new Date();
    const task = await taskRegistry.storeTask({
      id: '', // Will be generated
      name,
      description: description || '',
      status: TaskStatus.PENDING,
      scheduleType: TaskScheduleType.EXPLICIT,
      priority: 5, // Default priority
      scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date(),
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'api_created',
        ...metadata
      },
      handler: async () => {
        // Default handler - this would be replaced by actual task logic
        console.log(`Executing task: ${name}`);
        return { success: true, message: `Task ${name} completed` };
      }
    });
    
    console.log('Task created successfully', { taskId: task.id });
    
    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        name: task.name,
        description: task.description,
        status: mapTaskStatus(task.status),
        scheduledTime: task.scheduledTime?.toISOString(),
        createdAt: task.createdAt?.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating self-created task:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 