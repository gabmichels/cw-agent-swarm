/**
 * Message debugging utilities
 * Used for analyzing and debugging message types in development mode
 */

import { Message } from '../types';
import { MessageType } from '../constants/message';

/**
 * Analyzes all messages and logs stats about message types
 */
export function analyzeMessageTypes(messages: Message[]): void {
  // Skip if not in development mode
  if (process.env.NODE_ENV !== 'development' && !process.env.DEV_SHOW_INTERNAL_MESSAGES) {
    return;
  }
  
  const counts: Record<string, number> = {};
  
  // Count by messageType
  messages.forEach(msg => {
    const type = msg.messageType || 'unspecified';
    counts[type] = (counts[type] || 0) + 1;
  });
  
  // Count internal vs visible
  const internalCount = messages.filter(m => m.isInternalMessage).length;
  const visibleCount = messages.length - internalCount;
  
  // Log results
  console.group('Message Type Analysis');
  console.log(`Total messages: ${messages.length}`);
  console.log(`Visible messages: ${visibleCount}`);
  console.log(`Internal messages: ${internalCount}`);
  console.log('Message types:', counts);
  console.groupEnd();
}

/**
 * Exports messages to console in a format that can be copied for debugging
 */
export function exportDebugMessages(messages: Message[]): void {
  const debugData = messages.map(msg => ({
    type: msg.messageType || 'unspecified',
    sender: msg.sender,
    content: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
    isInternal: msg.isInternalMessage || false,
    timestamp: msg.timestamp
  }));
  
  console.group('Debug Messages Export');
  console.table(debugData);
  console.log('Full data:', debugData);
  console.groupEnd();
}

/**
 * Toggle for dev mode message debugging
 */
export function toggleMessageDebugging(enable: boolean = true): void {
  if (enable) {
    localStorage.setItem('DEV_SHOW_INTERNAL_MESSAGES', 'true');
    console.info('Message debugging enabled - internal messages will be displayed');
  } else {
    localStorage.removeItem('DEV_SHOW_INTERNAL_MESSAGES');
    console.info('Message debugging disabled');
  }
} 