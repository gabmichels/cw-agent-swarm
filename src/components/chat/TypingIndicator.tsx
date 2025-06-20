import React, { useState, useEffect, useRef } from 'react';
import { ulid } from 'ulid';

/**
 * Typing status for a user/agent
 */
export interface TypingStatus {
  id: string;
  name: string;
  role: 'user' | 'agent';
  avatar?: string;
  startedAt: Date;
}

/**
 * Typing event for SSE
 */
export interface TypingEvent {
  type: 'TYPING_START' | 'TYPING_STOP';
  chatId: string;
  userId: string;
  userName: string;
  userRole: 'user' | 'agent';
  userAvatar?: string;
  timestamp: Date;
}

interface TypingIndicatorProps {
  /** Current chat ID */
  chatId: string;
  /** Currently typing users/agents */
  typingUsers?: TypingStatus[];
  /** Maximum number of typing users to show */
  maxVisible?: number;
  /** Auto-timeout for typing status (milliseconds) */
  typingTimeout?: number;
  /** Custom CSS classes */
  className?: string;
  /** Show avatars */
  showAvatars?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Typing indicator component with animated dots
 */
export function TypingIndicator({
  chatId,
  typingUsers = [],
  maxVisible = 3,
  typingTimeout = 10000, // 10 seconds
  className = '',
  showAvatars = true,
  compact = false
}: TypingIndicatorProps) {
  const [visibleUsers, setVisibleUsers] = useState<TypingStatus[]>([]);
  const [animationFrame, setAnimationFrame] = useState(0);
  const animationRef = useRef<number>();

  // Filter and limit visible typing users
  useEffect(() => {
    const now = new Date();
    const activeUsers = typingUsers.filter(user => {
      const timeSinceStarted = now.getTime() - user.startedAt.getTime();
      return timeSinceStarted < typingTimeout;
    });

    setVisibleUsers(activeUsers.slice(0, maxVisible));
  }, [typingUsers, maxVisible, typingTimeout]);

  // Animate typing dots
  useEffect(() => {
    if (visibleUsers.length > 0) {
      const animate = () => {
        setAnimationFrame(prev => (prev + 1) % 4);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [visibleUsers.length]);

  // Don't render if no one is typing
  if (visibleUsers.length === 0) {
    return null;
  }

  // Generate typing dots based on animation frame
  const getTypingDots = () => {
    const dots = ['', '.', '..', '...'];
    return dots[animationFrame];
  };

  // Format typing text
  const getTypingText = () => {
    if (visibleUsers.length === 1) {
      return `${visibleUsers[0].name} is typing${getTypingDots()}`;
    } else if (visibleUsers.length === 2) {
      return `${visibleUsers[0].name} and ${visibleUsers[1].name} are typing${getTypingDots()}`;
    } else if (visibleUsers.length === 3) {
      return `${visibleUsers[0].name}, ${visibleUsers[1].name}, and ${visibleUsers[2].name} are typing${getTypingDots()}`;
    } else {
      const remaining = typingUsers.length - maxVisible;
      return `${visibleUsers[0].name}, ${visibleUsers[1].name}, and ${remaining + 1} others are typing${getTypingDots()}`;
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
      {/* Avatars */}
      {showAvatars && !compact && (
        <div className="flex -space-x-2">
          {visibleUsers.map((user, index) => (
            <div
              key={user.id}
              className="relative"
              style={{ zIndex: visibleUsers.length - index }}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-6 h-6 rounded-full border-2 border-white bg-gray-200"
                />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              
              {/* Typing indicator dot */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white">
                <div className="w-full h-full bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Typing text */}
      <div className="flex items-center gap-1">
        {compact ? (
          <div className="flex items-center gap-1">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {visibleUsers.length > 1 && (
              <span className="text-xs">+{visibleUsers.length - 1}</span>
            )}
          </div>
        ) : (
          <span className="italic">{getTypingText()}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to manage typing indicators with SSE integration
 */
export function useTypingIndicator(chatId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Add typing user
  const addTypingUser = (user: Omit<TypingStatus, 'startedAt'>) => {
    setTypingUsers(prev => {
      const existing = prev.find(u => u.id === user.id);
      if (existing) {
        // Update existing user's timestamp
        return prev.map(u => 
          u.id === user.id 
            ? { ...u, startedAt: new Date() }
            : u
        );
      } else {
        // Add new typing user
        return [...prev, { ...user, startedAt: new Date() }];
      }
    });
  };

  // Remove typing user
  const removeTypingUser = (userId: string) => {
    setTypingUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Clear all typing users
  const clearTypingUsers = () => {
    setTypingUsers([]);
  };

  // Start typing (for current user)
  const startTyping = (userId: string, userName: string, userRole: 'user' | 'agent' = 'user') => {
    if (!isTyping) {
      setIsTyping(true);
      
      // Emit typing start event (would integrate with SSE)
      // This would typically send an SSE event to other clients
      console.log('Typing started:', { chatId, userId, userName, userRole });
    }

    // Reset the typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(userId);
    }, 3000); // Stop typing after 3 seconds of inactivity
  };

  // Stop typing (for current user)
  const stopTyping = (userId: string) => {
    if (isTyping) {
      setIsTyping(false);
      
      // Emit typing stop event (would integrate with SSE)
      console.log('Typing stopped:', { chatId, userId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Debounced typing handler for input events
  const handleTyping = (userId: string, userName: string, userRole: 'user' | 'agent' = 'user') => {
    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Start typing immediately if not already typing
    if (!isTyping) {
      startTyping(userId, userName, userRole);
    }

    // Set debounce to stop typing after 1 second of no input
    debounceTimeoutRef.current = setTimeout(() => {
      stopTyping(userId);
    }, 1000);
  };

  // Handle typing events from SSE
  const handleTypingEvent = (event: TypingEvent) => {
    if (event.chatId !== chatId) return;

    switch (event.type) {
      case 'TYPING_START':
        addTypingUser({
          id: event.userId,
          name: event.userName,
          role: event.userRole,
          avatar: event.userAvatar
        });
        break;
      case 'TYPING_STOP':
        removeTypingUser(event.userId);
        break;
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Auto-cleanup old typing statuses
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTypingUsers(prev => 
        prev.filter(user => {
          const timeSinceStarted = now.getTime() - user.startedAt.getTime();
          return timeSinceStarted < 10000; // Remove after 10 seconds
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    typingUsers,
    isTyping,
    addTypingUser,
    removeTypingUser,
    clearTypingUsers,
    startTyping,
    stopTyping,
    handleTyping,
    handleTypingEvent
  };
}

/**
 * Higher-order component to add typing indicator to input fields
 */
export function withTypingIndicator<T extends { onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }>(
  Component: React.ComponentType<T>,
  userId: string,
  userName: string,
  chatId: string,
  userRole: 'user' | 'agent' = 'user'
) {
  return function TypingIndicatorWrapper(props: T) {
    const { handleTyping } = useTypingIndicator(chatId);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Call original onChange if it exists
      props.onChange?.(e);
      
      // Handle typing indicator
      if (e.target.value.trim()) {
        handleTyping(userId, userName, userRole);
      }
    };

    return <Component {...props} onChange={handleChange} />;
  };
}

/**
 * Simple typing dots animation component
 */
export function TypingDots({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
} 