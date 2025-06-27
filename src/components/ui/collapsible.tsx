/**
 * Collapsible UI Component
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Strict TypeScript typing
 * - Pure functions where possible
 * - Proper component structure
 */

import * as React from "react";
import { cn } from "../../lib/utils";

const CollapsibleContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

const useCollapsible = () => {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("Collapsible components must be used within a Collapsible");
  }
  return context;
};

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

const Collapsible: React.FC<CollapsibleProps> = ({
  open: controlledOpen,
  onOpenChange,
  children,
  className
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div className={cn("space-y-2", className)}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
};

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

const CollapsibleTrigger: React.FC<CollapsibleTriggerProps> = ({
  children,
  className,
  asChild = false
}) => {
  const { open, setOpen } = useCollapsible();

  const handleClick = () => {
    setOpen(!open);
  };

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: handleClick,
      'aria-expanded': open,
      'data-state': open ? 'open' : 'closed',
    });
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between py-2 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      onClick={handleClick}
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
    >
      {children}
    </button>
  );
};

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
}

const CollapsibleContent: React.FC<CollapsibleContentProps> = ({
  children,
  className
}) => {
  const { open } = useCollapsible();

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn("pb-4", className)}
      data-state={open ? 'open' : 'closed'}
    >
      {children}
    </div>
  );
};

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
