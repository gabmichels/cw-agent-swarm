'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

/**
 * File metadata interface matching backend
 */
interface FileMetadata {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadDate: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  summary?: string;
  processingModel?: string;
  tags?: string[];
}

/**
 * Props for the FilesTable component
 */
interface FilesTableProps {
  onRefresh?: () => void;
  onImageClick?: (imageId: string, filename: string) => void;
}

/**
 * Files table component that displays a list of uploaded files
 */
export default function FilesTable({ onRefresh, onImageClick }: FilesTableProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});
  
  /**
   * Fetch files from the API
   */
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/files/list');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error fetching files');
      }
      
      // Convert dates from strings to Date objects
      const processedFiles = data.files.map((file: any) => ({
        ...file,
        uploadDate: new Date(file.uploadDate).toISOString()
      }));
      
      setFiles(processedFiles);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Delete a file
   */
  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error deleting file');
      }
      
      // Remove the file from the list
      setFiles(files.filter(file => file.fileId !== fileId));
      
      // Call onRefresh if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Error deleting file:', err);
      alert(`Error deleting file: ${err.message}`);
    }
  };
  
  /**
   * Reprocess a file
   */
  const reprocessFile = async (fileId: string) => {
    try {
      const response = await fetch('/api/files/reprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reprocess file: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error reprocessing file');
      }
      
      alert('File reprocessing requested');
      
      // Refresh the file list
      fetchFiles();
      
      // Call onRefresh if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Error reprocessing file:', err);
      alert(`Error reprocessing file: ${err.message}`);
    }
  };
  
  /**
   * Toggle summary expansion
   */
  const toggleSummary = (fileId: string) => {
    setExpandedSummaries(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };
  
  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  };
  
  /**
   * Get icon based on file type
   */
  const getFileTypeIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType === 'application/pdf') {
      return '📄';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return '📝';
    } else if (mimeType.startsWith('text/')) {
      return '📃';
    } else {
      return '📁';
    }
  };
  
  /**
   * Format the date for display
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return `${formatDistanceToNow(date)} ago`;
    } catch (err) {
      return 'Unknown date';
    }
  };
  
  /**
   * Handle clicking on a file name, especially for images
   */
  const handleFileClick = (file: FileMetadata) => {
    if (file.mimeType.startsWith('image/') && onImageClick) {
      onImageClick(file.fileId, file.filename);
    }
  };
  
  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Files</h2>
        <button
          onClick={fetchFiles}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-800 text-white p-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <p>No files uploaded yet.</p>
          <p className="mt-2 text-sm">Upload a file via chat to see it here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {files.map(file => (
                <tr key={file.fileId}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <span 
                        className={`mr-2 ${file.mimeType.startsWith('image/') ? 'cursor-pointer' : ''}`}
                        onClick={() => file.mimeType.startsWith('image/') && onImageClick ? onImageClick(file.fileId, file.filename) : null}
                      >
                        {getFileTypeIcon(file.mimeType)}
                      </span>
                      <div>
                        <div 
                          className={`font-medium ${file.mimeType.startsWith('image/') ? 'cursor-pointer hover:text-blue-300' : ''}`}
                          onClick={() => handleFileClick(file)}
                        >
                          {file.filename}
                        </div>
                        {file.tags && file.tags.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {file.tags.map(tag => (
                              <span key={tag} className="bg-gray-700 px-1.5 py-0.5 rounded mr-1">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {file.summary && expandedSummaries[file.fileId] && (
                          <div className="mt-2 text-sm text-gray-300 bg-gray-700 p-2 rounded">
                            {file.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {file.mimeType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatDate(file.uploadDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      file.processingStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      file.processingStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                      file.processingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {file.processingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      {file.summary && (
                        <button 
                          onClick={() => toggleSummary(file.fileId)}
                          className="text-blue-400 hover:text-blue-300"
                          title={expandedSummaries[file.fileId] ? "Hide summary" : "Show summary"}
                        >
                          {expandedSummaries[file.fileId] ? '📕' : '📖'}
                        </button>
                      )}
                      <button 
                        onClick={() => reprocessFile(file.fileId)}
                        className="text-yellow-400 hover:text-yellow-300"
                        title="Reprocess file"
                      >
                        🔄
                      </button>
                      <button 
                        onClick={() => deleteFile(file.fileId)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 