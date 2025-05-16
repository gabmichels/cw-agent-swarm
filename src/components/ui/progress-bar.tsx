import React from 'react';

interface ProgressBarProps {
  /**
   * Progress value between 0 and 100
   */
  progress: number;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Progress bar component
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = '' }) => {
  return (
    <div className={`w-full h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  );
}; 