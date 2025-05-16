import React, { useState, useCallback } from 'react';
import { Copy, FileText, Star, Database, ThumbsDown, RefreshCw, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { MessageActionHandler } from '../services/message/MessageActionHandler';
import { MessageImportance, MessageReliability } from '../services/message/MessageActionService';
import { ImportanceService } from '../services/message/ImportanceService';
import { KnowledgeService } from '../services/message/KnowledgeService';
import { RegenerationService } from '../services/message/RegenerationService';
import { ExportService } from '../services/message/ExportService';
import { ReliabilityService } from '../services/message/ReliabilityService';
import { Tooltip } from './ui/tooltip';
import { Toast } from '../components/ui/toast';

interface ChatBubbleMenuProps {
  message: Message;
  isAssistantMessage: boolean;
  showVersionControls?: boolean;
  currentVersionIndex?: number;
  totalVersions?: number;
  onPreviousVersion?: () => void;
  onNextVersion?: () => void;
  onCopyText: (text: string) => void;
  onFlagUnreliable: (content: string) => Promise<void>;
  onRegenerate: (content: string) => Promise<void>;
  onFlagImportant: (content: string) => Promise<void>;
  onAddToKnowledge: (content: string) => Promise<void>;
  onExportToCoda: (content: string) => Promise<void>;
  onDeleteMessage?: (timestamp: Date) => Promise<boolean>;
  messageId?: string;
  onDeleteMemory?: () => Promise<void>;
}

interface ActionState {
  isLoading: boolean;
  error: string | null;
}

const ChatBubbleMenu: React.FC<ChatBubbleMenuProps> = ({
  message,
  isAssistantMessage,
  showVersionControls = false,
  currentVersionIndex = 0,
  totalVersions = 1,
  onPreviousVersion,
  onNextVersion,
  onCopyText,
  onFlagUnreliable,
  onRegenerate,
  onFlagImportant,
  onAddToKnowledge,
  onExportToCoda,
  onDeleteMessage,
  messageId,
  onDeleteMemory
}) => {
  // Initialize services
  const [messageActionHandler] = useState(() => new MessageActionHandler());
  const [importanceService] = useState(() => new ImportanceService({
    onImportanceChange: (messageId, importance) => {
      showToast(importance === MessageImportance.HIGH 
        ? 'Message marked as highly important' 
        : 'Message importance updated');
    }
  }));
  const [knowledgeService] = useState(() => new KnowledgeService({
    onKnowledgeAdded: () => showToast('Added to knowledge base')
  }));
  const [regenerationService] = useState(() => new RegenerationService({
    onRegenerationStarted: () => showToast('Regenerating message...'),
    onRegenerationComplete: () => showToast('Message regenerated'),
    onRegenerationError: (_, error) => showToast(`Regeneration failed: ${error}`)
  }));
  const [exportService] = useState(() => new ExportService({
    onExportComplete: (_, platform, url) => {
      showToast(`Exported to ${platform}`);
      window.open(url, '_blank');
    }
  }));
  const [reliabilityService] = useState(() => new ReliabilityService({
    onReliabilityChange: (_, reliability) => {
      showToast(reliability === MessageReliability.UNRELIABLE 
        ? 'Message marked as unreliable' 
        : 'Message reliability updated');
    }
  }));

  // Action states
  const [copyState, setCopyState] = useState<ActionState>({ isLoading: false, error: null });
  const [importanceState, setImportanceState] = useState<ActionState>({ isLoading: false, error: null });
  const [knowledgeState, setKnowledgeState] = useState<ActionState>({ isLoading: false, error: null });
  const [regenerationState, setRegenerationState] = useState<ActionState>({ isLoading: false, error: null });
  const [exportState, setExportState] = useState<ActionState>({ isLoading: false, error: null });
  const [reliabilityState, setReliabilityState] = useState<ActionState>({ isLoading: false, error: null });

  // Action handlers
  const handleCopy = useCallback(async () => {
    setCopyState({ isLoading: true, error: null });
    try {
      const result = await messageActionHandler.copyMessage({
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setCopyState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to copy'
      });
    } finally {
      setCopyState({ isLoading: false, error: null });
    }
  }, [message.content, messageActionHandler]);

  const handleFlagImportant = useCallback(async () => {
    setImportanceState({ isLoading: true, error: null });
    try {
      const result = await importanceService.flagImportance({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || '',
        importance: MessageImportance.HIGH
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setImportanceState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to flag importance'
      });
    } finally {
      setImportanceState({ isLoading: false, error: null });
    }
  }, [message, importanceService]);

  const handleAddToKnowledge = useCallback(async () => {
    setKnowledgeState({ isLoading: true, error: null });
    try {
      const result = await knowledgeService.addToKnowledge({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setKnowledgeState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add to knowledge base'
      });
    } finally {
      setKnowledgeState({ isLoading: false, error: null });
    }
  }, [message, knowledgeService]);

  const handleRegenerate = useCallback(async () => {
    setRegenerationState({ isLoading: true, error: null });
    try {
      const result = await regenerationService.regenerateMessage({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setRegenerationState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to regenerate message'
      });
    } finally {
      setRegenerationState({ isLoading: false, error: null });
    }
  }, [message, regenerationService]);

  const handleExportToCoda = useCallback(async () => {
    setExportState({ isLoading: true, error: null });
    try {
      const result = await exportService.exportToCoda({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setExportState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to export to Coda'
      });
    } finally {
      setExportState({ isLoading: false, error: null });
    }
  }, [message, exportService]);

  const handleFlagUnreliable = useCallback(async () => {
    setReliabilityState({ isLoading: true, error: null });
    try {
      const result = await reliabilityService.flagReliability({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || '',
        reliability: MessageReliability.UNRELIABLE
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setReliabilityState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to flag reliability'
      });
    } finally {
      setReliabilityState({ isLoading: false, error: null });
    }
  }, [message, reliabilityService]);

  // Toast notification
  const showToast = (message: string) => {
    Toast.show({
      message,
      type: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') 
        ? 'error' 
        : 'success',
      duration: 3000
    });
  };

  return (
    <div className="flex flex-wrap justify-center gap-1 mt-2 text-gray-400">
      <Tooltip content="Copy text">
        <button 
          onClick={handleCopy}
          className="p-1.5 rounded-full hover:bg-gray-800 hover:text-gray-200 transition-colors"
          disabled={copyState.isLoading}
        >
          {copyState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
      
      {isAssistantMessage && (
        <>
          <Tooltip content="Flag as unreliable">
            <button 
              onClick={handleFlagUnreliable}
              className="p-1.5 rounded-full hover:bg-gray-800 hover:text-red-400 transition-colors"
              disabled={reliabilityState.isLoading}
            >
              {reliabilityState.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          
          <Tooltip content="Regenerate response">
            <button 
              onClick={handleRegenerate}
              className="p-1.5 rounded-full hover:bg-gray-800 hover:text-green-400 transition-colors"
              disabled={regenerationState.isLoading}
            >
              {regenerationState.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          
          {showVersionControls && (
            <div className="flex items-center ml-2 mr-2">
              <Tooltip content="Previous version">
                <button 
                  onClick={onPreviousVersion}
                  disabled={currentVersionIndex === 0}
                  className={`p-1.5 rounded-full ${currentVersionIndex === 0 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </Tooltip>
              
              <span className="text-xs mx-1">
                {currentVersionIndex + 1}/{totalVersions}
              </span>
              
              <Tooltip content="Next version">
                <button 
                  onClick={onNextVersion}
                  disabled={currentVersionIndex === totalVersions - 1}
                  className={`p-1.5 rounded-full ${currentVersionIndex === totalVersions - 1 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          )}
        </>
      )}
      
      <Tooltip content="Flag as important">
        <button 
          onClick={handleFlagImportant}
          className="p-1.5 rounded-full hover:bg-gray-800 hover:text-yellow-400 transition-colors"
          disabled={importanceState.isLoading}
        >
          {importanceState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
      
      <Tooltip content="Add to knowledge base">
        <button 
          onClick={handleAddToKnowledge}
          className="p-1.5 rounded-full hover:bg-gray-800 hover:text-blue-400 transition-colors"
          disabled={knowledgeState.isLoading}
        >
          {knowledgeState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
      
      <Tooltip content="Export to Coda">
        <button 
          onClick={handleExportToCoda}
          className="p-1.5 rounded-full hover:bg-gray-800 hover:text-purple-400 transition-colors"
          disabled={exportState.isLoading}
        >
          {exportState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    </div>
  );
};

export default ChatBubbleMenu; 