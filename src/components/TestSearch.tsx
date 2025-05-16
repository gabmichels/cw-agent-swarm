import React, { useState, useEffect } from 'react';
import { Message } from '../types';
import { MessageType } from '../constants/message';
import { Search } from 'lucide-react';

// Mock data for testing
const mockMessages: Message[] = [
  {
    sender: {
      id: '1',
      name: 'Chloe',
      role: 'assistant'
    },
    content: 'Hello! I can help you with your questions.',
    timestamp: new Date(),
    messageType: MessageType.AGENT,
  },
  {
    sender: {
      id: '2',
      name: 'User',
      role: 'user'
    },
    content: 'I need help with search functionality.',
    timestamp: new Date(),
    messageType: MessageType.USER,
  },
  {
    sender: {
      id: '1',
      name: 'Chloe',
      role: 'assistant'
    },
    content: 'We can implement fuzzy search that handles misspellings.',
    timestamp: new Date(),
    messageType: MessageType.AGENT,
  },
  {
    sender: {
      id: '2',
      name: 'User',
      role: 'user'
    },
    content: 'How does the smart search work?',
    timestamp: new Date(),
    messageType: MessageType.USER,
  },
];

const TestSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>(mockMessages);

  // Update filtered messages when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMessages(mockMessages);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = mockMessages.filter(message => 
      message.content.toLowerCase().includes(query)
    );
    
    console.log(`Test search: "${query}" found ${results.length} matches`);
    setFilteredMessages(results);
  }, [searchQuery]);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">Search Test Component</h1>
      
      {/* Search input */}
      <div className="mb-4 flex">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 text-white rounded p-2 pl-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        <button 
          onClick={() => setSearchQuery('')}
          className="ml-2 bg-gray-700 px-3 py-2 rounded"
        >
          Clear
        </button>
      </div>
      
      {/* Search stats */}
      <div className="mb-4 text-sm">
        {searchQuery ? (
          <p className="bg-blue-800 p-2 rounded">
            Showing {filteredMessages.length} results for "{searchQuery}"
          </p>
        ) : (
          <p className="bg-gray-800 p-2 rounded">
            Showing all {mockMessages.length} messages
          </p>
        )}
      </div>
      
      {/* Message list */}
      <div className="space-y-4">
        {filteredMessages.map((message, index) => (
          <div 
            key={index}
            className={`p-3 rounded-lg ${
              message.sender.role === 'user' 
                ? 'bg-blue-700 ml-12' 
                : 'bg-gray-800 mr-12'
            }`}
          >
            <div className="font-bold text-sm mb-1">{message.sender.name}</div>
            <div>
              {highlightSearchMatches(message.content, searchQuery)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple highlight function
function highlightSearchMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-yellow-300 text-black px-1 rounded">{part}</mark>
          : part
      )}
    </>
  );
}

export default TestSearch; 