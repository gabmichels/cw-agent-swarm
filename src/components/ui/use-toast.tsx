"use client"

import * as React from "react"
import { createContext, useContext, useState } from "react"

type ToastVariant = 'default' | 'destructive'

export interface ToastProps {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface Toast extends ToastProps {
  id: string
  visible: boolean
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (props: ToastProps) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (props: ToastProps) => {
    const id = Math.random().toString(36).slice(2, 11)
    const newToast: Toast = {
      id,
      visible: true,
      duration: 5000, // Default duration
      ...props,
    }
    setToasts((prev) => [...prev, newToast])

    // Auto dismiss
    setTimeout(() => {
      dismissToast(id)
    }, props.duration || 5000)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast
      )
    )

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 300)
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  
  return context
}

// Standalone toast function that can be imported directly
export const toast = (props: ToastProps): string => {
  // Show console warning that this is not ideal usage
  console.warn('Using toast() directly rather than useToast() hook. Consider using useToast() in a component.')
  
  // Create a temporary element to mount the toast provider
  const div = document.createElement('div')
  document.body.appendChild(div)
  
  // Add toast
  const toastId = Math.random().toString(36).slice(2, 11)
  
  // Create a simple notification
  const notification = document.createElement('div')
  notification.className = 'fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300'
  notification.className += props.variant === 'destructive' 
    ? ' bg-red-500 text-white' 
    : ' bg-zinc-800 text-white'
  
  // Add title if provided
  if (props.title) {
    const title = document.createElement('div')
    title.className = 'font-medium'
    title.textContent = props.title
    notification.appendChild(title)
  }
  
  // Add description if provided
  if (props.description) {
    const description = document.createElement('div')
    description.className = 'text-sm mt-1'
    description.textContent = props.description
    notification.appendChild(description)
  }
  
  document.body.appendChild(notification)
  
  // Auto remove
  setTimeout(() => {
    notification.style.opacity = '0'
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, props.duration || 5000)
  
  return toastId
} 