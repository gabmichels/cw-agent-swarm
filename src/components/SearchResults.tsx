import React, { useState } from 'react';
import { Message } from '../types';
import { Search, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface SearchResultsProps {
  results: Message[];
  onSelectResult: (messageId: string) => void;
  onClose: () => void;
  initialLimit?: number;
  searchQuery?: string;
}

// Extract context around search term
const extractContext = (content: string, searchTerm: string, contextLength: number = 30): string => {
  if (!content || !searchTerm) return '';
  
  // Find the match position
  const lowerContent = content.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerTerm);
  
  if (matchIndex === -1) return content.substring(0, Math.min(60, content.length)) + '...';
  
  // Extract text before and after the match
  const startIndex = Math.max(0, matchIndex - contextLength);
  const endIndex = Math.min(content.length, matchIndex + searchTerm.length + contextLength);
  
  // Add ellipsis if we're not at the beginning or end
  const prefix = startIndex > 0 ? '...' : '';
  const suffix = endIndex < content.length ? '...' : '';
  
  return prefix + content.substring(startIndex, endIndex) + suffix;
};

// Highlight search term in text
const highlightTerm = (text: string, searchTerm: string): JSX.Element => {
  if (!searchTerm) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === searchTerm.toLowerCase() 
          ? <mark key={i} className="bg-yellow-500 text-black px-0.5 rounded">{part}</mark>
          : part
      )}
    </>
  );
};

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onSelectResult,
  onClose,
  initialLimit = 10,
  searchQuery = ""
}) => {
  const [limit, setLimit] = useState(initialLimit);
  
  // No results state
  if (results.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-1 w-96 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
        <div className="flex justify-between items-center px-3 py-2 border-b border-gray-700">
          <div className="flex items-center">
            <Search className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-300">No results for "{searchQuery}"</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 text-center text-gray-400 text-sm">
          No messages match your search term.
        </div>
      </div>
    );
  }

  // Display results
  return (
    <div className="absolute right-0 top-full mt-1 w-96 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-[70vh] flex flex-col">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
        <div className="flex items-center">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm font-medium text-gray-300">{results.length} results for "{searchQuery}"</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {results.slice(0, limit).map((message, index) => {
          const context = extractContext(message.content, searchQuery);
          const timestamp = message.timestamp instanceof Date 
            ? message.timestamp 
            : new Date(message.timestamp);
          
          return (
            <button
              key={message.id || index}
              className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 focus:outline-none focus:bg-gray-700"
              onClick={() => onSelectResult(message.id || '')}
            >
              <div className="flex items-start">
                <div className="flex-grow">
                  <div className="text-sm text-gray-300 truncate mb-1">
                    {highlightTerm(context, searchQuery)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(timestamp, 'MMM d, yyyy • h:mm a')} • {message.sender}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {limit < results.length && (
        <div className="p-2 border-t border-gray-700 sticky bottom-0 bg-gray-800">
          <button 
            className="w-full flex items-center justify-center py-2 text-sm text-blue-400 hover:text-blue-300 focus:outline-none"
            onClick={() => setLimit(prev => prev + initialLimit)}
          >
            Load more <ChevronDown className="ml-1 h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults; 