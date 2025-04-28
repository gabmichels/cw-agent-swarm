import React, { useState, useEffect } from 'react';

// Mock message interface for the component
interface Message {
  sender: string;
  content: string;
}

interface KnowledgeGap {
  id: string;
  topic: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  resolved: boolean;
}

interface KnowledgeGapDetectorProps {
  onGapsDetected?: (gaps: KnowledgeGap[]) => void;
  autoAnalyze?: boolean;
  messageThreshold?: number;
  // Optional prop to pass messages directly for testing
  messages?: Message[];
}

const KnowledgeGapDetector: React.FC<KnowledgeGapDetectorProps> = ({
  onGapsDetected,
  autoAnalyze = true,
  messageThreshold = 5,
  messages = [],
}) => {
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(0);

  // Analyze conversation when messages change
  useEffect(() => {
    if (!autoAnalyze) return;
    
    // Only analyze if we have enough new messages
    if (messages.length >= messageThreshold && 
        messages.length - lastAnalyzedCount >= 3) {
      analyzeConversation();
    }
  }, [messages, autoAnalyze, messageThreshold, lastAnalyzedCount]);

  const analyzeConversation = async () => {
    if (isAnalyzing || messages.length < messageThreshold) return;
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/knowledge/detect-gaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.sender === 'You' ? 'user' : 'assistant',
            content: msg.content,
          })),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze conversation');
      }
      
      const data = await response.json();
      
      if (data.gapsDetected && data.gaps?.length > 0) {
        setKnowledgeGaps(prevGaps => {
          // Merge with existing gaps, avoid duplicates
          const existingIds = new Set(prevGaps.map(g => g.id));
          const newGaps = data.gaps.filter((g: KnowledgeGap) => !existingIds.has(g.id));
          const mergedGaps = [...prevGaps, ...newGaps];
          
          // Notify parent component if callback provided
          if (onGapsDetected && newGaps.length > 0) {
            onGapsDetected(newGaps);
          }
          
          return mergedGaps;
        });
      }
      
      // Update last analyzed message count
      setLastAnalyzedCount(messages.length);
      
    } catch (err) {
      console.error('Error analyzing conversation for knowledge gaps:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderGaps = () => {
    if (knowledgeGaps.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">Knowledge Gaps Detected</h3>
        <div className="space-y-2">
          {knowledgeGaps.map(gap => (
            <div
              key={gap.id}
              className={`p-3 rounded border ${
                gap.priority === 'high'
                  ? 'bg-red-900/30 border-red-800'
                  : gap.priority === 'medium'
                  ? 'bg-yellow-900/30 border-yellow-800'
                  : 'bg-blue-900/30 border-blue-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-medium">{gap.topic}</h4>
                <span className="text-xs px-2 py-1 rounded bg-gray-800">
                  {gap.priority} priority
                </span>
              </div>
              <p className="text-sm mt-1 text-gray-300">{gap.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {!autoAnalyze && (
        <button
          onClick={analyzeConversation}
          disabled={isAnalyzing || messages.length < messageThreshold}
          className={`w-full p-2 my-2 rounded ${
            isAnalyzing || messages.length < messageThreshold
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Conversation for Knowledge Gaps'}
        </button>
      )}
      
      {error && (
        <div className="p-3 my-2 bg-red-900/50 border border-red-800 rounded text-sm">
          {error}
        </div>
      )}
      
      {renderGaps()}
    </div>
  );
};

export default KnowledgeGapDetector; 