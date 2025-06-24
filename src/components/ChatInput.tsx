import React, { FormEvent, useRef, KeyboardEvent, useState, useEffect, DragEvent, useCallback } from 'react';
import { Send, X } from 'lucide-react';
import MessagePreview from './message/MessagePreview';
import WorkflowSelector from './chat/WorkflowSelector';
import { Message } from '../types';

interface FileAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document' | 'text' | 'pdf' | 'other';
}

// Define a more flexible message interface for the preview
interface MessageForPreview {
  id?: string;
  content: string;
  sender: string | { id: string; name: string; role: string };
  timestamp: Date | string | number;
  attachments?: any[];
  [key: string]: any;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  platform: 'n8n' | 'zapier';
  category: string;
  parameters: WorkflowParameter[];
  isActive: boolean;
}

interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
}

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  pendingAttachments: FileAttachment[];
  removePendingAttachment: (index: number) => void;
  handleSendMessage: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  handleFileSelect: (file: File) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  // New props for message attachment
  attachedMessage?: MessageForPreview | null;
  onRemoveAttachedMessage?: () => void;
  onNavigateToMessage?: (messageId: string) => void;
  // Workflow props
  availableWorkflows?: Workflow[];
  onWorkflowSelect?: (workflow: Workflow) => void;
  onNavigateToWorkflowsTab?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = React.memo(({
  inputMessage,
  setInputMessage,
  pendingAttachments,
  removePendingAttachment,
  handleSendMessage,
  isLoading,
  handleFileSelect,
  inputRef,
  attachedMessage,
  onRemoveAttachedMessage,
  onNavigateToMessage,
  availableWorkflows = [],
  onWorkflowSelect,
  onNavigateToWorkflowsTab,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaWrapperRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Workflow selector state
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState('');
  const [selectedWorkflowIndex, setSelectedWorkflowIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState(-1);
  const [selectorPosition, setSelectorPosition] = useState({ top: 0, left: 0 });

  // Handle clipboard paste - memoized to prevent useEffect re-runs
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!e.clipboardData) return;

    // Check for files in clipboard
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      handleFileSelect(files[0]);
      return;
    }

    // Check for images in clipboard items
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
          return;
        }
      }
    }
  }, [handleFileSelect]);

  // Handle drag and drop - memoized
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Add paste event listener
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.addEventListener('paste', handlePaste);
      return () => {
        textarea.removeEventListener('paste', handlePaste);
      };
    }
  }, [handlePaste]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle workflow selector navigation
    if (showWorkflowSelector) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedWorkflowIndex(prev => 
          prev < availableWorkflows.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedWorkflowIndex(prev => 
          prev > 0 ? prev - 1 : availableWorkflows.length - 1
        );
        return;
      }
      if (e.key === 'Enter' && availableWorkflows.length > 0) {
        e.preventDefault();
        const selectedWorkflow = availableWorkflows[selectedWorkflowIndex];
        if (selectedWorkflow && onWorkflowSelect) {
          onWorkflowSelect(selectedWorkflow);
          // Replace @ mention with workflow name
          const beforeMention = inputMessage.substring(0, mentionStartPosition);
          const afterMention = inputMessage.substring(inputRef.current?.selectionStart || 0);
          setInputMessage(`${beforeMention}@${selectedWorkflow.name} ${afterMention}`);
          setShowWorkflowSelector(false);
          setWorkflowSearchQuery('');
          setMentionStartPosition(-1);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowWorkflowSelector(false);
        setWorkflowSearchQuery('');
        setMentionStartPosition(-1);
        return;
      }
    }

    // Submit on ENTER without SHIFT key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Submit the form if we have content
      if (inputMessage.trim() || pendingAttachments.length > 0 || attachedMessage) {
        const form = e.currentTarget.form;
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  }, [inputMessage, pendingAttachments.length, attachedMessage, showWorkflowSelector, availableWorkflows, selectedWorkflowIndex, mentionStartPosition, onWorkflowSelect]);

  // Auto-resize textarea based on content height - your original implementation
  useEffect(() => {
    if (inputRef.current) {
      // Reset height to default single line height
      inputRef.current.style.height = 'auto';
      
      // Calculate required height (with maximum)
      const scrollHeight = inputRef.current.scrollHeight;
      const maxHeight = 150;
      
      // Only expand if content exists and exceeds single line
      const newHeight = isFocused && inputMessage.length > 0 && scrollHeight > 40 
        ? Math.min(scrollHeight, maxHeight) 
        : 40;
      
      inputRef.current.style.height = `${newHeight}px`;
    }
  }, [inputMessage, inputRef, isFocused]);

  // Handle @ mention detection and workflow search
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setInputMessage(value);
    
    // Check for @ mention
    const lastAtIndex = value.lastIndexOf('@', cursorPosition - 1);
    
    if (lastAtIndex !== -1) {
      // Check if there's a space before @ (or it's at the start)
      const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' ';
      const isValidMention = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0;
      
      if (isValidMention) {
        // Extract search query after @
        const afterAt = value.substring(lastAtIndex + 1, cursorPosition);
        const spaceIndex = afterAt.indexOf(' ');
        const searchQuery = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
        
        // Debug logging
        console.log('Workflow selector:', {
          searchQuery,
          availableWorkflows: availableWorkflows.length,
          showSelector: spaceIndex === -1,
          workflows: availableWorkflows.map(w => w.name)
        });
        
        // Only show selector if we're still typing the mention (no space after)
        if (spaceIndex === -1) {
          setWorkflowSearchQuery(searchQuery);
          setMentionStartPosition(lastAtIndex);
          setSelectedWorkflowIndex(0);
          setShowWorkflowSelector(true);
          
          // Calculate selector position
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setSelectorPosition({
              top: rect.top,
              left: rect.left
            });
          }
        } else {
          setShowWorkflowSelector(false);
        }
      } else {
        setShowWorkflowSelector(false);
      }
    } else {
      setShowWorkflowSelector(false);
    }
  }, [setInputMessage, availableWorkflows]);

  // Handle workflow selection
  const handleWorkflowSelect = useCallback((workflow: Workflow) => {
    if (onWorkflowSelect) {
      onWorkflowSelect(workflow);
    }
    
    // Replace @ mention with workflow name
    const beforeMention = inputMessage.substring(0, mentionStartPosition);
    const afterMention = inputMessage.substring(inputRef.current?.selectionStart || 0);
    setInputMessage(`${beforeMention}@${workflow.name} ${afterMention}`);
    setShowWorkflowSelector(false);
    setWorkflowSearchQuery('');
    setMentionStartPosition(-1);
    
    // Focus back to textarea
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [inputMessage, mentionStartPosition, onWorkflowSelect, setInputMessage]);

  // Handle navigate to workflows tab
  const handleNavigateToWorkflowsTab = useCallback(() => {
    if (onNavigateToWorkflowsTab) {
      onNavigateToWorkflowsTab();
    }
    setShowWorkflowSelector(false);
  }, [onNavigateToWorkflowsTab]);

  // Handle message navigation
  const handleNavigateToMessage = useCallback(() => {
    if (attachedMessage?.id && onNavigateToMessage) {
      onNavigateToMessage(attachedMessage.id);
    }
  }, [attachedMessage?.id, onNavigateToMessage]);

  return (
    <div>
      {/* Message attachment preview */}
      {attachedMessage && onRemoveAttachedMessage && (
        <div className="mb-3">
          <MessagePreview
            message={{
              ...attachedMessage,
              id: attachedMessage.id || '',
              timestamp: attachedMessage.timestamp instanceof Date 
                ? attachedMessage.timestamp 
                : new Date(attachedMessage.timestamp)
            } as Message}
            onRemove={onRemoveAttachedMessage}
            onClick={handleNavigateToMessage}
          />
        </div>
      )}

      {/* File attachment previews */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pendingAttachments.map((attachment, index) => (
            <div key={index} className="relative bg-gray-800 rounded p-2 flex items-center" style={{ maxWidth: '200px' }}>
              {attachment.type === 'image' && (
                <div className="relative w-12 h-12 mr-2">
                  <img 
                    src={attachment.preview} 
                    alt="attachment preview" 
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              )}
              {attachment.type === 'pdf' && (
                <div className="bg-red-700 text-white rounded p-1 mr-2 text-xs">PDF</div>
              )}
              {attachment.type === 'document' && (
                <div className="bg-blue-700 text-white rounded p-1 mr-2 text-xs">DOC</div>
              )}
              {attachment.type === 'text' && (
                <div className="bg-gray-700 text-white rounded p-1 mr-2 text-xs">TXT</div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{attachment.file.name}</div>
                <div className="text-xs text-gray-400">
                  {(attachment.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              
              <button 
                onClick={() => removePendingAttachment(index)}
                className="ml-1 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Message input form */}
      <form 
        ref={formRef}
        onSubmit={handleSendMessage} 
        className="flex items-center chat-input-area !pb-0"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="hidden-file-input"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelect(e.target.files[0]);
              // Reset the input
              e.target.value = '';
            }
          }}
          accept=".txt,.pdf,.docx,.md,.csv,.jpg,.jpeg,.png,.gif"
        />
        <button
          type="button"
          onClick={() => document.getElementById('hidden-file-input')?.click()}
          className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
          title="Attach file"
          disabled={isLoading}
        >
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
        </button>
        <div 
          ref={textareaWrapperRef} 
          className={`flex-1 relative ${isDragging ? 'bg-gray-600 border-2 border-dashed border-blue-500' : ''}`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-10 pointer-events-none">
              <div className="text-white text-sm">Drop files here</div>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              attachedMessage 
                ? "Reply to the attached message..." 
                : pendingAttachments.length > 0 
                  ? "Add context about the file..." 
                  : "Type your message..."
            }
            className="w-full bg-gray-700 border border-gray-600 rounded-l-lg py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all duration-200"
            disabled={isLoading}
            rows={1}
            style={{ 
              minHeight: '40px', 
              maxHeight: '150px',
              height: isFocused ? 'auto' : '40px',
              overflow: isFocused ? 'auto' : 'hidden',
              textOverflow: isFocused ? 'clip' : 'ellipsis',
              whiteSpace: isFocused ? 'pre-wrap' : 'nowrap'
            }}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 rounded-r-lg py-2 px-4 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>

      {/* Debug Indicator */}
      {showWorkflowSelector && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-2 py-1 rounded z-[10000] text-sm">
          Workflow Selector Active: {workflowSearchQuery}
        </div>
      )}

      {/* Workflow Selector */}
      <WorkflowSelector
        isOpen={showWorkflowSelector}
        searchQuery={workflowSearchQuery}
        workflows={availableWorkflows}
        selectedIndex={selectedWorkflowIndex}
        onSelect={handleWorkflowSelect}
        onClose={() => setShowWorkflowSelector(false)}
        onNavigateToWorkflowsTab={handleNavigateToWorkflowsTab}
        position={selectorPosition}
      />
    </div>
  );
});

export default ChatInput; 
