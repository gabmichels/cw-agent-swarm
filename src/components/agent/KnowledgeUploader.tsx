import React, { useState, useRef, useEffect } from 'react';

interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  preview?: string;
}

interface KnowledgeUploaderProps {
  initialKnowledgePaths?: string[];
  initialFiles?: KnowledgeFile[];
  onChange: (data: {
    knowledgePaths: string[];
    files: KnowledgeFile[];
  }) => void;
}

/**
 * Component for uploading and managing knowledge files
 */
const KnowledgeUploader: React.FC<KnowledgeUploaderProps> = ({
  initialKnowledgePaths = [],
  initialFiles = [],
  onChange
}) => {
  const [knowledgePaths, setKnowledgePaths] = useState<string[]>(
    initialKnowledgePaths.length > 0 
      ? initialKnowledgePaths 
      : ['data/knowledge/company', 'data/knowledge/agents/shared']
  );
  const [files, setFiles] = useState<KnowledgeFile[]>(initialFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Keep track of previous values to prevent unnecessary updates
  const prevValuesRef = useRef<{
    knowledgePaths: string[];
    files: KnowledgeFile[];
  }>({
    knowledgePaths: initialKnowledgePaths.length > 0 
      ? initialKnowledgePaths 
      : ['data/knowledge/company', 'data/knowledge/agents/shared'],
    files: initialFiles
  });

  // Update state if initial props change
  useEffect(() => {
    if (JSON.stringify(initialKnowledgePaths) !== JSON.stringify(prevValuesRef.current.knowledgePaths)) {
      setKnowledgePaths(initialKnowledgePaths.length > 0 
        ? initialKnowledgePaths 
        : ['data/knowledge/company', 'data/knowledge/agents/shared']);
      prevValuesRef.current.knowledgePaths = initialKnowledgePaths;
    }
    
    if (JSON.stringify(initialFiles) !== JSON.stringify(prevValuesRef.current.files)) {
      setFiles(initialFiles);
      prevValuesRef.current.files = initialFiles;
    }
  }, [initialKnowledgePaths, initialFiles]);

  // Notify parent component of changes
  useEffect(() => {
    const currentValues = {
      knowledgePaths,
      files
    };
    
    // Only call onChange if values have changed
    if (
      JSON.stringify(knowledgePaths) !== JSON.stringify(prevValuesRef.current.knowledgePaths) ||
      JSON.stringify(files) !== JSON.stringify(prevValuesRef.current.files)
    ) {
      onChange(currentValues);
      prevValuesRef.current = currentValues;
    }
  }, [knowledgePaths, files, onChange]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    processFiles(Array.from(fileList));
  };

  // Process uploaded files
  const processFiles = (fileList: File[]) => {
    const newFiles: KnowledgeFile[] = [];
    let processed = 0;
    
    // Client-side ID counter to ensure unique IDs without hydration issues
    let idCounter = 0;
    
    // Generate a stable ID for files that won't cause hydration mismatches
    const generateStableId = (fileName: string, index: number) => {
      // Create a deterministic ID based on the file name and an index
      const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `file_${safeFileName}_${index}_${idCounter++}`;
    };
    
    fileList.forEach((file, index) => {
      if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
        console.warn(`Skipping file ${file.name}: Only .md and .txt files are supported`);
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

  // Add a knowledge path
  const addKnowledgePath = () => {
    setKnowledgePaths(prev => [...prev, '']);
  };

  // Update a knowledge path
  const updateKnowledgePath = (index: number, value: string) => {
    const updatedPaths = [...knowledgePaths];
    updatedPaths[index] = value;
    setKnowledgePaths(updatedPaths);
  };

  // Remove a knowledge path
  const removeKnowledgePath = (index: number) => {
    setKnowledgePaths(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const formattedSize = totalSize < 1024 * 1024
    ? `${(totalSize / 1024).toFixed(2)} KB`
    : `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">Knowledge Sources</h2>
      
      {/* File Upload Area */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">Upload Knowledge Files</h3>
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
      
      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium">Uploaded Files</h3>
            <span className="text-xs text-gray-400">{files.length} files ({formattedSize})</span>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map(file => (
              <div key={file.id} className="bg-gray-700 p-3 rounded">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <div className="font-medium mb-1 sm:mb-0">{file.name}</div>
                  <div className="flex space-x-2 text-xs">
                    <span className="text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => viewFile(file.id)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {selectedFileId === file.id ? 'Hide Preview' : 'Preview'}
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
                
                {selectedFileId === file.id && (
                  <div className="mt-2 p-2 bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap">
                    {file.preview}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Knowledge Directories */}
      <div className="mb-4">
        <h3 className="text-md font-medium mb-2">Knowledge Directories</h3>
        <p className="text-sm text-gray-400 mb-3">
          Specify directories where the agent should look for knowledge files
        </p>
        
        <div className="space-y-2">
          {knowledgePaths.map((path, index) => (
            <div key={index} className="flex">
              <input
                type="text"
                value={path}
                onChange={(e) => updateKnowledgePath(index, e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                placeholder="Enter path to knowledge directory"
              />
              <button
                type="button"
                onClick={() => removeKnowledgePath(index)}
                className="bg-red-600 hover:bg-red-700 px-4 rounded-r text-white"
              >
                Remove
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addKnowledgePath}
            className="bg-blue-600 hover:bg-blue-700 py-1 px-3 rounded text-sm text-white"
          >
            + Add Directory
          </button>
        </div>
      </div>
      
      {/* Knowledge Processing Info */}
      <div className="bg-gray-700 p-4 rounded text-sm">
        <h3 className="font-medium mb-2">Knowledge Processing</h3>
        <ul className="space-y-1 text-gray-300">
          <li>• Markdown files (.md) are preferred for structured knowledge</li>
          <li>• Files are processed during agent creation</li>
          <li>• Knowledge is stored in agent-specific memory</li>
          <li>• H1/H2/H3 headers are used for topic categorization</li>
          <li>• Include metadata in frontmatter for better retrieval</li>
        </ul>
      </div>
    </div>
  );
};

export default KnowledgeUploader; 