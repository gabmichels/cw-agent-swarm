import React from 'react';

export interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  timestamp: Date;
}

export interface ProcessingLog {
  steps: ProcessingStep[];
  currentStep?: string;
  error?: string;
}

interface AgentProcessingStatusProps {
  processingLog: ProcessingLog;
  isProcessing: boolean;
}

const AgentProcessingStatus: React.FC<AgentProcessingStatusProps> = ({
  processingLog,
  isProcessing
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        Agent Processing Status
        {isProcessing && (
          <span className="ml-2 inline-block animate-pulse text-blue-400">
            Processing...
          </span>
        )}
      </h3>
      
      <div className="space-y-4">
        {processingLog.steps.map((step) => (
          <div key={step.id} className="flex items-start space-x-3">
            {/* Status Icon */}
            <div className="flex-shrink-0 mt-1">
              {step.status === 'completed' && (
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.status === 'processing' && (
                <svg className="h-5 w-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {step.status === 'error' && (
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {step.status === 'pending' && (
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            
            {/* Step Details */}
            <div className="flex-1">
              <p className={`font-medium ${
                step.status === 'completed' ? 'text-green-400' :
                step.status === 'processing' ? 'text-blue-400' :
                step.status === 'error' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {step.name}
              </p>
              {step.message && (
                <p className="text-sm text-gray-400 mt-1">{step.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {step.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {processingLog.error && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
          <p className="text-sm text-red-400">
            Error: {processingLog.error}
          </p>
        </div>
      )}
    </div>
  );
};

export default AgentProcessingStatus; 