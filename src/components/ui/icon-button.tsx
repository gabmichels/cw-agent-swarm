import * as React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon component to render
   */
  icon: React.ReactNode;

  /**
   * Whether the button is in a loading state
   */
  loading?: boolean;

  /**
   * Additional class names
   */
  className?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, loading, className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        variant="ghost"
        className={cn(
          'relative h-8 w-8 rounded-full bg-transparent hover:bg-white/10',
          loading && 'cursor-wait',
          className
        )}
        disabled={loading}
        {...props}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : (
          icon
        )}
        {children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton'; 