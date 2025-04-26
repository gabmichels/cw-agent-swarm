import React, { FormEvent, useRef } from 'react';
import { Send, X } from 'lucide-react';

interface FileAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document' | 'text' | 'pdf' | 'other';
}

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  pendingAttachments: FileAttachment[];
  removePendingAttachment: (index: number) => void;
  handleSendMessage: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  handleFileSelect: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  setInputMessage,
  pendingAttachments,
  removePendingAttachment,
  handleSendMessage,
  isLoading,
  handleFileSelect,
  inputRef,
}) => {
  return (
    <div>
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
      <form onSubmit={handleSendMessage} className="flex items-center chat-input-area">
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
        <input
          type="text"
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={pendingAttachments.length > 0 ? "Add context about the file..." : "Type your message..."}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-l-lg py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
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
    </div>
  );
};

export default ChatInput; 