'use client';

import { useState, useRef } from 'react';

interface FileUploadButtonProps {
  onUploadStart?: () => void;
  onUploadComplete?: (result: any) => void;
  onUploadError?: (error: string) => void;
}

/**
 * A button component for uploading files that integrates with the chat interface
 */
export default function FileUploadButton({
  onUploadStart,
  onUploadComplete,
  onUploadError
}: FileUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  /**
   * Handle file selection
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    await uploadFile(file);
    
    // Reset the input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  /**
   * Click the hidden file input
   */
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  /**
   * Upload the file to the server
   */
  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      
      if (onUploadStart) {
        onUploadStart();
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Send to server
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Notify parent of success
      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      // Notify parent of error
      if (onUploadError) {
        onUploadError(error.message || 'Failed to upload file');
      }
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept=".txt,.pdf,.docx,.md,.csv,.jpg,.jpeg,.png,.gif"
      />
      <button
        onClick={triggerFileSelect}
        disabled={isUploading}
        className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
        title="Upload file"
      >
        {isUploading ? (
          <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full" />
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
            />
          </svg>
        )}
      </button>
    </>
  );
} 