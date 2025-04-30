import React, { useState } from 'react';

interface Citation {
  uri: string;
  title?: string;
  snippet?: string;
}

interface SearchResult {
  query: string;
  result: string;
  citations: Citation[];
  type: string;
  timestamp: string;
}

const AdvancedSearchTool: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('standard');
  const [isDetailed, setIsDetailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await fetch('/api/search/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          type: searchType,
          detailedResults: isDetailed,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform search');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Advanced Web Search</h2>
      <p className="text-sm text-gray-400 mb-4">
        Uses OpenAI's GPT-4o search-enabled model for high-quality search results with citations.
        Use for research, fact-checking, or when standard search methods don't yield satisfactory results.
      </p>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Search Query</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your search query"
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
          disabled={isLoading}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Search Type</label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
            disabled={isLoading}
          >
            <option value="standard">Standard Search</option>
            <option value="research">Comprehensive Research</option>
            <option value="factCheck">Fact Checking</option>
            <option value="currentInfo">Current Information</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="detailed-results"
            checked={isDetailed}
            onChange={(e) => setIsDetailed(e.target.checked)}
            className="mr-2"
            disabled={isLoading}
          />
          <label htmlFor="detailed-results" className="text-sm font-medium">
            Detailed Results
          </label>
        </div>
      </div>
      
      <button
        onClick={handleSearch}
        disabled={isLoading || !query.trim()}
        className={`w-full p-2 rounded ${
          isLoading || !query.trim()
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading ? 'Searching...' : 'Search with GPT-4o'}
      </button>
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200">
          {error}
        </div>
      )}
      
      {result && (
        <div className="mt-6">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-lg font-medium">Search Results</h3>
            <span className="text-xs text-gray-400">
              {new Date(result.timestamp).toLocaleString()}
            </span>
          </div>
          
          <div className="mb-4 p-4 bg-gray-700 rounded whitespace-pre-wrap">
            {result.result}
          </div>
          
          {result.citations.length > 0 && (
            <div>
              <h4 className="text-md font-medium mb-2">Citations</h4>
              <ul className="space-y-2">
                {result.citations.map((citation, index) => (
                  <li key={index} className="p-2 bg-gray-700/50 rounded">
                    <a
                      href={citation.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline block mb-1 break-all"
                    >
                      {citation.title || citation.uri}
                    </a>
                    {citation.snippet && (
                      <p className="text-sm text-gray-300">{citation.snippet}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchTool; 