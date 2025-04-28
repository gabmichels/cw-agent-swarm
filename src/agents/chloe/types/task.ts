export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  dependencies?: string[];
  result?: any;
  error?: string;
  created_at: Date;
  updated_at: Date;
} 