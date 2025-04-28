import fs from 'fs';
import path from 'path';

// Add global declaration for the model
declare global {
  var model: any; // eslint-disable-line no-var
}

export interface TaskLogEntry {
  id: string;
  timestamp: string;
  type: 'user-message' | 'agent-message' | 'action' | 'memory-retrieval' | 'reflection';
  content: string;
  metadata?: Record<string, any>;
}

export interface TaskSession {
  id: string;
  startTime: string;
  endTime?: string;
  title?: string;
  tags?: string[];
  entries: TaskLogEntry[];
}

export interface TaskLoggerOptions {
  logsPath?: string;
  maxSessionsInMemory?: number;
  persistToFile?: boolean;
}

export class TaskLogger {
  private logsPath: string;
  private maxSessionsInMemory: number;
  private persistToFile: boolean;
  private sessions: Map<string, TaskSession> = new Map();
  private currentSessionId: string | null = null;

  constructor(options: TaskLoggerOptions = {}) {
    this.logsPath = options.logsPath || path.join(process.cwd(), 'logs', 'tasks');
    this.maxSessionsInMemory = options.maxSessionsInMemory || 10;
    this.persistToFile = options.persistToFile !== undefined ? options.persistToFile : true;
  }

  async initialize(): Promise<void> {
    if (this.persistToFile && !fs.existsSync(this.logsPath)) {
      fs.mkdirSync(this.logsPath, { recursive: true });
      console.log(`Created task logs directory at ${this.logsPath}`);
    }
  }

  /**
   * Create a new session and make it the current active session
   */
  createSession(title?: string, tags?: string[]): string {
    const sessionId = this.generateId();
    const session: TaskSession = {
      id: sessionId,
      startTime: new Date().toISOString(),
      title,
      tags,
      entries: []
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    // Prune old sessions if we're over the limit
    this.pruneOldSessions();
    
    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.currentSessionId) return;
    
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.endTime = new Date().toISOString();
      
      if (this.persistToFile) {
        this.saveSessionToFile(session);
      }
    }
    
