import { AlertCircle, RefreshCw } from 'lucide-react';
import { IconButton } from './icon-button';

interface ErrorDisplayProps {
  /**
   * The error message to display
   */
  message: string;

  /**
   * Optional error details
   */
  details?: string;

  /**
   * Optional help text
   */
  helpText?: string;

  /**
   * Callback when retry button is clicked
   */
  onRetry?: () => void;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Component for displaying error messages with retry functionality
 */
export function ErrorDisplay({
  message,
  details,
  helpText,
  onRetry,
  className
}: ErrorDisplayProps) {
  return (
    <div
      className={`
        rounded-lg border border-red-200 bg-red-50 p-4
        dark:border-red-800 dark:bg-red-950
        ${className}
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {message}
          </h3>
          {details && (
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {details}
            </div>
          )}
          {helpText && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {helpText}
            </div>
          )}
          {onRetry && (
            <div className="mt-4">
              <IconButton
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={onRetry}
                className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                aria-label="Retry"
              >
                Try again
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 