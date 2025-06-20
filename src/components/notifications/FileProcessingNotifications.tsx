import React, { useState, useEffect, useRef } from 'react';
import { ulid } from 'ulid';

/**
 * File processing status types
 */
export type FileProcessingStatus = 
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * File processing progress data
 */
export interface FileProcessingProgress {
  id: string;
  fileName: string;
  fileSize: number;
  status: FileProcessingStatus;
  progress: number; // 0-100
  uploadedBytes?: number;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    processedFileUrl?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * File processing event for SSE
 */
export interface FileProcessingEvent {
  type: 'FILE_UPLOAD_PROGRESS' | 'FILE_UPLOAD_COMPLETE' | 'FILE_PROCESSING_START' | 'FILE_PROCESSING_COMPLETE' | 'FILE_PROCESSING_ERROR';
  fileId: string;
  fileName: string;
  progress?: number;
  status: FileProcessingStatus;
  uploadedBytes?: number;
  totalBytes?: number;
  error?: string;
  result?: {
    processedFileUrl?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: Date;
}

interface FileProcessingNotificationsProps {
  /** Current file processing items */
  processingFiles?: FileProcessingProgress[];
  /** Maximum number of files to show */
  maxVisible?: number;
  /** Whether to auto-hide completed files */
  autoHideCompleted?: boolean;
  /** Auto-hide delay for completed files (milliseconds) */
  autoHideDelay?: number;
  /** Custom CSS classes */
  className?: string;
  /** Callback when file is clicked */
  onFileClick?: (file: FileProcessingProgress) => void;
  /** Callback when file is dismissed */
  onFileDismiss?: (fileId: string) => void;
  /** Callback when retry is requested */
  onRetry?: (fileId: string) => void;
}

/**
 * File processing notifications component
 */
export function FileProcessingNotifications({
  processingFiles = [],
  maxVisible = 5,
  autoHideCompleted = true,
  autoHideDelay = 5000,
  className = '',
  onFileClick,
  onFileDismiss,
  onRetry
}: FileProcessingNotificationsProps) {
  const [visibleFiles, setVisibleFiles] = useState<FileProcessingProgress[]>([]);
  const [dismissedFiles, setDismissedFiles] = useState<Set<string>>(new Set());
  const hideTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Filter and manage visible files
  useEffect(() => {
    let filtered = processingFiles.filter(file => !dismissedFiles.has(file.id));
    
    // Auto-hide completed files after delay
    if (autoHideCompleted) {
      filtered.forEach(file => {
        if (file.status === 'completed' && !hideTimeouts.current.has(file.id)) {
          const timeout = setTimeout(() => {
            setDismissedFiles(prev => new Set([...prev, file.id]));
            hideTimeouts.current.delete(file.id);
          }, autoHideDelay);
          
          hideTimeouts.current.set(file.id, timeout);
        }
      });
    }

    // Limit visible files
    setVisibleFiles(filtered.slice(0, maxVisible));
  }, [processingFiles, dismissedFiles, maxVisible, autoHideCompleted, autoHideDelay]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      hideTimeouts.current.forEach(timeout => clearTimeout(timeout));
      hideTimeouts.current.clear();
    };
  }, []);

  // Handle file dismissal
  const handleDismiss = (fileId: string) => {
    setDismissedFiles(prev => new Set([...prev, fileId]));
    
    // Clear any pending hide timeout
    const timeout = hideTimeouts.current.get(fileId);
    if (timeout) {
      clearTimeout(timeout);
      hideTimeouts.current.delete(fileId);
    }
    
    onFileDismiss?.(fileId);
  };

  // Get status icon
  const getStatusIcon = (status: FileProcessingStatus): string => {
    const icons = {
      uploading: '⬆️',
      processing: '⚙️',
      completed: '✅',
      failed: '❌',
      cancelled: '⏹️'
    };
    return icons[status];
  };

