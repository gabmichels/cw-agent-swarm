import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ProgressBar } from '../ui/progress-bar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { N8nWorkflowTemplate } from '../../types/workflow';

interface ImportStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: 'pending' | 'running' | 'completed' | 'error';
  readonly progress?: number;
  readonly error?: string;
  readonly completedAt?: Date;
}

interface WorkflowImportProgressProps {
  readonly workflow: N8nWorkflowTemplate | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onComplete?: (workflow: N8nWorkflowTemplate) => void;
  readonly onRetry?: () => void;
}

interface ImportProgressState {
  readonly steps: ReadonlyArray<ImportStep>;
  readonly currentStep: number;
  readonly overallProgress: number;
  readonly status: 'running' | 'completed' | 'error';
  readonly error?: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
}

/**
 * WorkflowImportProgress - Real-time import progress tracking
 * Implements immutable state and provides detailed feedback
 */
export const WorkflowImportProgress: React.FC<WorkflowImportProgressProps> = ({
  workflow,
  isOpen,
  onClose,
  onComplete,
  onRetry
}) => {
  const [progressState, setProgressState] = React.useState<ImportProgressState>({
    steps: [
      {
        id: 'validate',
        name: 'Validate Workflow',
        description: 'Checking workflow structure and compatibility',
        status: 'pending'
      },
      {
        id: 'download',
        name: 'Download Workflow',
        description: 'Fetching workflow definition from repository',
        status: 'pending'
      },
      {
        id: 'transform',
        name: 'Transform Configuration',
        description: 'Adapting workflow for your platform',
        status: 'pending'
      },
      {
        id: 'credentials',
        name: 'Setup Credentials',
        description: 'Configuring required integrations and API keys',
        status: 'pending'
      },
      {
        id: 'deploy',
        name: 'Deploy Workflow',
        description: 'Installing workflow in your environment',
        status: 'pending'
      },
      {
        id: 'test',
        name: 'Test Execution',
        description: 'Verifying workflow functionality',
        status: 'pending'
      }
    ],
    currentStep: 0,
    overallProgress: 0,
    status: 'running',
    startedAt: new Date()
  });

  // Simulate import progress when workflow changes
  React.useEffect(() => {
    if (!workflow || !isOpen) return;

    // Reset progress
    setProgressState(prev => ({
      ...prev,
      steps: prev.steps.map(step => ({ ...step, status: 'pending' as const, progress: 0, error: undefined })),
      currentStep: 0,
      overallProgress: 0,
      status: 'running',
      startedAt: new Date(),
      completedAt: undefined
    }));

    // Simulate import steps
    const runImportSteps = async (): Promise<void> => {
      for (let i = 0; i < progressState.steps.length; i++) {
        const step = progressState.steps[i];
        
        // Start step
        setProgressState(prev => ({
          ...prev,
          currentStep: i,
          steps: prev.steps.map((s, idx) => 
            idx === i ? { ...s, status: 'running' as const } : s
          )
        }));

        // Simulate step progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          setProgressState(prev => ({
            ...prev,
            steps: prev.steps.map((s, idx) => 
              idx === i ? { ...s, progress } : s
            ),
            overallProgress: ((i * 100) + progress) / progressState.steps.length
          }));
        }

        // Complete step or simulate error
        const shouldError = step.id === 'credentials' && Math.random() < 0.3; // 30% chance of credentials error
        
        if (shouldError) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            steps: prev.steps.map((s, idx) => 
              idx === i 
                ? { ...s, status: 'error' as const, error: 'Failed to configure API credentials. Please check your settings.' }
                : s
            )
          }));
          return;
        }

        setProgressState(prev => ({
          ...prev,
          steps: prev.steps.map((s, idx) => 
            idx === i ? { ...s, status: 'completed' as const, completedAt: new Date() } : s
          )
        }));
      }

      // Complete import
      setProgressState(prev => ({
        ...prev,
        status: 'completed',
        overallProgress: 100,
        completedAt: new Date()
      }));

      // Notify completion
      setTimeout(() => {
        if (onComplete && workflow) {
          onComplete(workflow);
        }
      }, 1000);
    };

    runImportSteps().catch(error => {
      console.error('Import simulation failed:', error);
      setProgressState(prev => ({
        ...prev,
        status: 'error',
        error: 'Unexpected import error occurred'
      }));
    });
  }, [workflow, isOpen, onComplete, progressState.steps.length]);

  const handleRetry = React.useCallback((): void => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const end = endTime || new Date();
    const durationMs = end.getTime() - startTime.getTime();
    const seconds = Math.round(durationMs / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStepIcon = (step: ImportStep): string => {
    switch (step.status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'error': return '❌';
      default: return '⏸️';
    }
  };

  const getStatusColor = (status: ImportProgressState['status']): string => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  if (!workflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">📥</span>
            Importing Workflow
          </DialogTitle>
          <DialogDescription>
            Importing "{workflow.name}" into your platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Progress */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Import Progress</CardTitle>
                <Badge 
                  variant={progressState.status === 'completed' ? 'default' : 
                          progressState.status === 'error' ? 'destructive' : 'secondary'}
                  className="text-sm"
                >
                  {progressState.status === 'running' ? `Step ${progressState.currentStep + 1} of ${progressState.steps.length}` :
                   progressState.status === 'completed' ? 'Completed' :
                   'Error'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar 
                progress={progressState.overallProgress} 
                className="w-full"
              />
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  {progressState.status === 'running' ? 'In progress...' :
                   progressState.status === 'completed' ? 'Import completed successfully' :
                   'Import failed'}
                </span>
                <span>
                  Duration: {formatDuration(progressState.startedAt, progressState.completedAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Steps</CardTitle>
              <CardDescription>Detailed progress for each import phase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {progressState.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded-lg border transition-all ${
                      step.status === 'running' ? 'border-blue-200 bg-blue-50' :
                      step.status === 'completed' ? 'border-green-200 bg-green-50' :
                      step.status === 'error' ? 'border-red-200 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getStepIcon(step)}</span>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{step.name}</h4>
                          <p className="text-sm text-gray-600">{step.description}</p>
                          
                          {step.status === 'running' && step.progress !== undefined && (
                            <div className="mt-2">
                              <ProgressBar progress={step.progress} className="w-full h-2" />
                              <span className="text-xs text-gray-500">{step.progress}%</span>
                            </div>
                          )}
                          
                          {step.error && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-800">
                              {step.error}
                            </div>
                          )}
                          
                          {step.completedAt && (
                            <div className="mt-1 text-xs text-gray-500">
                              Completed at {step.completedAt.toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Badge 
                        variant={step.status === 'completed' ? 'default' : 
                                step.status === 'error' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {step.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Error State Actions */}
          {progressState.status === 'error' && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-lg text-red-800">Import Failed</CardTitle>
                <CardDescription className="text-red-600">
                  The workflow import encountered an error and could not be completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Retry Import
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    className="text-red-600 hover:bg-red-100"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success State Actions */}
          {progressState.status === 'completed' && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg text-green-800">Import Successful!</CardTitle>
                <CardDescription className="text-green-600">
                  "{workflow.name}" has been successfully imported and is ready to use.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={onClose}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    View Workflow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('/workflows', '_blank')}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Go to Workflows
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowImportProgress; 