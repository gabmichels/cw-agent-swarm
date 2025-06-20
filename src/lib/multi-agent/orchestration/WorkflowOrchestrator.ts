/**
 * Workflow Orchestrator
 * 
 * Complex multi-agent task coordination and workflow management.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../../types/entity-identifier';
import {
  ToolDelegationRequest,
  ToolDelegationResponse,
  ToolDelegationStatus,
  ToolCapabilityCategory,
  createToolDelegationRequest,
  ToolDelegationError
} from '../delegation/ToolDelegationProtocol';
import { IAgentCapabilityDiscovery, AgentDiscoveryCriteria } from '../discovery/AgentCapabilityDiscovery';
import { CrossAgentTaskHandlerRegistry } from '../handlers/CrossAgentTaskHandlers';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  readonly id: StructuredId;
  readonly name: string;
  readonly toolName: string;
  readonly toolCategory: ToolCapabilityCategory;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly dependencies: readonly StructuredId[]; // Steps that must complete first
  readonly assignedAgentId?: string;
  readonly requiresApproval: boolean;
  readonly timeoutMs: number;
  readonly retryCount: number;
  readonly priority: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  readonly id: StructuredId;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly WorkflowStep[];
  readonly coordinatorAgentId: string;
  readonly timeoutMs: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  readonly workflowId: StructuredId;
  readonly definition: WorkflowDefinition;
  readonly status: WorkflowExecutionStatus;
  readonly currentStep?: StructuredId;
  readonly completedSteps: readonly StructuredId[];
  readonly failedSteps: readonly StructuredId[];
  readonly stepResults: Readonly<Record<string, any>>;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: Readonly<{
    code: string;
    message: string;
    step?: StructuredId;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Internal mutable workflow execution context
 */
interface MutableWorkflowExecutionContext {
  readonly workflowId: StructuredId;
  readonly definition: WorkflowDefinition;
  status: WorkflowExecutionStatus;
  currentStep?: StructuredId;
  completedSteps: StructuredId[];
  failedSteps: StructuredId[];
  stepResults: Record<string, any>;
  readonly startedAt: Date;
  completedAt?: Date;
  error?: {
    code: string;
    message: string;
    step?: StructuredId;
    details?: Record<string, unknown>;
  };
}

/**
 * Workflow execution status
 */
export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  readonly stepId: StructuredId;
  readonly success: boolean;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: Readonly<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  readonly executedBy: string;
  readonly executionTime: number;
  readonly executedAt: Date;
}

/**
 * Workflow orchestrator interface
 */
export interface IWorkflowOrchestrator {
  /**
   * Create a new workflow
   */
  createWorkflow(
    name: string,
    description: string,
    steps: readonly Omit<WorkflowStep, 'id'>[],
    coordinatorAgentId: string,
    options?: {
      readonly timeoutMs?: number;
      readonly metadata?: Record<string, unknown>;
    }
  ): WorkflowDefinition;

  /**
   * Execute a workflow
   */
  executeWorkflow(
    workflowDefinition: WorkflowDefinition
  ): Promise<WorkflowExecutionContext>;

  /**
   * Get workflow execution status
   */
  getWorkflowStatus(workflowId: StructuredId): Promise<WorkflowExecutionContext>;

  /**
   * Cancel a running workflow
   */
  cancelWorkflow(workflowId: StructuredId, reason: string): Promise<boolean>;

  /**
   * Pause a running workflow
   */
  pauseWorkflow(workflowId: StructuredId): Promise<boolean>;

  /**
   * Resume a paused workflow
   */
  resumeWorkflow(workflowId: StructuredId): Promise<boolean>;

  /**
   * Get all workflow executions
   */
  getWorkflowExecutions(): Promise<readonly WorkflowExecutionContext[]>;
}

/**
 * Workflow orchestrator implementation
 */
export class WorkflowOrchestrator implements IWorkflowOrchestrator {
  private readonly executions: Map<string, WorkflowExecutionContext> = new Map();
  private readonly stepExecutionTimeout = 60000; // 1 minute default

