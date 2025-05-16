import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon component to render
   */
  icon: React.ReactNode;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Icon button component
 */
export function IconButton({
  icon,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`
        p-1 rounded-full
        text-gray-500 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {icon}
    </button>
  );
} 