import React from 'react';

interface ErrorMessageProps {
  /**
   * Error message to display
   */
  message: string;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Error message component with optional retry button
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className = '' }) => {
  if (!message) return null;
  
  return (
    <div className={`text-red-500 text-sm mt-1 ${className}`} role="alert">
      {message}
    </div>
  );
}; 