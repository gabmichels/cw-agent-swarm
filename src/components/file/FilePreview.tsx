import { useState } from 'react';
import { FileMetadata, FileAttachmentType } from '@/types/files';
import { IconButton } from '@/components/ui/icon-button';
import { ImageModal } from '@/components/modals/ImageModal';
import { 
  X,
  Image as ImageIcon,
  FileText,
  FileVideo,
  FileAudio,
  File,
  ExternalLink,
  Download
} from 'lucide-react';

interface FilePreviewProps {
  /**
   * File metadata
   */
  metadata: FileMetadata;

  /**
   * Preview URL for the file
   */
  previewUrl: string;

  /**
   * Whether the file is being processed
   */
  isProcessing?: boolean;

  /**
   * Error message if processing failed
   */
  error?: string;

  /**
   * Callback when remove button is clicked
   */
  onRemove?: () => void;

  /**
   * Callback when download button is clicked
   */
  onDownload?: () => void;

  /**
   * Callback when preview is clicked
   */
  onClick?: () => void;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Component for displaying file previews with metadata
 */
export function FilePreview({
  metadata,
  previewUrl,
  isProcessing = false,
  error,
  onRemove,
  onDownload,
  onClick,
  className
}: FilePreviewProps) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Get appropriate icon based on file type
  const getFileIcon = () => {
    switch (metadata.attachmentType) {
      case FileAttachmentType.IMAGE:
        return <ImageIcon className="h-6 w-6" />;
      case FileAttachmentType.DOCUMENT:
        return <FileText className="h-6 w-6" />;
      case FileAttachmentType.VIDEO:
        return <FileVideo className="h-6 w-6" />;
      case FileAttachmentType.AUDIO:
        return <FileAudio className="h-6 w-6" />;
      default:
        return <File className="h-6 w-6" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handlePreviewClick = () => {
    if (error || isProcessing) return;
    
    if (metadata.attachmentType === FileAttachmentType.IMAGE) {
      setIsImageModalOpen(true);
    } else {
      onClick?.();
    }
  };

  return (
    <>
      <div
        className={`
          relative flex items-center gap-3 rounded-lg border p-3 
          ${error ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}
          ${isProcessing ? 'animate-pulse' : ''}
          ${!error && !isProcessing ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : ''}
          ${className}
        `}
        onClick={handlePreviewClick}
      >
        {/* Preview/Icon */}
        <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden bg-white dark:bg-gray-700">
          {metadata.attachmentType === FileAttachmentType.IMAGE && previewUrl ? (
            <img
              src={previewUrl}
              alt={metadata.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
              {getFileIcon()}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {metadata.filename}
            </p>
            {!error && !isProcessing && (
              <ExternalLink className="h-4 w-4 text-gray-400" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : isProcessing ? (
              'Processing...'
            ) : (
              formatFileSize(metadata.size)
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {!error && !isProcessing && onDownload && (
            <IconButton
              icon={<Download className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Download file"
            />
          )}
          {onRemove && (
            <IconButton
              icon={<X className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove file"
            />
          )}
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
          </div>
        )}
      </div>

      {/* Image Modal */}
      {metadata.attachmentType === FileAttachmentType.IMAGE && (
        <ImageModal
          isOpen={isImageModalOpen}
          imageUrl={previewUrl}
          metadata={metadata}
          onClose={() => setIsImageModalOpen(false)}
        />
      )}
    </>
  );
} 