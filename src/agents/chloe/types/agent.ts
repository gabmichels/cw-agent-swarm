export interface AgentConfig {
  id: string;
  name: string;
  departments: string[];
  description: string;
  version: string;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  chloe: {
    id: 'chloe',
    name: 'Chloe',
    departments: ['marketing'],
    description: 'Marketing and customer insights specialist',
    version: '1.0.0'
  },
  lance: {
    id: 'lance',
    name: 'Lance',
    departments: ['sales'],
    description: 'Sales and business development specialist',
    version: '1.0.0'
  }
  // Add more agents as needed
}; 