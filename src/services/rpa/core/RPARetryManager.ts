import { Logger, RPAExecution, RetryConfig } from '../types/RPATypes';

export class RPARetryManager {
  constructor(
    private readonly retryConfig: RetryConfig,
    private readonly logger: Logger
  ) {}

  shouldRetry(execution: RPAExecution, error: Error): boolean {
    const retryAttempt = (execution.context.metadata.retryAttempt as number || 0);
    return retryAttempt < this.retryConfig.maxAttempts;
  }

  async retry<T>(execution: RPAExecution, retryFn: () => Promise<T>): Promise<T> {
    const retryAttempt = (execution.context.metadata.retryAttempt as number || 0);
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryAttempt),
      this.retryConfig.maxDelay
    );

    this.logger.info('Retrying execution after delay', {
      executionId: execution.id,
      attempt: retryAttempt + 1,
      delay
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    return await retryFn();
  }
} 