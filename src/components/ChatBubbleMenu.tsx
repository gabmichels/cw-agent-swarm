import React from 'react';
import { Copy, FileText, Star, Database, ThumbsDown, RefreshCw } from 'lucide-react';
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
}

const ChatBubbleMenu: React.FC<ChatBubbleMenuProps> = ({
  message,
  onCopyText,
  onFlagUnreliable,
  onRegenerate,
  onFlagImportant,
  onAddToKnowledge,
  onExportToCoda,
  isAssistantMessage
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