  constructor(
    private readonly capabilityDiscovery: IAgentCapabilityDiscovery,
    private readonly taskHandlerRegistry: CrossAgentTaskHandlerRegistry,
    private readonly dependencies: {
      sendMessage: (
        toAgentId: string,
        request: ToolDelegationRequest
      ) => Promise<ToolDelegationResponse>;
    }
  ) {}

  /**
   * Create a new workflow
   */
  createWorkflow(
    name: string,
    description: string,
    steps: readonly Omit<WorkflowStep, 'id'>[],
    coordinatorAgentId: string,
    options: {
      readonly timeoutMs?: number;
      readonly metadata?: Record<string, unknown>;
    } = {}
  ): WorkflowDefinition {
    if (!name || !description || !coordinatorAgentId) {
      throw new ToolDelegationError(
        'Workflow name, description, and coordinator agent ID are required',
        'INVALID_WORKFLOW_DEFINITION'
      );
    }

    if (!steps || steps.length === 0) {
      throw new ToolDelegationError(
        'Workflow must have at least one step',
        'INVALID_WORKFLOW_DEFINITION'
      );
    }

    const timestamp = new Date();
    const workflowId = {
      id: ulid(timestamp.getTime()),
      prefix: 'workflow',
      timestamp,
      toString: () => `workflow_${ulid(timestamp.getTime())}`
    } as StructuredId;

    const workflowSteps: WorkflowStep[] = steps.map((step, index) => {
      const stepId = {
        id: ulid(timestamp.getTime() + index),
        prefix: 'workflow_step',
        timestamp,
        toString: () => `workflow_step_${ulid(timestamp.getTime() + index)}`
      } as StructuredId;

      return {
        id: stepId,
        name: step.name,
        toolName: step.toolName,
        toolCategory: step.toolCategory,
        parameters: Object.freeze({ ...step.parameters }),
        dependencies: Object.freeze([...step.dependencies]),
        assignedAgentId: step.assignedAgentId,
        requiresApproval: step.requiresApproval,
        timeoutMs: step.timeoutMs || this.stepExecutionTimeout,
        retryCount: step.retryCount || 0,
        priority: step.priority || 'normal'
      };
    });

    return {
      id: workflowId,
      name,
      description,
      steps: Object.freeze(workflowSteps),
      coordinatorAgentId,
      timeoutMs: options.timeoutMs || 300000, // 5 minutes default
      metadata: Object.freeze({ ...options.metadata }),
      createdAt: timestamp
    };
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowDefinition: WorkflowDefinition
  ): Promise<WorkflowExecutionContext> {
    const executionContext: MutableWorkflowExecutionContext = {
      workflowId: workflowDefinition.id,
      definition: workflowDefinition,
      status: WorkflowExecutionStatus.RUNNING,
      completedSteps: [],
      failedSteps: [],
      stepResults: {},
      startedAt: new Date()
    };

    this.executions.set(workflowDefinition.id.toString(), this.toReadonlyContext(executionContext));

    try {
      await this.executeWorkflowSteps(executionContext);
      
      const finalContext: WorkflowExecutionContext = this.toReadonlyContext({
        ...executionContext,
        status: WorkflowExecutionStatus.COMPLETED,
        completedAt: new Date()
      });

      this.executions.set(workflowDefinition.id.toString(), finalContext);
      return finalContext;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'WORKFLOW_EXECUTION_ERROR';

      const failedContext: WorkflowExecutionContext = this.toReadonlyContext({
        ...executionContext,
        status: WorkflowExecutionStatus.FAILED,
        completedAt: new Date(),
        error: {
          code: errorCode,
          message: errorMessage,
          details: error instanceof ToolDelegationError ? error.context : undefined
        }
      });

      this.executions.set(workflowDefinition.id.toString(), failedContext);
      return failedContext;
    }
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(workflowId: StructuredId): Promise<WorkflowExecutionContext> {
    const execution = this.executions.get(workflowId.toString());
    if (!execution) {
      throw new ToolDelegationError(
        `Workflow execution not found: ${workflowId.toString()}`,
        'WORKFLOW_NOT_FOUND',
        { workflowId: workflowId.toString() }
      );
    }

    return execution;
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: StructuredId, reason: string): Promise<boolean> {
    const execution = this.executions.get(workflowId.toString());
    if (!execution) {
      return false;
    }

    if (execution.status !== WorkflowExecutionStatus.RUNNING &&
        execution.status !== WorkflowExecutionStatus.PAUSED) {
      return false;
    }

    const cancelledContext: WorkflowExecutionContext = {
      ...execution,
      status: WorkflowExecutionStatus.CANCELLED,
      completedAt: new Date(),
      error: Object.freeze({
        code: 'WORKFLOW_CANCELLED',
        message: `Workflow cancelled: ${reason}`
      })
    };

    this.executions.set(workflowId.toString(), cancelledContext);
    return true;
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(workflowId: StructuredId): Promise<boolean> {
    const execution = this.executions.get(workflowId.toString());
    if (!execution || execution.status !== WorkflowExecutionStatus.RUNNING) {
      return false;
    }

    const pausedContext: WorkflowExecutionContext = {
      ...execution,
      status: WorkflowExecutionStatus.PAUSED
    };

    this.executions.set(workflowId.toString(), pausedContext);
    return true;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: StructuredId): Promise<boolean> {
    const execution = this.executions.get(workflowId.toString());
    if (!execution || execution.status !== WorkflowExecutionStatus.PAUSED) {
      return false;
    }

    const mutableContext: MutableWorkflowExecutionContext = {
      ...execution,
      status: WorkflowExecutionStatus.RUNNING,
      completedSteps: [...execution.completedSteps],
      failedSteps: [...execution.failedSteps],
      stepResults: { ...execution.stepResults },
      error: execution.error ? { ...execution.error } : undefined
    };

    this.executions.set(workflowId.toString(), this.toReadonlyContext(mutableContext));
    
    // Continue execution
    try {
      await this.executeWorkflowSteps(mutableContext);
    } catch (error) {
      // Handle error appropriately
    }

    return true;
  }

  /**
   * Get all workflow executions
   */
  async getWorkflowExecutions(): Promise<readonly WorkflowExecutionContext[]> {
    return Object.freeze(Array.from(this.executions.values()));
  }

  /**
   * Private: Convert mutable context to readonly
   */
  private toReadonlyContext(context: MutableWorkflowExecutionContext): WorkflowExecutionContext {
    return {
      ...context,
      completedSteps: Object.freeze([...context.completedSteps]),
      failedSteps: Object.freeze([...context.failedSteps]),
      stepResults: Object.freeze({ ...context.stepResults }),
      error: context.error ? Object.freeze({ ...context.error }) : undefined
    };
  }

  /**
   * Private: Execute workflow steps
   */
  private async executeWorkflowSteps(context: MutableWorkflowExecutionContext): Promise<void> {
    const { definition } = context;
    const pendingSteps = definition.steps.filter(
      step => !context.completedSteps.includes(step.id) && 
              !context.failedSteps.includes(step.id)
    );

    while (pendingSteps.length > 0) {
      // Check if workflow was cancelled or paused
      const currentContext = this.executions.get(context.workflowId.toString());
      if (currentContext?.status === WorkflowExecutionStatus.CANCELLED ||
          currentContext?.status === WorkflowExecutionStatus.PAUSED) {
        return;
      }

      // Find steps that can be executed (dependencies satisfied)
      const readySteps = pendingSteps.filter(step => 
        step.dependencies.every(dep => context.completedSteps.includes(dep))
      );

      if (readySteps.length === 0) {
        throw new ToolDelegationError(
          'No steps ready for execution - possible circular dependency',
          'WORKFLOW_DEADLOCK',
          { pendingSteps: pendingSteps.map(s => s.id.toString()) }
        );
      }

      // Execute ready steps in parallel
      const stepPromises = readySteps.map(step => this.executeStep(step, context));
      const stepResults = await Promise.allSettled(stepPromises);

      // Process results
      for (let i = 0; i < stepResults.length; i++) {
        const stepResult = stepResults[i];
        const step = readySteps[i];

        if (stepResult.status === 'fulfilled') {
          const result = stepResult.value;
          context.completedSteps = [...context.completedSteps, step.id];
          context.stepResults = {
            ...context.stepResults,
            [step.id.toString()]: result.result
          };
        } else {
          context.failedSteps = [...context.failedSteps, step.id];
          throw new ToolDelegationError(
            `Step failed: ${step.name}`,
            'STEP_EXECUTION_FAILED',
            { stepId: step.id.toString(), error: stepResult.reason }
          );
        }

        // Remove from pending
        const stepIndex = pendingSteps.findIndex(s => s.id === step.id);
        if (stepIndex !== -1) {
          pendingSteps.splice(stepIndex, 1);
        }
      }

      // Update execution context
      this.executions.set(context.workflowId.toString(), this.toReadonlyContext(context));
    }
  }

  /**
   * Private: Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // Find capable agent if not assigned
      let assignedAgentId = step.assignedAgentId;
      
      if (!assignedAgentId) {
        const criteria: AgentDiscoveryCriteria = {
          toolName: step.toolName,
          toolCategory: step.toolCategory
        };

        const discoveredAgents = await this.capabilityDiscovery.discoverAgents(criteria);
        if (discoveredAgents.length === 0) {
          throw new ToolDelegationError(
            `No capable agent found for tool: ${step.toolName}`,
            'NO_CAPABLE_AGENT',
            { toolName: step.toolName, category: step.toolCategory }
          );
        }

        assignedAgentId = discoveredAgents[0].agentCapabilities.agentId;
      }

      // Create delegation request
      const delegationRequest = createToolDelegationRequest(
        context.definition.coordinatorAgentId,
        step.toolName,
        step.toolCategory,
        step.parameters,
        {
          targetAgentId: assignedAgentId,
          priority: step.priority as any,
          requiresConfirmation: step.requiresApproval,
          context: {
            reason: `Workflow step: ${step.name}`,
            expectedOutcome: `Complete step ${step.name} in workflow ${context.definition.name}`,
            fallbackStrategy: 'retry'
          },
          correlationId: context.workflowId.toString(),
          metadata: {
            workflowId: context.workflowId.toString(),
            stepId: step.id.toString(),
            stepName: step.name
          }
        }
      );

      // Execute via task handler or send to agent
      let response: ToolDelegationResponse;
      
      const handler = this.taskHandlerRegistry.getHandler(delegationRequest);
      if (handler) {
        response = await this.taskHandlerRegistry.processRequest(delegationRequest);
      } else {
        response = await this.dependencies.sendMessage(assignedAgentId, delegationRequest);
      }

      const executionTime = Date.now() - startTime;

      if (response.status === ToolDelegationStatus.COMPLETED) {
        return {
          stepId: step.id,
          success: true,
          result: response.result,
          executedBy: assignedAgentId,
          executionTime,
          executedAt: new Date()
        };
      } else {
        return {
          stepId: step.id,
          success: false,
          error: response.error,
          executedBy: assignedAgentId,
          executionTime,
          executedAt: new Date()
        };
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'STEP_EXECUTION_ERROR';

      return {
        stepId: step.id,
        success: false,
        error: Object.freeze({
          code: errorCode,
          message: errorMessage,
          details: error instanceof ToolDelegationError ? error.context : undefined
        }),
        executedBy: step.assignedAgentId || 'unknown',
        executionTime,
        executedAt: new Date()
      };
    }
  }
}

/**
 * Pure function to create workflow step
 */
export const createWorkflowStep = (
  name: string,
  toolName: string,
  toolCategory: ToolCapabilityCategory,
  parameters: Record<string, unknown>,
  options: {
    readonly dependencies?: readonly StructuredId[];
    readonly assignedAgentId?: string;
    readonly requiresApproval?: boolean;
    readonly timeoutMs?: number;
    readonly retryCount?: number;
    readonly priority?: 'low' | 'normal' | 'high' | 'urgent';
  } = {}
): Omit<WorkflowStep, 'id'> => {
  return {
    name,
    toolName,
    toolCategory,
    parameters: Object.freeze({ ...parameters }),
    dependencies: Object.freeze([...(options.dependencies || [])]),
    assignedAgentId: options.assignedAgentId,
    requiresApproval: options.requiresApproval || false,
    timeoutMs: options.timeoutMs || 60000,
    retryCount: options.retryCount || 0,
    priority: options.priority || 'normal'
  };
}; 