/**
 * Ethics Module - Entry Point
 * 
 * This module provides an ethical governance layer for agent operations:
 * - Rule-based bias and ethics auditing
 * - Configurable policy registry
 * - Integration with planning and tool execution
 * - Violation logging and reporting
 * - Post-task reflection hooks
 * 
 * Usage:
 * 1. Import components: import { EthicsPolicy, BiasAuditor, enforceEthics } from './ethics';
 * 2. Use enforcement: const result = await enforceEthics({ agentId, taskId, output });
 * 3. After task completion: await agent.postTaskHook(taskId);
 */

export * from './EthicsPolicy';
export * from './BiasAuditor';
export * from './EthicsMiddleware'; 