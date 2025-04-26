import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  memory?: string[];
  thoughts?: string[];
}

interface ChatMessagesProps {
  messages: Message[];
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => {
  return (
    <>
      {messages.map((message, index) => (
        <div key={index} className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-lg p-2 shadow ${
            message.sender === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-700'
          }`}>
            <MarkdownRenderer content={message.content} />
          </div>
        </div>
      ))}
    </>
  );
};

export default ChatMessages; 