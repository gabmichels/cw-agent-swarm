import React, { useState } from 'react';
import FilesTable from '../FilesTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

/**
 * ImagePreviewModal component
 */
interface ImagePreviewModalProps {
  imageId: string;
  filename: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageId, filename, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium truncate">{filename}</h3>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 rounded-full p-1"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          <img
            src={`/api/files/image/${imageId}`}
            alt={filename}
            className="max-w-full max-h-[70vh] mx-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/image-error.svg';
              (e.target as HTMLImageElement).className = 'max-w-full max-h-[50vh] mx-auto opacity-50';
            }}
          />
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * FilesTab component
 */
export default function FilesTab() {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('standard');
  
  /**
   * Handle image click to show preview
   */
  const handleImageClick = (imageId: string, filename: string) => {
    setSelectedImageId(imageId);
    setSelectedImageName(filename);
  };
  
  /**
   * Handle close of image preview
   */
  const handleClosePreview = () => {
    setSelectedImageId(null);
  };
  
  /**
   * Handle refresh trigger
   */
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Files</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="standard">Standard View</TabsTrigger>
          <TabsTrigger value="memory">Memory System</TabsTrigger>
        </TabsList>
        
        <TabsContent value="standard" className="mt-4">
          <FilesTable 
            onRefresh={handleRefresh}
            onImageClick={handleImageClick}
            useMemorySystem={false}
          />
        </TabsContent>
        
        <TabsContent value="memory" className="mt-4">
          <FilesTable 
            onRefresh={handleRefresh}
            onImageClick={handleImageClick}
            useMemorySystem={true}
          />
        </TabsContent>
      </Tabs>
      
      {selectedImageId && (
        <ImagePreviewModal
          imageId={selectedImageId}
          filename={selectedImageName}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
} 