'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlatformConfigService } from '../services/PlatformConfigService';

export interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
  modes: ('personal' | 'organizational')[];
}

export interface ModeAwareNavigationProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showDescriptions?: boolean;
}

/**
 * Mode-Aware Navigation Component
 * Shows different navigation options based on platform mode
 */
export const ModeAwareNavigation: React.FC<ModeAwareNavigationProps> = ({
  className = '',
  orientation = 'horizontal',
  showDescriptions = false
}) => {
  const pathname = usePathname();
  const [platformMode, setPlatformMode] = useState<'personal' | 'organizational' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlatformConfig = async () => {
      try {
        const configService = PlatformConfigService.getInstance();
        const mode = configService.getPlatformMode();
        setPlatformMode(mode);
      } catch (error) {
        console.error('Failed to load platform configuration:', error);
        setPlatformMode('personal');
      } finally {
        setLoading(false);
      }
    };

    loadPlatformConfig();
  }, []);

  const navigationItems: NavigationItem[] = [
    {
      href: '/',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      ),
      description: 'Main dashboard and overview',
      modes: ['personal', 'organizational']
    },
    {
      href: '/agents',
      label: 'My Agents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      description: 'Personal agent collection',
      modes: ['personal']
    },
    {
      href: '/org-chart',
      label: 'Organization',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      description: 'Organizational chart and hierarchy',
      modes: ['organizational']
    },
    {
      href: '/agents',
      label: 'Team Agents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      description: 'Team and departmental agents',
      modes: ['organizational']
    },
    {
      href: '/multi-agent-chat',
      label: 'Multi-Agent Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      description: 'Collaborative agent conversations',
      modes: ['personal', 'organizational']
    },
    {
      href: '/templates',
      label: 'Templates',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      description: 'Agent configuration templates',
      badge: 'New',
      modes: ['personal', 'organizational']
    },
    {
      href: '/analytics',
      label: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      description: 'Performance metrics and insights',
      modes: ['personal', 'organizational']
    }
  ];

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className={`flex ${orientation === 'vertical' ? 'flex-col space-y-2' : 'space-x-4'}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-600 rounded-lg w-24"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!platformMode) {
    return null;
  }

  const filteredItems = navigationItems.filter(item => 
    item.modes.includes(platformMode)
  );

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const containerClasses = orientation === 'vertical' 
    ? 'flex flex-col space-y-1'
    : 'flex space-x-1';

  return (
    <nav className={`${className}`}>
      <div className={containerClasses}>
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive(item.href)
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }
              ${orientation === 'vertical' ? 'justify-start' : 'justify-center'}
            `}
          >
            <span className={`${orientation === 'vertical' ? 'mr-3' : 'mr-2'}`}>
              {item.icon}
            </span>
            <span className={orientation === 'vertical' ? 'flex-1' : ''}>
              {item.label}
            </span>
            
            {item.badge && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {item.badge}
              </span>
            )}
            
            {showDescriptions && item.description && orientation === 'vertical' && (
              <div className="mt-1 text-xs text-gray-400">
                {item.description}
              </div>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default ModeAwareNavigation; 