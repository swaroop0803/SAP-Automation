// Types for the SAP Test Automation application

export interface TestCommand {
  id: string;
  command: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: TestResult;
}

export interface TestResult {
  success: boolean;
  message: string;
  duration: number;
  steps: TestStep[];
  errors?: string[];
}

export interface TestStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: Date;
  screenshot?: string;
}

export interface ParsedCommand {
  action: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface BulkTestData {
  id: string;
  command: string;
  parameters: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}
