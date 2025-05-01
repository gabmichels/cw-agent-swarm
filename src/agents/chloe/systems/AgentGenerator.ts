import { Task } from '../types/task';
import { MCPRuntime } from '@/agents/mcp/MCPRuntime';

export interface AgentSuggestion {
  id: string;
  name: string;
  reason: string;
  capabilities: string[];
  roles: string[];
  persona: string;
}

export class AgentGenerator {
  static suggestAgents(currentState: { failedTasks: Task[] }): AgentSuggestion[] {
    const suggestions: AgentSuggestion[] = [];

    const allAgents = MCPRuntime.getAllAgents();
    const existingCapabilities = new Set(allAgents.flatMap(a => a.capabilities));

    for (const task of currentState.failedTasks) {
      const taskCapabilities = (task as any).capabilities || [];
      const missingCaps = taskCapabilities.filter((cap: string) => !existingCapabilities.has(cap));
      if (missingCaps.length) {
        suggestions.push({
          id: `auto-${missingCaps[0].replace(/\W+/g, '-')}`,
          name: `${missingCaps[0].split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')} Agent`,
          reason: `No active agent supports: ${missingCaps.join(', ')}`,
          capabilities: missingCaps,
          roles: ['specialist'],
          persona: `Focused expert in ${missingCaps.join(', ')}`,
        });
      }
    }

    return suggestions;
  }
} 