'use client';

import React, { useState, FormEvent, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, Send, Menu, X, PlayIcon, PauseIcon } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import Image from 'next/image';
import { MenuIcon, PinIcon, MinimizeIcon, MaximizeIcon } from 'lucide-react';
import FilesTable from '../components/FilesTable';
import FileUploadButton from '../components/FileUploadButton';

// Define message type for better type safety
interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  memory?: string[];
  thoughts?: string[];
}

// Define interface for file attachment
interface FileAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document' | 'text' | 'pdf' | 'other';
}

// Define interface for memory item
interface MemoryItem {
  id?: string;
  timestamp?: string;
  created?: string;
  content?: string;
  category?: string;
  importance?: number;
  tags?: string[];
}

// Define interfaces for Task and ScheduledTask
interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  date?: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// Define interface for social media data
interface SocialMediaItem {
  id: string;
  text: string;
  timestamp: string;
  source: string;
  topic: string;
  author: string;
  url: string | null;
  engagement: Record<string, any>;
  sentiment: string | null;
}

// Add a new MemoryTable component right after the imports section
// This will create a filterable table to display memory contents
const MemoryTable = ({ memories }: { memories: MemoryItem[] }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof MemoryItem>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
  };

  const handleTagChange = (tag: string) => {
    setTagFilter(tag);
  };

  const handleSort = (field: keyof MemoryItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter memories based on search, category, and tags
  const filteredMemories = memories.filter((memory) => {
    const matchesSearch = search === '' || 
      (memory.content && memory.content.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter === '' || 
      (memory.category && memory.category === categoryFilter);
    
    const matchesTag = tagFilter === '' || 
      (memory.tags && memory.tags.includes(tagFilter));
    
    return matchesSearch && matchesCategory && matchesTag;
  });

  // Sort memories based on sortField and sortOrder
  const sortedMemories = [...filteredMemories].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    
    if (fieldA === undefined && fieldB === undefined) return 0;
    if (fieldA === undefined) return sortOrder === 'asc' ? 1 : -1;
    if (fieldB === undefined) return sortOrder === 'asc' ? -1 : 1;
    
    if (typeof fieldA === 'string' && typeof fieldB === 'string') {
      return sortOrder === 'asc' 
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    }
    
    if (typeof fieldA === 'number' && typeof fieldB === 'number') {
      return sortOrder === 'asc' 
        ? fieldA - fieldB
        : fieldB - fieldA;
    }
    
    return 0;
  });

  // Get unique categories for filtering
  const categories = Array.from(new Set(memories
    .map(m => m.category)
    .filter(Boolean) as string[]
  ));

  // Get unique tags for filtering
  const tags = Array.from(new Set(
    memories.flatMap(m => m.tags || [])
  ));

  return (
    <div className="overflow-auto">
      <div className="flex space-x-2 mb-2">
        <input
          type="text"
          placeholder="Search memories..."
          value={search}
          onChange={handleSearch}
          className="border p-1 rounded"
        />
        <select 
          value={categoryFilter} 
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="">All Categories</option>
          {categories.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>
        <select 
          value={tagFilter} 
          onChange={(e) => handleTagChange(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="">All Tags</option>
          {tags.map((tag, tagIdx) => (
            <option key={tagIdx} value={tag}>{tag}</option>
          ))}
        </select>
      </div>
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th onClick={() => handleSort('timestamp')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Timestamp {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('content')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Content {sortField === 'content' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('category')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('importance')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Importance {sortField === 'importance' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tags
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedMemories.length > 0 ? (
            sortedMemories.map((memory, index) => (
              <tr key={memory.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.timestamp || memory.created || 'Unknown date'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {memory.content || 'No content'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.category || 'Uncategorized'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.importance !== undefined ? memory.importance : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.tags && memory.tags.length > 0 
                    ? memory.tags.join(', ') 
                    : 'No tags'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                No memories found matching the current filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// Function to convert cron expressions to human-readable format
const formatCronExpression = (cronExp: string): string => {
  try {
    const parts = cronExp.split(' ');
    if (parts.length !== 5) return cronExp; // Invalid format
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Helper to format time in 12-hour format
    const formatTime = (h: number, m: number): string => {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      const minuteStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
      return `${hour12}${minuteStr} ${period}`;
    };
    
    // Special case for market-scanner: "0 7,15 * * *" (twice daily at 7am and 3pm)
    if (minute === '0' && hour === '7,15' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return 'Twice daily at 7 AM and 3 PM';
    }
    
    // For simple expressions
    if (dayOfMonth === '*' && month === '*') {
      if (dayOfWeek === '*') {
        // Every day at specific time
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Daily at ${formatTime(parseInt(hour), 0)}`;
        }
        // Every day at multiple times
        if (minute === '0' && hour.includes(',')) {
          const times = hour.split(',').map(h => formatTime(parseInt(h), 0)).join(' and ');
          return `Daily at ${times}`;
        }
      } else if (dayOfWeek.match(/^\d+$/)) {
        // Specific day of week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Every ${days[parseInt(dayOfWeek)]} at ${formatTime(parseInt(hour), 0)}`;
        }
      } else if (dayOfWeek.includes(',')) {
        // Multiple days
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)]).join(' & ');
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Every ${dayNames} at ${formatTime(parseInt(hour), 0)}`;
        }
      }
    }
    
    // Fallback for complex expressions - more readable than raw cron
    let readable = 'At ';
    
    // Minute
    if (minute === '0') {
      // Don't display minutes for on-the-hour times
    } else if (minute === '*') {
      readable += 'every minute ';
    } else {
      readable += `minute ${minute} `;
    }
    
    // Hour
    if (hour === '*') {
      readable += 'of every hour ';
    } else if (hour.includes(',')) {
      const hours = hour.split(',').map(h => formatTime(parseInt(h), 0)).join(' and ');
      readable += `${hours} `;
            } else {
      readable += `${formatTime(parseInt(hour), parseInt(minute))} `;
    }
    
    // Day of week
    if (dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dayOfWeek.includes(',')) {
        const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)]).join(' and ');
        readable += `on ${dayNames} `;
      } else if (dayOfWeek.includes('-')) {
        const [start, end] = dayOfWeek.split('-').map(d => parseInt(d));
        readable += `from ${days[start]} to ${days[end]} `;
          } else {
        readable += `on ${days[parseInt(dayOfWeek)]} `;
      }
    } else if (dayOfMonth !== '*') {
      // Day of month
      if (dayOfMonth.includes(',')) {
        const dates = dayOfMonth.split(',').join(', ');
        readable += `on the ${dates} of the month `;
      } else {
        readable += `on the ${dayOfMonth} of the month `;
      }
    } else {
      readable += 'every day ';
    }
    
    return readable.trim();
  } catch (error) {
    console.error('Error formatting cron expression:', error);
    return cronExp;
  }
};

// Add a SocialMediaTable component right after the MemoryTable component
const SocialMediaTable = () => {
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

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('Chloe');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [chloeCheckResults, setChloeCheckResults] = useState<any>(null);
  const [fixInstructions, setFixInstructions] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [memoryViewMode, setMemoryViewMode] = useState('context');
  const [allMemories, setAllMemories] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isSocialDataLoading, setIsSocialDataLoading] = useState(false);
  
  // Toggle functions for new UI features
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // Toggle sidebar pin state
  const toggleSidebarPin = () => setIsSidebarPinned(!isSidebarPinned);
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  
  // Toggle department dropdown
  const toggleDeptDropdown = () => {
    setIsDeptDropdownOpen(!isDeptDropdownOpen);
    setIsAgentDropdownOpen(false);
  };
  
  // Toggle agent dropdown
  const toggleAgentDropdown = () => {
    setIsAgentDropdownOpen(!isAgentDropdownOpen);
    setIsDeptDropdownOpen(false);
  };
  
  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsDeptDropdownOpen(false);
      setIsAgentDropdownOpen(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  // Available departments
  const departments = ['Marketing', 'HR', 'Finance', 'Sales'];
  
  // Available agents per department
  const agentsByDepartment = {
    Marketing: ['Chloe'],
    HR: ['Emma (Soon)'],
    Finance: ['Alex (Soon)'],
    Sales: ['Sam (Soon)']
  };
  
  // Handle department change
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setIsDeptDropdownOpen(false);
    
    // Select first agent from new department
    const availableAgents = agentsByDepartment[dept as keyof typeof agentsByDepartment] || [];
    if (availableAgents.length > 0 && !availableAgents[0].includes('Soon')) {
      setSelectedAgent(availableAgents[0]);
    }
  };
  
  // Handle agent change
  const handleAgentChange = (agent: string) => {
    if (!agent.includes('Soon')) {
      setSelectedAgent(agent);
    }
    setIsAgentDropdownOpen(false);
  };

  // Load initial chat history from the server
  useEffect(() => {
    async function loadInitialChat() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/chat?userId=default-user');
        
        if (!response.ok) {
          throw new Error(`Failed to load chat history: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
          // Convert server messages to our client format
          const formattedMessages = data.history.map((msg: any) => ({
            sender: msg.role === 'user' ? 'You' : selectedAgent,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            memory: msg.memory || [],
            thoughts: msg.thoughts || []
          }));
          
          setMessages(formattedMessages);
        } else {
          // Fallback to default welcome message if no history
          setMessages([{
            sender: selectedAgent,
            content: `Hello! I'm ${selectedAgent}, your marketing expert. How can I help you today?`,
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error("Error loading initial chat:", error);
        // Set a basic welcome message on error
        setMessages([{
          sender: selectedAgent,
          content: `Hello! I'm ${selectedAgent}. There was an error loading our previous conversation.`,
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadInitialChat();
  }, [selectedAgent]);

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field when component mounts or after sending message
  useEffect(() => {
    // Focus the input field with a slight delay to ensure DOM has updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        console.log('Input auto-focused by useEffect');
      }
    }, 100);
  }, [messages]);

  // Add a separate useEffect for initial focus
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      console.log('Input focused on mount');
    }
  }, []);

  // Handle file selection for preview
  const handleFileSelect = async (file: File) => {
    try {
      // Determine file type for appropriate handling
      let fileType: FileAttachment['type'] = 'other';
      let preview = '';
      
      if (file.type.startsWith('image/')) {
        fileType = 'image';
        preview = URL.createObjectURL(file);
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
        preview = URL.createObjectURL(file);
      } else if (file.type.includes('document') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        fileType = 'document';
      } else if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        fileType = 'text';
        // For text files, we can read and preview the content
        const text = await file.text();
        preview = text.substring(0, 150) + (text.length > 150 ? '...' : '');
      }
      
      // Add to pending attachments
      setPendingAttachments(prev => [...prev, {
        file,
        preview,
        type: fileType
      }]);

      // Focus the input field for user to add context
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Error processing file:', error);
      handleFileUploadError('Failed to process file for preview');
    }
  };
  
  // Remove a pending attachment
  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const updated = [...prev];
      // Revoke the object URL if it's an image to prevent memory leaks
      if (updated[index].preview && updated[index].type === 'image') {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Handle clipboard paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Check if the input is focused
      if (document.activeElement !== inputRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      let foundImage = false;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // If it's an image, create a File and add it to pending attachments
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault(); // Prevent the default paste behavior
            // Generate a unique name for the pasted image
            const timestamp = new Date().getTime();
            const modifiedFile = new File([file], `pasted-image-${timestamp}.png`, { type: file.type });
            handleFileSelect(modifiedFile);
            foundImage = true;
          }
        }
      }
      
      // If we found and processed an image, stop here
      if (foundImage) {
        console.log('Image pasted from clipboard and added to pending attachments');
      }
    };
    
    // Add the paste event listener to the document
    document.addEventListener('paste', handlePaste as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener('paste', handlePaste as EventListener);
    };
  }, []);
  
  // Handle drag and drop on the input area
  useEffect(() => {
    const handleDrop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      const dragEvent = e as DragEvent;
      if (dragEvent.dataTransfer?.files) {
        const files = Array.from(dragEvent.dataTransfer.files);
        files.forEach(file => handleFileSelect(file));
      }
    };
    
    const handleDragOver = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
      inputArea.addEventListener('drop', handleDrop);
      inputArea.addEventListener('dragover', handleDragOver);
    }
    
    return () => {
      if (inputArea) {
        inputArea.removeEventListener('drop', handleDrop);
        inputArea.removeEventListener('dragover', handleDragOver);
      }
    };
  }, []);

  // Handle file upload completion
  const handleFileUploadComplete = async (result: any) => {
    // Create a system message about the file
    const fileMessage: Message = {
      sender: 'System',
      content: `📁 File uploaded: ${result.filename}\n${result.summary ? `\nSummary: ${result.summary}` : ''}\n\nThe file has been processed and added to memory. You can reference it in your conversation or view it in the Files tab.`,
        timestamp: new Date()
      };
      
    // Add to messages
    setMessages(prevMessages => [...prevMessages, fileMessage]);
    
    // Refresh the Files list
    if (selectedTab === 'files') {
      fetchAllMemories();
    }
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Test Chloe agent directly
  const testChloeAgent = async () => {
    console.log("Testing Chloe agent connection...");
    setIsLoading(true);
    
    try {
      // Call chat API with a test message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "TEST_CONNECTION: Check if Chloe agent is working",
          userId: 'debug-user',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show debug message
      const debugMessage: Message = {
        sender: 'Debug',
        content: `Agent Status: ${data.reply.includes('SIMULATED') ? '❌ Using simulated response' : '✅ Real agent connected'}\n\nResponse: ${data.reply}`,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      setMessages(prev => [...prev, debugMessage]);
      
      // Log details
      console.log("Chloe agent test response:", data);
    } catch (error) {
      console.error("Error testing Chloe agent:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Debug',
        content: `Failed to test Chloe agent: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debug function to examine Chloe's memory
  const inspectChloeMemory = async () => {
    console.log("Inspecting Chloe's memory...");
    setIsLoading(true);
    
    try {
      // Call chat API with a special command to inspect memory
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "DEBUG_COMMAND: What memories do you have about our conversation so far?",
          userId: 'debug-user',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show memory inspection results
      const memoryMessage: Message = {
        sender: 'Debug',
        content: `Memory Inspection: ${data.reply}`,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      setMessages(prev => [...prev, memoryMessage]);
      
      // Log details
      console.log("Chloe memory inspection:", data);
    } catch (error) {
      console.error("Error inspecting Chloe memory:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Debug',
        content: `Failed to inspect Chloe memory: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Run diagnostics to check why Chloe isn't loading
  const runDiagnostics = async () => {
    console.log("Running system diagnostics...");
    setIsLoading(true);
    
    try {
      // Call diagnostics API
      const response = await fetch('/api/diagnostics');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setDiagnosticResults(data);
      
      // Show diagnostic results
      const diagnosticMessage: Message = {
        sender: 'Diagnostics',
        content: `System Diagnostics Results:
        
${formatDiagnosticSummary(data)}

Check the Debug panel for full details.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, diagnosticMessage]);
      
      // Log details
      console.log("Diagnostics results:", data);
    } catch (error) {
      console.error("Error running diagnostics:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to run diagnostics: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format diagnostic results for display
  const formatDiagnosticSummary = (data: any): string => {
    if (!data || !data.diagnostics) {
      return "No diagnostic data available";
    }
    
    const { diagnostics } = data;
    const summary = [];
    
    // Check Chloe package
    if (diagnostics.chloePackage) {
      summary.push(`Chloe Package: ${diagnostics.chloePackage.success ? '✅' : '❌'} ${diagnostics.chloePackage.message}`);
    }
    
    // Check Chloe exports
    if (diagnostics.chloeExports) {
      const hasChloeAgent = diagnostics.chloeExports.details?.hasChloeAgent;
      summary.push(`Chloe Exports: ${diagnostics.chloeExports.success ? '✅' : '❌'} ${hasChloeAgent ? 'ChloeAgent found' : 'ChloeAgent not found'}`);
    }
    
    // Check environment variables
    if (diagnostics.environmentVars) {
      const missingVars = diagnostics.environmentVars.details?.missing || [];
      summary.push(`Environment Variables: ${diagnostics.environmentVars.success ? '✅ All set' : `❌ Missing: ${missingVars.join(', ')}`}`);
    }
    
    // Check required packages
    const packages = [
      { name: 'LangChain Core', result: diagnostics.langchainPackage },
      { name: 'LangChain OpenAI', result: diagnostics.openaiPackage },
      { name: 'LangGraph', result: diagnostics.langgraphPackage }
    ];
    
    summary.push('Required Packages:');
    packages.forEach(pkg => {
      if (pkg.result) {
        summary.push(`  - ${pkg.name}: ${pkg.result.success ? '✅' : '❌'}`);
      }
    });
    
    return summary.join('\n');
  };

  // Check Chloe's functionality directly
  const checkChloe = async () => {
    console.log("Checking Chloe agent...");
    setIsLoading(true);
    
    try {
      // Call check-chloe API
      const response = await fetch('/api/check-chloe');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setChloeCheckResults(data);
      
      // Format the steps for display
      const stepsMessage = data.steps ? data.steps.join('\n') : 'No steps recorded';
      
      // Show results
      const checkMessage: Message = {
        sender: 'Diagnostics',
        content: `Chloe Agent Check ${data.success ? '✅' : '❌'}:

${stepsMessage}

${data.error ? `Error: ${data.error}` : ''}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, checkMessage]);
      
      // Log details
      console.log("Chloe check results:", data);
    } catch (error) {
      console.error("Error checking Chloe:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to check Chloe: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show instructions to fix Chloe agent
  const showFixInstructions = async () => {
    console.log("Fetching fix instructions...");
    setIsLoading(true);
    
    try {
      // Call fix-instructions API
      const response = await fetch('/api/fix-instructions');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setFixInstructions(data);
      
      // Show a summary of the instructions
      const instructionMessage: Message = {
        sender: 'Diagnostics',
        content: `📋 ${data.title}

Here are the main steps to check:
1. Package Installation: Make sure @crowd-wisdom/agents-chloe is installed
2. Environment Variables: Check .env.local for required API keys
3. API Keys: Verify OpenRouter and Qdrant API keys are valid
4. Export Format: Ensure correct exports in the package
5. Rebuild and Restart: Try rebuilding and restarting the server

For detailed instructions, see the Debug panel.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, instructionMessage]);
      
      // Log details
      console.log("Fix instructions:", data);
    } catch (error) {
      console.error("Error fetching fix instructions:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to fetch fix instructions: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to reset chat history
  const resetChatHistory = async () => {
    if (!confirm('Are you sure you want to reset the chat history? This will clear all messages.')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // First try to reset the database schema
      const resetResponse = await fetch('/api/memory/reset-schema');
      
      if (!resetResponse.ok) {
        console.error('Error resetting memory schema:', await resetResponse.text());
      } else {
        console.log('Reset memory schema successfully');
      }
      
      // Set a new welcome message
      setMessages([{
        sender: selectedAgent,
        content: `Hello! I'm ${selectedAgent}. Our conversation has been reset.`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error resetting chat history:', error);
      
      setMessages([{
        sender: selectedAgent,
        content: `Hello! I'm ${selectedAgent}. There was an error resetting our conversation.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all memories
  const fetchAllMemories = async () => {
    setIsLoadingMemories(true);
    
    try {
      const response = await fetch('/api/memory/all');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setAllMemories(data);
    } catch (error) {
      console.error("Error fetching all memories:", error);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Fetch scheduled tasks
  const fetchScheduledTasks = async (): Promise<void> => {
    setIsLoadingTasks(true);
    try {
      const res = await fetch('/api/scheduler-tasks');
      if (!res.ok) {
        throw new Error('Failed to fetch scheduled tasks');
      }
      const data = await res.json();
      
      // Log the actual data returned to help debug
      console.log("Scheduler tasks response received");
      console.log("Number of tasks:", Array.isArray(data) ? data.length : 0);
      if (Array.isArray(data) && data.length > 0) {
        console.log("First task sample:", data[0]);
      }
      
      // Set the tasks directly as the API now returns the array format we need
      setScheduledTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching scheduled tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Run a scheduled task immediately
  const runTaskNow = async (taskId: string): Promise<void> => {
    try {
      const response = await fetch('/api/run-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run task: ${response.statusText}`);
      }
      
      // Refresh task list after running a task
      console.log(`Task ${taskId} ran successfully`);
    } catch (error) {
      console.error('Error running task:', error);
      throw error;
    }
  };

  // Toggle task enabled status
  const toggleTaskEnabled = async (taskId: string, enabled: boolean): Promise<void> => {
    try {
      const response = await fetch('/api/toggle-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, enabled }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle task: ${response.statusText}`);
      }
      
      setScheduledTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, enabled } : task
        )
      );
    } catch (error) {
      console.error('Error toggling task:', error);
      throw error;
    }
  };

  // Fetch tasks when tab changes to 'tasks'
  useEffect(() => {
    if (selectedTab === 'tasks') {
      fetchScheduledTasks();
    }
    if (selectedTab === 'memory') {
      fetchAllMemories();
    }
  }, [selectedTab]);

  // Add this function to the Home component
  const runDirectMarketScan = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/run-market-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run market scan: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Display result to user
      setMessages([
        ...messages,
        {
          sender: 'Chloe',
          content: data.message || 'Market scan completed',
          timestamp: new Date(),
        },
      ]);
      
      console.log('Market scan result:', data);
    } catch (error) {
      console.error('Error running direct market scan:', error);
      
      // Display error to user
      setMessages([
        ...messages,
        {
          sender: 'Chloe',
          content: `Error running market scan: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add function to handle file upload errors
  const handleFileUploadError = (error: string) => {
    // Create an error message
    const errorMessage: Message = {
      sender: 'System',
      content: `❌ Error uploading file: ${error}`,
      timestamp: new Date()
    };
    
    // Add to messages
    setMessages(prevMessages => [...prevMessages, errorMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Enhanced to include file attachments
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    console.log("Form submitted with:", inputMessage);
    
    if (!inputMessage.trim() && pendingAttachments.length === 0) return;

    // Add user message with file context if attachments exist
    const messageContent = pendingAttachments.length > 0 
      ? inputMessage || "(Attached file without context)"
      : inputMessage;
      
    const userMessage: Message = {
      sender: 'You',
      content: messageContent,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Store and clear input
    const sentMessage = inputMessage;
    setInputMessage('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Prepare form data if we have attachments
      let response;
      
      if (pendingAttachments.length > 0) {
        const formData = new FormData();
        formData.append('message', sentMessage); // Send user's context about the file
        formData.append('userId', 'default-user');
        
        // Log the context being sent with files
        console.log("Sending files with context:", sentMessage);
        
        // Add each file to the formData
        pendingAttachments.forEach((attachment, index) => {
          formData.append(`file_${index}`, attachment.file);
        });
        
        // Send to server with multipart/form-data
        response = await fetch('/api/chat-with-files', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Standard JSON request without files
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: sentMessage,
            userId: 'default-user', // We can improve this later
          }),
        });
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Use the actual response from the API
      const agentResponse: Message = {
        sender: selectedAgent,
        content: data.reply,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      // Log memory and thoughts for debugging
      if (data.memory && data.memory.length > 0) {
        console.log('Memory context used:', data.memory);
      }
      
      if (data.thoughts && data.thoughts.length > 0) {
        console.log('Agent thoughts:', data.thoughts);
      }
      
      setMessages(prev => [...prev, agentResponse]);
      
      // Clear pending attachments after sending
      setPendingAttachments([]);
    } catch (error) {
      console.error("Error calling API:", error);
      
      // Show error message
      const errorResponse: Message = {
        sender: selectedAgent,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header - hide in fullscreen mode */}
      {!isFullscreen && (
        <header className="bg-gray-800 border-b border-gray-700 py-2 px-4 flex justify-between items-center">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
              className="p-2 mr-2 rounded hover:bg-gray-700"
              aria-label="Toggle sidebar"
          >
              <MenuIcon className="h-5 w-5" />
          </button>
            <h1 className="text-xl font-bold">Crowd Wisdom</h1>
            
            <div className="ml-4 flex space-x-2">
              {/* Department dropdown */}
              <div className="relative">
              <button 
                  className="flex items-center px-3 py-1 bg-gray-700 rounded text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDeptDropdown();
                  }}
                >
                  <span>{selectedDepartment}</span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                
                {isDeptDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-40 bg-gray-700 rounded shadow-lg">
                    <ul className="py-1">
                      {departments.map((dept) => (
                        <li key={dept}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDepartmentChange(dept);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600 ${
                              selectedDepartment === dept ? 'bg-blue-600' : ''
                            }`}
                          >
                            {dept}
              </button>
            </li>
                      ))}
          </ul>
                  </div>
                )}
              </div>
              
              {/* Agent dropdown */}
            <div className="relative">
                <button 
                  className="flex items-center px-3 py-1 bg-gray-700 rounded text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAgentDropdown();
                  }}
                >
                  <span>{selectedAgent}</span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                
                {isAgentDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-40 bg-gray-700 rounded shadow-lg">
                    <ul className="py-1">
                      {(agentsByDepartment[selectedDepartment as keyof typeof agentsByDepartment] || []).map((agent) => (
                        <li key={agent}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAgentChange(agent);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm ${
                              agent.includes('Soon') ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-gray-600'
                            } ${selectedAgent === agent ? 'bg-blue-600' : ''}`}
                          >
                            {agent}
                          </button>
                        </li>
                      ))}
                    </ul>
              </div>
                )}
            </div>
          </div>
          </div>
          <div className="flex items-center space-x-4">
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <a href="#" className="text-sm hover:text-blue-400">Dashboard</a>
              </li>
                <li>
                  <a href="#" className="text-sm hover:text-blue-400">Projects</a>
              </li>
                <li>
                  <a href="#" className="text-sm hover:text-blue-400">Analytics</a>
                </li>
                <li>
                  <a href="#" className="text-sm hover:text-blue-400">Settings</a>
              </li>
            </ul>
            </nav>
              <button
              onClick={() => setIsDebugMode(!isDebugMode)}
              className={`p-2 rounded ${isDebugMode ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
              >
              <PinIcon className="h-4 w-4" />
              </button>
            </div>
        </header>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - conditionally show based on state */}
        <div 
          className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 
            ${isSidebarOpen ? 'w-64' : 'w-0'} 
            ${isFullscreen ? 'hidden' : 'block'}`}
        >
          {isSidebarOpen && (
            <>
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="font-semibold">Quick Actions</h2>
              <button
                  onClick={toggleSidebarPin} 
                  className={`p-1 rounded ${isSidebarPinned ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                  title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                >
                  <PinIcon className="h-4 w-4" />
              </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-400">AGENTS</h3>
                <ul className="space-y-1 mb-4">
                  <li>
              <button
                      onClick={() => setSelectedAgent('Chloe')}
                      className={`w-full text-left block p-2 rounded ${selectedAgent === 'Chloe' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
              >
                      Chloe (Marketing)
              </button>
                  </li>
                  <li>
                    <button className="w-full text-left block p-2 rounded text-gray-500 cursor-not-allowed">
                      Emma (HR) - Coming Soon
                    </button>
                  </li>
                  <li>
                    <button className="w-full text-left block p-2 rounded text-gray-500 cursor-not-allowed">
                      Alex (Finance) - Coming Soon
                    </button>
                  </li>
                </ul>
                
                <h3 className="text-sm font-semibold mb-2 text-gray-400">COMMON TASKS</h3>
                <ul className="space-y-1">
                  <li>
                    <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
                      Content Planning
                    </button>
                  </li>
                  <li>
                    <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
                      Social Monitoring
                    </button>
                  </li>
                  <li>
                    <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
                      Create Campaign
                    </button>
                  </li>
                  <li>
                    <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
                      Analyze Metrics
                    </button>
                  </li>
                </ul>
            </div>
            </>
          )}
          </div>

        {/* Chat container */}
        <div className={`flex-1 flex flex-col ${isFullscreen ? 'w-full' : ''}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header with tabs and fullscreen toggle */}
            <div className="bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
              <div className="flex space-x-1">
                {['Chat', 'Tools', 'Tasks', 'Memory', 'Social', 'Files'].map((tab) => (
              <button 
                    key={tab}
                    onClick={() => setSelectedTab(tab.toLowerCase())}
                    className={`px-3 py-1 rounded-t ${
                      selectedTab === tab.toLowerCase()
                        ? 'bg-gray-700 text-white'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    {tab}
              </button>
                ))}
              </div>
              <button 
                onClick={toggleFullscreen}
                className="p-2 rounded hover:bg-gray-700"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <MinimizeIcon className="h-5 w-5" />
                ) : (
                  <MaximizeIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Main chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedTab === 'chat' && (
                /* Display messages */
                messages.map((message, index) => (
                  <div key={index} className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg p-2 shadow ${
                      message.sender === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-700'
                    }`}>
                      <MarkdownRenderer content={message.content} />
                    </div>
                  </div>
                ))
              )}
              
              {selectedTab === 'tasks' && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-xl font-bold mb-4">Scheduled Tasks</h2>
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : scheduledTasks.length === 0 ? (
                    <p className="text-gray-400">No scheduled tasks found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Schedule</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Run</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Next Run</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {scheduledTasks.map((task) => (
                            <tr key={task.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">{task.name}</td>
                              <td className="px-4 py-3 text-sm">{task.description}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">{formatCronExpression(task.cronExpression)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">{task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">{task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Unknown'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {task.enabled ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <div className="flex space-x-2">
              <button 
                                    onClick={() => runTaskNow(task.id)}
                                    className="text-blue-400 hover:text-blue-300"
                                    title="Run now"
              >
                                    <PlayIcon className="h-5 w-5" />
              </button>
              <button 
                                    onClick={() => toggleTaskEnabled(task.id, !task.enabled)}
                                    className={`${task.enabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                                    title={task.enabled ? 'Disable' : 'Enable'}
                                  >
                                    {task.enabled ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
              </button>
            </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
          </div>
                              )}
                            </div>
                          )}
              
              {selectedTab === 'memory' && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-xl font-bold mb-4">Memory Explorer</h2>
                  {isLoadingMemories ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                  ) : (
                    <MemoryTable memories={allMemories} />
                  )}
                  </div>
                )}
                
              {selectedTab === 'tools' && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-xl font-bold mb-4">Tools & Diagnostics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Agent Diagnostics</h3>
                      <p className="text-sm text-gray-300 mb-4">Run tests to check Chloe's configuration and functionality.</p>
                      <div className="flex space-x-2">
                    <button
                          onClick={checkChloe}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                      disabled={isLoading}
                    >
                          Check Agent
                    </button>
                        <button 
                          onClick={runDiagnostics}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                          disabled={isLoading}
                        >
                          Run Diagnostics
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Memory Management</h3>
                      <p className="text-sm text-gray-300 mb-4">Examine and manage Chloe's memory system.</p>
                      <div className="flex space-x-2">
                    <button
                      onClick={inspectChloeMemory}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                      disabled={isLoading}
                    >
                      Inspect Memory
                    </button>
                    <button
                          onClick={resetChatHistory}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                      disabled={isLoading}
                    >
                          Reset Chat
                    </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Test Connection</h3>
                      <p className="text-sm text-gray-300 mb-4">Test Chloe's connection to backend services.</p>
                      <div className="flex space-x-2">
                    <button
                          onClick={testChloeAgent}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                      disabled={isLoading}
                    >
                          Test Connection
                    </button>
                    <button
                      onClick={showFixInstructions}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm"
                      disabled={isLoading}
                    >
                      Fix Instructions
                    </button>
                  </div>
              </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Direct Market Scan</h3>
                      <p className="text-sm text-gray-300 mb-4">Run a market scan directly without using the intent router.</p>
                      <div className="flex space-x-2">
                  <button
                          onClick={runDirectMarketScan}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
                          disabled={isLoading}
                  >
                          Run Market Scan
                  </button>
              </div>
              </div>
            </div>
                      
                  {isDebugMode && (
                    <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                      <h3 className="font-semibold mb-2">Debug Info</h3>
                      {diagnosticResults && (
                <div className="mb-4">
                          <h4 className="text-sm font-medium mb-1">Diagnostic Results:</h4>
                          <pre className="bg-gray-900 p-2 rounded overflow-auto text-xs">
                            {JSON.stringify(diagnosticResults, null, 2)}
                          </pre>
                </div>
              )}
              
                      {chloeCheckResults && (
                <div className="mb-4">
                          <h4 className="text-sm font-medium mb-1">Chloe Check Results:</h4>
                          <pre className="bg-gray-900 p-2 rounded overflow-auto text-xs">
                            {JSON.stringify(chloeCheckResults, null, 2)}
                          </pre>
                        </div>
              )}
              
                      {fixInstructions && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Fix Instructions:</h4>
                          <div className="bg-gray-900 p-2 rounded text-xs">
                            <h5 className="font-bold">{fixInstructions.title}</h5>
                            <div className="mt-2 whitespace-pre-wrap">{fixInstructions.content}</div>
                          </div>
                        </div>
                )}
                  </div>
                )}
              </div>
          )}
          
              {selectedTab === 'social' && (
                <SocialMediaTable />
              )}
              
              {selectedTab === 'files' && (
                <FilesTable onRefresh={fetchAllMemories} />
              )}
                        </div>

            {/* Input area */}
            <div className="border-t border-gray-700 p-4">
              {selectedTab === 'chat' && (
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
          )}
              <div ref={messagesEndRef} />
                          </div>
                      </div>
                  </div>
              </div>
    </div>
  );
} 