  // Get status color
  const getStatusColor = (status: FileProcessingStatus): string => {
    const colors = {
      uploading: 'text-blue-600',
      processing: 'text-yellow-600',
      completed: 'text-green-600',
      failed: 'text-red-600',
      cancelled: 'text-gray-600'
    };
    return colors[status];
  };

  // Get progress bar color
  const getProgressColor = (status: FileProcessingStatus): string => {
    const colors = {
      uploading: 'bg-blue-500',
      processing: 'bg-yellow-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      cancelled: 'bg-gray-500'
    };
    return colors[status];
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format progress text
  const getProgressText = (file: FileProcessingProgress): string => {
    switch (file.status) {
      case 'uploading':
        if (file.uploadedBytes && file.fileSize) {
          return `Uploading: ${formatFileSize(file.uploadedBytes)} / ${formatFileSize(file.fileSize)}`;
        }
        return `Uploading: ${file.progress}%`;
      case 'processing':
        return 'Processing file...';
      case 'completed':
        return 'Processing complete';
      case 'failed':
        return file.error || 'Processing failed';
      case 'cancelled':
        return 'Processing cancelled';
      default:
        return `${file.progress}%`;
    }
  };

  if (visibleFiles.length === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 space-y-2 z-50 ${className}`}>
      {visibleFiles.map((file) => (
        <div
          key={file.id}
          className="bg-white rounded-lg shadow-lg border p-4 min-w-80 max-w-96 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => onFileClick?.(file)}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg">{getStatusIcon(file.status)}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 truncate" title={file.fileName}>
                  {file.fileName}
                </h3>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.fileSize)}
                </p>
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(file.id);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          {(file.status === 'uploading' || file.status === 'processing') && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(file.status)}`}
                  style={{ width: `${Math.min(file.progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Text */}
          <div className="flex items-center justify-between text-sm">
            <span className={`${getStatusColor(file.status)}`}>
              {getProgressText(file)}
            </span>
            
            {file.status === 'failed' && onRetry && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(file.id);
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>

          {/* Result Summary */}
          {file.status === 'completed' && file.result?.summary && (
            <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-800">
              {file.result.summary}
            </div>
          )}

          {/* Error Details */}
          {file.status === 'failed' && file.error && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-800">
              {file.error}
            </div>
          )}

          {/* Action Buttons */}
          {file.status === 'completed' && file.result?.processedFileUrl && (
            <div className="mt-2 flex gap-2">
              <a
                href={file.result.processedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                View Result
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to manage file processing notifications
 */
export function useFileProcessingNotifications() {
  const [processingFiles, setProcessingFiles] = useState<FileProcessingProgress[]>([]);

  // Add or update a file processing item
  const updateFileProgress = (fileData: Partial<FileProcessingProgress> & { id: string; fileName: string }) => {
    setProcessingFiles(prev => {
      const existing = prev.find(f => f.id === fileData.id);
      
      if (existing) {
        // Update existing file
        return prev.map(f => 
          f.id === fileData.id 
            ? { ...f, ...fileData }
            : f
        );
      } else {
        // Add new file
        const newFile: FileProcessingProgress = {
          fileSize: 0,
          status: 'uploading',
          progress: 0,
          ...fileData
        };
        return [...prev, newFile];
      }
    });
  };

  // Remove a file from processing
  const removeFile = (fileId: string) => {
    setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Handle file processing events from SSE
  const handleFileProcessingEvent = (event: FileProcessingEvent) => {
    const fileData: Partial<FileProcessingProgress> = {
      id: event.fileId,
      fileName: event.fileName,
      status: event.status,
      progress: event.progress || 0
    };

    switch (event.type) {
      case 'FILE_UPLOAD_PROGRESS':
        fileData.uploadedBytes = event.uploadedBytes;
        if (event.totalBytes) {
          fileData.fileSize = event.totalBytes;
          fileData.progress = Math.round((event.uploadedBytes || 0) / event.totalBytes * 100);
        }
        break;
        
      case 'FILE_UPLOAD_COMPLETE':
        fileData.status = 'processing';
        fileData.progress = 100;
        fileData.processedAt = new Date();
        break;
        
      case 'FILE_PROCESSING_START':
        fileData.status = 'processing';
        fileData.processedAt = new Date();
        break;
        
      case 'FILE_PROCESSING_COMPLETE':
        fileData.status = 'completed';
        fileData.progress = 100;
        fileData.completedAt = new Date();
        fileData.result = event.result;
        break;
        
      case 'FILE_PROCESSING_ERROR':
        fileData.status = 'failed';
        fileData.error = event.error;
        break;
    }

    updateFileProgress(fileData as FileProcessingProgress);
  };

  // Start file upload
  const startFileUpload = (fileId: string, fileName: string, fileSize: number) => {
    updateFileProgress({
      id: fileId,
      fileName,
      fileSize,
      status: 'uploading',
      progress: 0
    });
  };

  // Update upload progress
  const updateUploadProgress = (fileId: string, uploadedBytes: number, totalBytes: number) => {
    const progress = Math.round((uploadedBytes / totalBytes) * 100);
    setProcessingFiles(prev => 
      prev.map(f => 
        f.id === fileId 
          ? { ...f, uploadedBytes, progress }
          : f
      )
    );
  };

  // Mark file as processing
  const markFileAsProcessing = (fileId: string) => {
    setProcessingFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'processing', progress: 0, processedAt: new Date() }
          : f
      )
    );
  };

  // Complete file processing
  const completeFileProcessing = (fileId: string, result?: FileProcessingProgress['result']) => {
    setProcessingFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'completed', progress: 100, completedAt: new Date(), result }
          : f
      )
    );
  };

  // Mark file as failed
  const markFileAsFailed = (fileId: string, error: string) => {
    setProcessingFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'failed', error }
          : f
      )
    );
  };

  // Cancel file processing
  const cancelFileProcessing = (fileId: string) => {
    setProcessingFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'cancelled' }
          : f
      )
    );
  };

  // Clear all completed files
  const clearCompleted = () => {
    setProcessingFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  // Clear all files
  const clearAll = () => {
    setProcessingFiles([]);
  };

  return {
    processingFiles,
    updateFileProgress,
    removeFile,
    handleFileProcessingEvent,
    startFileUpload,
    updateUploadProgress,
    markFileAsProcessing,
    completeFileProcessing,
    markFileAsFailed,
    cancelFileProcessing,
    clearCompleted,
    clearAll
  };
}

/**
 * Higher-order component to add file processing notifications to file upload components
 */
export function withFileProcessingNotifications<T extends { onUpload?: (files: FileList) => void }>(
  Component: React.ComponentType<T>
) {
  return function FileProcessingWrapper(props: T) {
    const {
      startFileUpload,
      updateUploadProgress,
      markFileAsProcessing,
      completeFileProcessing,
      markFileAsFailed
    } = useFileProcessingNotifications();

    const handleUpload = async (files: FileList) => {
      // Call original onUpload if it exists
      props.onUpload?.(files);

      // Process each file
      Array.from(files).forEach(async (file) => {
        const fileId = ulid();
        
        try {
          // Start upload tracking
          startFileUpload(fileId, file.name, file.size);

          // Simulate upload progress (replace with actual upload logic)
          for (let progress = 0; progress <= 100; progress += 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            updateUploadProgress(fileId, (progress / 100) * file.size, file.size);
          }

          // Mark as processing
          markFileAsProcessing(fileId);

          // Simulate processing (replace with actual processing logic)
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Complete processing
          completeFileProcessing(fileId, {
            summary: `Successfully processed ${file.name}`,
            processedFileUrl: URL.createObjectURL(file)
          });

        } catch (error) {
          markFileAsFailed(fileId, error instanceof Error ? error.message : 'Upload failed');
        }
      });
    };

    return <Component {...props} onUpload={handleUpload} />;
  };
} 