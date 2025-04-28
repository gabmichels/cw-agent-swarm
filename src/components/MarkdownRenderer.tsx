import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content?: string;  // Make content optional
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content = '', className = '' }) => {
  // Pre-process content with null safety
  // Default to empty string if content is undefined or null
  const processedContent = content 
    ? content
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
    : '';

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown className="markdown-content">
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 