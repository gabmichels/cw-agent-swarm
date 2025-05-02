import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileAttachment } from '../types';

interface MarkdownRendererProps {
  content?: string;  // Make content optional
  className?: string;
  onImageClick?: (attachment: FileAttachment, e: React.MouseEvent) => void;
}

// Type for the code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content = '', 
  className = '',
  onImageClick
}) => {
  // Pre-process content with null safety
  // Default to empty string if content is undefined or null
  const processedContent = content
    ? content
    .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
    : '';

  // Handle image click if the callback is provided
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (onImageClick) {
      // Create a temporary attachment object from the image
      const imgElement = e.currentTarget;
      const blob = new Blob([], { type: 'image/png' });
      const file = new File([blob], imgElement.alt || 'image.png', { type: 'image/png' });
      
      const attachment: FileAttachment = {
        file: file,
        type: 'image',
        preview: imgElement.src,
        filename: imgElement.alt || 'Image',
        size: 0,
        mimeType: 'image/png'
      };
      
      onImageClick(attachment, e);
    }
  };

  return (
    <div className={`prose dark:prose-invert prose-headings:text-white prose-p:text-gray-200 prose-strong:text-purple-300 prose-em:text-gray-300 max-w-none w-full ${className}`}>
      <ReactMarkdown 
        className="markdown-content w-full" 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-4 border-b pb-1 border-gray-200 dark:border-gray-700 w-full" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold my-3 border-b pb-1 border-gray-200 dark:border-gray-700 w-full" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2 w-full" {...props} />,
          h4: ({node, ...props}) => <h4 className="text-base font-bold my-2 w-full" {...props} />,
          p: ({node, ...props}) => <p className="my-3 leading-relaxed w-full" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-6 my-3 space-y-1 w-full" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-3 space-y-1 w-full" {...props} />,
          li: ({node, ...props}) => <li className="my-1" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-500 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1 my-3 italic bg-gray-50 dark:bg-gray-800 rounded-r" {...props} />,
          hr: ({node, ...props}) => <hr className="my-6 border-gray-300 dark:border-gray-700" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold text-purple-300" {...props} />,
          em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
          code: ({node, inline, className, children, ...props}: CodeProps) => {
            const match = /language-(\w+)/.exec(className || '');
            return inline ? (
              <code className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-gray-200 dark:bg-gray-800 p-4 my-4 rounded-md overflow-x-auto border border-gray-300 dark:border-gray-700">
                <code className={`${match ? `language-${match[1]}` : ''} text-sm font-mono block`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          img: ({node, ...props}) => (
            <div className="my-4 flex justify-center">
              <img 
                className="max-w-full rounded-md shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
                onClick={onImageClick ? handleImageClick : undefined}
                {...props} 
                alt={props.alt || 'Image'} 
              />
            </div>
          ),
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 rounded-md border border-gray-300 dark:border-gray-700">
              <table className="min-w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-700" {...props} />,
          tbody: ({node, ...props}) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props} />,
          tr: ({node, ...props}) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-800" {...props} />,
          th: ({node, ...props}) => <th className="px-4 py-2 text-left text-sm font-semibold" {...props} />,
          td: ({node, ...props}) => <td className="px-4 py-2 text-sm" {...props} />
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 