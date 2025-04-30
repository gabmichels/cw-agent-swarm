import React, { useState, useEffect, useMemo } from 'react';
import { SocialMediaItem } from '../types';

const SocialMediaTable: React.FC = () => {
  const [socialData, setSocialData] = useState<SocialMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState('all');
  const [source, setSource] = useState('');
  const [topic, setTopic] = useState('');
  
  // Fetch social media data when filters change
  useEffect(() => {
    const fetchSocialMediaData = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (searchTerm) queryParams.set('query', searchTerm);
        if (timeframe) queryParams.set('timeframe', timeframe);
        if (source) queryParams.set('source', source);
        if (topic) queryParams.set('topic', topic);
        
        const response = await fetch(`/api/social-media-data?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch social media data');
        }
        
        const result = await response.json();
        if (result.success) {
          setSocialData(result.data);
        } else {
          console.error('Error fetching social media data:', result.error);
        }
      } catch (error) {
        console.error('Error fetching social media data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSocialMediaData();
  }, [searchTerm, timeframe, source, topic]);
  
  // Generate unique list of topics from data
  const topics = useMemo(() => {
    const uniqueTopics = Array.from(new Set(socialData.map(item => item.topic)));
    return uniqueTopics;
  }, [socialData]);
  
  // Generate unique list of sources from data
  const sources = useMemo(() => {
    const uniqueSources = Array.from(new Set(socialData.map(item => item.source)));
    return uniqueSources;
  }, [socialData]);
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Social Media Data</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search input */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search content..."
          className="bg-gray-700 border border-gray-600 rounded py-1 px-2 text-sm"
        />
        
        {/* Timeframe filter */}
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded py-1 px-2 text-sm"
        >
          <option value="all">All Time</option>
          <option value="day">Last 24 Hours</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
        
        {/* Source filter */}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded py-1 px-2 text-sm"
        >
          <option value="">All Sources</option>
          {sources.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>
        
        {/* Topic filter */}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded py-1 px-2 text-sm"
        >
          <option value="">All Topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : socialData.length === 0 ? (
        <p className="text-gray-400">No social media data found. Try running a market scan first.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Topic</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Content</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Author</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {socialData.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {item.source}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {item.topic}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="max-w-md truncate">
                      {item.text}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:text-blue-300">
                          Link
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {item.author}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.sentiment === 'positive' ? 'bg-green-100 text-green-800' : 
                      item.sentiment === 'negative' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.sentiment || 'neutral'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SocialMediaTable; 