    this.currentSessionId = null;
  }

  /**
   * Close the task logger, ending any active session and persisting data
   */
  async close(): Promise<void> {
    try {
      // End the current session if one exists
      this.endSession();
      
      // Save all sessions that haven't been saved yet
      const sessions = Array.from(this.sessions.entries());
      for (const [id, session] of sessions) {
        if (!session.endTime) {
          session.endTime = new Date().toISOString();
          
          if (this.persistToFile) {
            this.saveSessionToFile(session);
          }
        }
      }
      
      console.log('TaskLogger closed successfully');
    } catch (error) {
      console.error('Error closing TaskLogger:', error);
    }
  }

  /**
   * Process content to replace escaped newlines with actual newlines
   * This helps with formatting issues in messages from APIs
   */
  preprocessContent(content: string): string {
    if (!content) return content;
    
    // Replace escaped newlines with actual newlines
    let processedContent = content.replace(/\\n/g, '\n');
    
    // Replace escaped quotes if needed
    processedContent = processedContent.replace(/\\"/g, '"');
    
    return processedContent;
  }

  /**
   * Add an entry to the current session
   */
  logEntry(entry: Omit<TaskLogEntry, 'id' | 'timestamp'>): string | null {
    if (!this.currentSessionId) return null;
    
    const session = this.sessions.get(this.currentSessionId);
    if (!session) return null;
    
    // Process the content to handle escaped newlines
    const processedContent = this.preprocessContent(entry.content);
    
    const completeEntry: TaskLogEntry = {
      ...entry,
      content: processedContent,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    };
    
    session.entries.push(completeEntry);
    
    return completeEntry.id;
  }

  /**
   * Log a user message
   */
  logUserMessage(content: string, metadata?: Record<string, any>): string | null {
    return this.logEntry({
      type: 'user-message',
      content,
      metadata
    });
  }

  /**
   * Log an agent message
   */
  logAgentMessage(content: string, metadata?: Record<string, any>): string | null {
    return this.logEntry({
      type: 'agent-message',
      content,
      metadata
    });
  }

  /**
   * Log an action performed by the agent
   */
  logAction(content: string, metadata?: Record<string, any>): string | null {
    return this.logEntry({
      type: 'action',
      content,
      metadata
    });
  }

  /**
   * Log a memory retrieval
   */
  logMemoryRetrieval(content: string, metadata?: Record<string, any>): string | null {
    return this.logEntry({
      type: 'memory-retrieval',
      content,
      metadata
    });
  }

  /**
   * Log a reflection (self-awareness moment)
   */
  logReflection(content: string, metadata?: Record<string, any>): string | null {
    return this.logEntry({
      type: 'reflection',
      content,
      metadata
    });
  }

  /**
   * Get all entries from a specific session
   */
  getSessionEntries(sessionId: string): TaskLogEntry[] | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return [...session.entries];
  }

  /**
   * Get the current session
   */
  getCurrentSession(): TaskSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TaskSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get a list of all sessions in memory
   */
  getSessions(): TaskSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Save a session to file
   */
  private saveSessionToFile(session: TaskSession): void {
    if (!this.persistToFile) return;
    
    try {
      const sessionDir = path.join(this.logsPath, session.id);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      const filePath = path.join(sessionDir, 'session.json');
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      
      console.log(`Saved session ${session.id} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving session ${session.id} to file:`, error);
    }
  }

  /**
   * Load a session from file
   */
  loadSessionFromFile(sessionId: string): TaskSession | null {
    if (!this.persistToFile) return null;
    
    try {
      const filePath = path.join(this.logsPath, sessionId, 'session.json');
      if (!fs.existsSync(filePath)) return null;
      
      const sessionData = fs.readFileSync(filePath, 'utf-8');
      const session = JSON.parse(sessionData) as TaskSession;
      
      this.sessions.set(sessionId, session);
      
      return session;
    } catch (error) {
      console.error(`Error loading session ${sessionId} from file:`, error);
      return null;
    }
  }

  /**
   * Load recent sessions from files
   */
  async loadRecentSessions(limit: number = 5): Promise<TaskSession[]> {
    if (!this.persistToFile) return [];
    
    try {
      if (!fs.existsSync(this.logsPath)) return [];
      
      const sessionDirs = fs.readdirSync(this.logsPath);
      const sessions: TaskSession[] = [];
      
      for (const dir of sessionDirs.slice(0, limit)) {
        const sessionPath = path.join(this.logsPath, dir, 'session.json');
        if (fs.existsSync(sessionPath)) {
          try {
            const sessionData = fs.readFileSync(sessionPath, 'utf-8');
            const session = JSON.parse(sessionData) as TaskSession;
            
            sessions.push(session);
            this.sessions.set(session.id, session);
          } catch (error) {
            console.error(`Error loading session from ${sessionPath}:`, error);
          }
        }
      }
      
      // Sort by start time (newest first)
      return sessions.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (error) {
      console.error('Error loading recent sessions:', error);
      return [];
    }
  }

  /**
   * Keep only the most recent sessions in memory
   */
  private pruneOldSessions(): void {
    if (this.sessions.size <= this.maxSessionsInMemory) return;
    
    // Convert to array and sort by start time (newest first)
    const sortedSessions = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    // Remove oldest sessions that exceed the limit
    const sessionsToRemove = sortedSessions.slice(this.maxSessionsInMemory);
    
    for (const [sessionId] of sessionsToRemove) {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Generate a summary of the conversation in a session
   */
  async summarizeConversation(sessionId?: string, options: { maxEntries?: number, maxLength?: number } = {}): Promise<string> {
    // Use current session if no ID provided
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return "No active session to summarize.";
    
    const session = this.sessions.get(targetSessionId);
    if (!session) return "Session not found.";
    
    const { maxEntries = 20, maxLength = 500 } = options;
    
    // Filter conversation entries (user and agent messages)
    const conversationEntries = session.entries
      .filter(entry => entry.type === 'user-message' || entry.type === 'agent-message')
      .slice(-maxEntries); // Get most recent entries
    
    if (conversationEntries.length === 0) {
      return "No conversation to summarize.";
    }
    
    // Build conversation string for analysis
    const conversationText = conversationEntries.map(entry => {
      const role = entry.type === 'user-message' ? 'User' : 'Chloe';
      return `${role}: ${entry.content}`;
    }).join('\n\n');
    
    try {
      // If no AI model is available, generate a simple summary
      if (!global.model) {
        const messageCount = conversationEntries.length;
        const userMessages = conversationEntries.filter(e => e.type === 'user-message').length;
        const agentMessages = conversationEntries.filter(e => e.type === 'agent-message').length;
        
        // Extract conversation topics (simple implementation)
        const allText = conversationText.toLowerCase();
        const possibleTopics = [
          'marketing', 'social media', 'content', 'analytics', 'strategy',
          'campaign', 'budget', 'schedule', 'planning', 'metrics', 'goals',
          'performance', 'audience', 'competitors', 'trends', 'report'
        ];
        
        const detectedTopics = possibleTopics.filter(topic => 
          allText.includes(topic)
        ).slice(0, 3);
        
        const topicsText = detectedTopics.length > 0
          ? `about ${detectedTopics.join(', ')}`
          : '';
        
        return `Conversation with ${messageCount} messages (${userMessages} from user, ${agentMessages} from Chloe) ${topicsText}.`;
      }
      
      // With AI model, generate a more detailed summary
      const systemPrompt = `You are an expert conversation summarizer. Analyze the following conversation between User and Chloe (an AI marketing assistant) and create a concise summary. 
      Include:
      1. The main topics discussed
      2. Key points or decisions made
      3. Any actions agreed upon

      Keep your summary under ${maxLength} characters and focus only on the most important information.`;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationText }
      ];
      
      // Log that we're generating a summary
      this.logAction('Generating conversation summary', {
        sessionId: targetSessionId,
        messageCount: conversationEntries.length,
        timestamp: new Date().toISOString()
      });
      
      // Assuming a global model is available (injected when TaskLogger is used in agent)
      const response = await global.model.invoke(messages);
      const summary = response.content;
      
      // Log the generated summary
      this.logAction('Generated conversation summary', {
        summaryLength: summary.length,
        timestamp: new Date().toISOString()
      });
      
      return summary;
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      this.logAction(`Error generating conversation summary: ${error instanceof Error ? error.message : String(error)}`, {
        error: true,
        timestamp: new Date().toISOString()
      });
      
      // Fallback to simple summary
      return `Conversation with ${conversationEntries.length} messages. (Failed to generate detailed summary)`;
    }
  }
} 