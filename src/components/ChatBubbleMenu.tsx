import React from 'react';
import { Copy, FileText, Star, Database, ThumbsDown, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Message } from '../types';

interface ChatBubbleMenuProps {
  message: Message;
  onCopyText: (content: string) => void;
  onFlagUnreliable: (content: string) => void;
  onRegenerate: (content: string) => void;
  onFlagImportant: (content: string) => void;
  onAddToKnowledge: (content: string) => void;
  onExportToCoda: (content: string) => void;
  isAssistantMessage: boolean;
  // Version control props
  showVersionControls?: boolean;
  currentVersionIndex?: number;
  totalVersions?: number;
  onPreviousVersion?: () => void;
  onNextVersion?: () => void;
}

const ChatBubbleMenu: React.FC<ChatBubbleMenuProps> = ({
  message,
  onCopyText,
  onFlagUnreliable,
  onRegenerate,
  onFlagImportant,
  onAddToKnowledge,
  onExportToCoda,
  isAssistantMessage,
  showVersionControls = false,
  currentVersionIndex = 0,
  totalVersions = 1,
  onPreviousVersion,
  onNextVersion
}) => {
  const handleAction = (action: (content: string) => void) => {
    if (message.content) {
      action(message.content);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-1 mt-2 text-gray-400">
      <button 
        onClick={() => handleAction(onCopyText)}
        className="p-1.5 rounded-full hover:bg-gray-800 hover:text-gray-200 transition-colors"
        title="Copy text"
      >
        <Copy className="h-4 w-4" />
      </button>
      
      {/* Only show these options for AI messages, not user messages */}
      {isAssistantMessage && (
        <>
          <button 
            onClick={() => handleAction(onFlagUnreliable)}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-red-400 transition-colors"
            title="Flag as unreliable"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
          
          <button 
            onClick={() => handleAction(onRegenerate)}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-green-400 transition-colors"
            title="Regenerate response"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          {/* Version controls */}
          {showVersionControls && onPreviousVersion && onNextVersion && (
            <div className="flex items-center ml-2 mr-2">
              <button 
                onClick={onPreviousVersion}
                disabled={currentVersionIndex === 0}
                className={`p-1.5 rounded-full ${currentVersionIndex === 0 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                title="Previous version"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="text-xs mx-1">
                {currentVersionIndex + 1}/{totalVersions}
              </span>
              
              <button 
                onClick={onNextVersion}
                disabled={currentVersionIndex === totalVersions - 1}
                className={`p-1.5 rounded-full ${currentVersionIndex === totalVersions - 1 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                title="Next version"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
      
      <button 
        onClick={() => handleAction(onFlagImportant)}
        className="p-1.5 rounded-full hover:bg-gray-800 hover:text-yellow-400 transition-colors"
        title="Flag as important"
      >
        <Star className="h-4 w-4" />
      </button>
      
      <button 
        onClick={() => handleAction(onAddToKnowledge)}
        className="p-1.5 rounded-full hover:bg-gray-800 hover:text-blue-400 transition-colors"
        title="Add to knowledge base"
      >
        <Database className="h-4 w-4" />
      </button>
      
      <button 
        onClick={() => handleAction(onExportToCoda)}
        className="p-1.5 rounded-full hover:bg-gray-800 hover:text-purple-400 transition-colors"
        title="Export to Coda"
      >
        <FileText className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ChatBubbleMenu; 