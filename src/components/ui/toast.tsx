import React from 'react';
import { createRoot } from 'react-dom/client';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export interface ToastOptions extends ToastProps {}

const ToastComponent: React.FC<ToastProps> = ({ 
  message, 
  type = 'info',
  duration = 3000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-600 text-black';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 
        px-4 py-2 rounded-lg shadow-lg
        transition-all duration-300
        ${getTypeStyles()}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
};

export class Toast {
  private static createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  private static getContainer() {
    return document.getElementById('toast-container') || this.createToastContainer();
  }

  static show(options: ToastOptions) {
    const container = this.getContainer();
    const toastRoot = createRoot(container);
    
    const handleClose = () => {
      toastRoot.unmount();
      container.remove();
    };

    toastRoot.render(
      <ToastComponent
        {...options}
        onClose={handleClose}
      />
    );
  }
} 