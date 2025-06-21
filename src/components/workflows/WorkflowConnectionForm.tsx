import React from 'react';

export interface WorkflowConnectionFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export const WorkflowConnectionForm: React.FC<WorkflowConnectionFormProps> = ({
  onSubmit,
  onCancel
}) => {
  return (
    <div className="workflow-connection-form">
      <h2>Workflow Connection Form</h2>
      <p>This component will be implemented when the required UI components are available.</p>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
};
