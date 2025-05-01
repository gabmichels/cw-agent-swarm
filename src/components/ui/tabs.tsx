import React from 'react';

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

// Create context for Tabs
interface TabsContextType {
  value: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType>({
  value: '',
});

// Base Tabs component - for internal use only
const TabsBase: React.FC<TabsProps> = ({ 
  children,
  className = ''
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ 
  children,
  className = ''
}) => {
  return (
    <div className={`flex gap-1 bg-gray-750 p-1 rounded-lg ${className}`}>
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value,
  children,
  className = '',
  onClick
}) => {
  // Get current value from parent Tabs context
  const tabsContext = React.useContext(TabsContext);
  const isActive = tabsContext.value === value;
  
  const handleClick = () => {
    tabsContext.onValueChange?.(value);
    onClick?.();
  };
  
  return (
    <button
      className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors
        ${isActive 
          ? 'bg-gray-800 text-white shadow' 
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
        } ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ 
  value,
  children,
  className = ''
}) => {
  // Get current value from parent Tabs context
  const tabsContext = React.useContext(TabsContext);
  const isActive = tabsContext.value === value;
  
  if (!isActive) return null;
  
  return (
    <div className={className}>
      {children}
    </div>
  );
};

// Main Tabs component with context
export const Tabs: React.FC<TabsProps> = (props) => {
  const { 
    defaultValue = '', 
    value: controlledValue, 
    onValueChange,
    children,
    ...rest 
  } = props;
  
  // Handle controlled or uncontrolled state
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  
  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };
  
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <TabsBase {...rest} value={value} onValueChange={handleValueChange}>
        {children}
      </TabsBase>
    </TabsContext.Provider>
  );
}; 