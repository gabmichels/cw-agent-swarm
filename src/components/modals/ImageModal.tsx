import { useEffect, useRef, useState } from 'react';
import { FileMetadata } from '../../types/files';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RotateCw, 
  X, 
  Download 
} from 'lucide-react';

interface ImageModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * URL of the image to display
   */
  imageUrl: string;

  /**
   * Optional metadata about the image
   */
  metadata?: FileMetadata;

  /**
   * Optional array of image URLs for navigation
   */
  imageUrls?: string[];

  /**
   * Current index in the image array
   */
  currentIndex?: number;

  /**
   * Callback when the modal is closed
   */
  onClose: () => void;

  /**
   * Callback when navigating to another image
   */
  onNavigate?: (index: number) => void;
}

/**
 * Modal component for displaying full-size images with navigation and controls
 */
export function ImageModal({
  isOpen,
  imageUrl,
  metadata,
  imageUrls,
  currentIndex = 0,
  onClose,
  onNavigate
}: ImageModalProps) {
  // State for zoom and rotation
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs for image and container
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when image changes
  useEffect(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, imageUrls]);

  // Navigation handlers
  const handlePrevious = () => {
    if (!imageUrls || !onNavigate || currentIndex <= 0) return;
    onNavigate(currentIndex - 1);
  };

  const handleNext = () => {
    if (!imageUrls || !onNavigate || currentIndex >= imageUrls.length - 1) return;
    onNavigate(currentIndex + 1);
  };

  // Zoom handlers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // Rotation handlers
  const handleRotateLeft = () => setRotation(prev => (prev - 90) % 360);
  const handleRotateRight = () => setRotation(prev => (prev + 90) % 360);

  // Download handler
  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata?.filename || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  // Drag handlers
  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
        <div className="relative flex flex-col h-full">
          {/* Toolbar */}
          <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 bg-black bg-opacity-50 z-10">
            <div className="flex items-center gap-2">
              <IconButton onClick={handleZoomIn} icon={<ZoomIn className="h-5 w-5" />} />
              <IconButton onClick={handleZoomOut} icon={<ZoomOut className="h-5 w-5" />} />
              <IconButton onClick={handleRotateLeft} icon={<RotateCcw className="h-5 w-5" />} />
              <IconButton onClick={handleRotateRight} icon={<RotateCw className="h-5 w-5" />} />
              <IconButton onClick={handleDownload} icon={<Download className="h-5 w-5" />} />
            </div>
            <IconButton onClick={onClose} icon={<X className="h-5 w-5" />} />
          </div>

          {/* Image container */}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-black"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt={metadata?.filename || 'Image'}
              className="absolute top-1/2 left-1/2 max-w-none"
              style={{
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'transform 0.2s'
              }}
              draggable={false}
            />
          </div>

          {/* Navigation buttons */}
          {imageUrls && imageUrls.length > 1 && (
            <>
              <Button
                className="absolute left-4 top-1/2 transform -translate-y-1/2"
                onClick={handlePrevious}
                disabled={currentIndex <= 0}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                onClick={handleNext}
                disabled={currentIndex >= (imageUrls.length - 1)}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Metadata display */}
          {metadata && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50">
              <p className="text-white text-sm">{metadata.filename}</p>
              <p className="text-gray-300 text-xs">
                {new Date(metadata.timestamp).toLocaleString()} • {(metadata.size / 1024).toFixed(1)}KB
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 