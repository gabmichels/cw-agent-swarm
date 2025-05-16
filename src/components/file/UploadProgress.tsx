import { X } from 'lucide-react';
import { IconButton } from '../ui/icon-button';

interface UploadProgressProps {
  /**
   * Name of the file being uploaded
   */
  filename: string;

  /**
   * Upload progress (0-100)
   */
  progress: number;

  /**
   * Whether the upload is complete
   */
  isComplete?: boolean;

  /**
   * Whether there was an error during upload
   */
  error?: string;

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: () => void;

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
 * Component for displaying file upload progress
 */
export function UploadProgress({
  filename,
  progress,
  isComplete = false,
  error,
  onCancel,
  onRetry,
  className
}: UploadProgressProps) {
  return (
    <div
      className={`
        relative rounded-lg border p-3
        ${error ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : 
          isComplete ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 
          'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}
        ${className}
      `}
    >
      {/* Progress Bar Background */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-in-out
            ${error ? 'bg-red-100 dark:bg-red-900' : 
              isComplete ? 'bg-green-100 dark:bg-green-900' : 
              'bg-blue-100 dark:bg-blue-900'}
          `}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="relative flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : isComplete ? (
              'Upload complete'
            ) : (
              `${Math.round(progress)}% uploaded`
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {error && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Retry
            </button>
          )}
          {!isComplete && onCancel && (
            <IconButton
              icon={<X className="h-4 w-4" />}
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              aria-label="Cancel upload"
            />
          )}
        </div>
      </div>
    </div>
  );
} 