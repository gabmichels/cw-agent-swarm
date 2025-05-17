import React, { useState, useRef, useEffect } from 'react';

interface MemoryFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  preview?: string;
}

interface MemoryUploaderProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Component for uploading markdown files as memories for an agent
 */
const MemoryUploader: React.FC<MemoryUploaderProps> = ({
  agentId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset component state when modal is closed
      setFiles([]);
      setSelectedFileId(null);
      setError(null);
      setSuccess(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    processFiles(Array.from(fileList));
  };

  // Process uploaded files
  const processFiles = (fileList: File[]) => {
    const newFiles: MemoryFile[] = [];
    let processed = 0;
    
    // Generate a stable ID for files
    const generateStableId = (fileName: string, index: number) => {
      const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `mem_${safeFileName}_${index}_${Date.now()}`;
    };
    
    fileList.forEach((file, index) => {
      if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
        setError(`Skipping file ${file.name}: Only .md and .txt files are supported`);
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
        
        newFiles.push({
          id: generateStableId(file.name, index),
          name: file.name,
          content,
          size: file.size,
          type: file.type,
          preview
        });
        
        processed++;
        
        if (processed === fileList.length) {
          setFiles(prev => [...prev, ...newFiles]);
        }
      };
      
      reader.readAsText(file);
    });
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    processFiles(Array.from(e.dataTransfer.files));
  };

  // Remove a file
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
    if (selectedFileId === id) {
      setSelectedFileId(null);
    }
  };

  // View file preview
  const viewFile = (id: string) => {
    setSelectedFileId(selectedFileId === id ? null : id);
  };

  // Submit files as memories
  const submitMemories = async () => {
    if (files.length === 0) {
      setError("Please upload at least one file");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare the API request
      const response = await fetch(`/api/multi-agent/agents/${agentId}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memories: files.map(file => ({
            content: file.content,
            metadata: {
              source: file.name,
              type: 'knowledge',
              critical: true
            }
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload memories');
      }

      setSuccess(`Successfully added ${files.length} memories to the agent`);
      setFiles([]);
      
      // Notify parent component
      if (onSuccess) {
        onSuccess();
      }
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const formattedSize = totalSize < 1024 * 1024
    ? `${(totalSize / 1024).toFixed(2)} KB`
    : `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Upload Agent Memories</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="text-gray-300 mb-6">
          Upload markdown (.md) or text (.txt) files to add as critical memories for this agent. 
          This helps the agent retain important knowledge across conversations.
        </p>
        
        {/* File Upload Area */}
        <div className="mb-6">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              isDragging ? 'border-blue-500 bg-blue-900 bg-opacity-10' : 'border-gray-600'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".md,.txt"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded text-white"
              disabled={isLoading}
            >
              Select Files
            </button>
            <p className="mt-2 text-sm text-gray-400">
              Or drag and drop markdown files (.md) here
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Upload markdown files containing knowledge for the agent
            </p>
          </div>
        </div>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-900/30 border border-green-800 text-green-200 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}
        
        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">Uploaded Files</h3>
              <span className="text-xs text-gray-400">{files.length} files ({formattedSize})</span>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map(file => (
                <div 
                  key={file.id}
                  className={`bg-gray-700 p-3 rounded flex items-center ${
                    selectedFileId === file.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-gray-400">
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                  
                  <div>
                    <button
                      type="button"
                      onClick={() => viewFile(file.id)}
                      className="text-blue-400 hover:text-blue-300 mr-2"
                    >
                      {selectedFileId === file.id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* File Preview */}
            {selectedFileId && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="font-medium mb-2">Preview</h4>
                <div className="whitespace-pre-wrap text-gray-300 text-sm max-h-40 overflow-y-auto">
                  {files.find(file => file.id === selectedFileId)?.preview}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Submit Button */}
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded mr-2"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitMemories}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            disabled={isLoading || files.length === 0}
          >
            {isLoading ? 'Processing...' : 'Upload Memories'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoryUploader; 