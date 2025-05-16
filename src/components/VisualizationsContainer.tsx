import React from 'react';
import ThinkingVisualizer from './ThinkingVisualizer';

interface VisualizationsContainerProps {
  chatId: string;
  messageId?: string;
}

const VisualizationsContainer: React.FC<VisualizationsContainerProps> = ({
  chatId,
  messageId
}) => {
  return (
    <div className="visualizations-container p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Visualizations</h1>
        <p className="text-gray-600">
          View the thinking process and reasoning steps behind agent responses.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <ThinkingVisualizer chatId={chatId} messageId={messageId} />
      </div>
    </div>
  );
};

export default VisualizationsContainer; 