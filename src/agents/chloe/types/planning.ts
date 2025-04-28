export interface PlanStep {
  description: string;
  tool?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: {
    adaptationCount?: number;
    lastError?: string;
    [key: string]: any;
  };
}

export interface PlanWithSteps {
  description: string;
  steps: PlanStep[];
  metadata?: {
    [key: string]: any;
  };
}

export interface StepResult {
  step: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  stepResults?: StepResult[];
} 