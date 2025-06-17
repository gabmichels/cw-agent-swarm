import { Logger, RPAExecution } from '../types/RPATypes';

export class WorkflowHealthMonitor {
  constructor(private readonly logger: Logger) {}

  startMonitoring(execution: RPAExecution): void {
    this.logger.debug('Started monitoring workflow execution', {
      executionId: execution.id,
      workflowId: execution.workflowId
    });
  }

  stopMonitoring(executionId: string): void {
    this.logger.debug('Stopped monitoring workflow execution', { executionId });
  }
} 