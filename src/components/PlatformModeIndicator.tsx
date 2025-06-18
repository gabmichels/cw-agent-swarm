'use client';

import React, { useState, useEffect } from 'react';
import { PlatformConfigService } from '../services/PlatformConfigService';

export interface PlatformModeIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Platform Mode Indicator Component
 * Shows the current platform mode (personal/organizational) with visual indicator
 */
export const PlatformModeIndicator: React.FC<PlatformModeIndicatorProps> = ({
  className = '',
  showLabel = true,
  size = 'md'
}) => {
  const [platformMode, setPlatformMode] = useState<'personal' | 'organizational' | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlatformConfig = async () => {
      try {
        const configService = PlatformConfigService.getInstance();
        const mode = configService.getPlatformMode();
        setPlatformMode(mode);
        
        if (mode === 'organizational') {
          setOrganizationName(configService.getOrganizationName() || 'Organization');
        }
      } catch (error) {
        console.error('Failed to load platform configuration:', error);
        setPlatformMode('personal'); // Default fallback
      } finally {
        setLoading(false);
      }
    };

    loadPlatformConfig();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="animate-pulse flex items-center">
          <div className="w-3 h-3 bg-gray-600 rounded-full mr-2"></div>
          <div className="w-16 h-4 bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (!platformMode) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const isOrganizational = platformMode === 'organizational';

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <div 
        className={`${iconSizes[size]} rounded-full mr-2 flex items-center justify-center ${
          isOrganizational 
            ? 'bg-blue-600 text-white' 
            : 'bg-green-600 text-white'
        }`}
        title={`Platform Mode: ${platformMode}`}
      >
        {isOrganizational ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-2/3 h-2/3">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-2/3 h-2/3">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        )}
      </div>
      
      {showLabel && (
        <div className="flex flex-col">
          <span className={`font-medium ${
            isOrganizational ? 'text-blue-400' : 'text-green-400'
          }`}>
            {isOrganizational ? 'Organizational' : 'Personal'}
          </span>
          {isOrganizational && organizationName && (
            <span className="text-xs text-gray-400 leading-tight">
              {organizationName}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PlatformModeIndicator; 