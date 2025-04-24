import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Pre-process content to handle escaped characters
  const processedContent = content
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"');

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown className="markdown-content">
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 