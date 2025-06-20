'use client';

import React from 'react';
import { SSEPerformanceDashboard } from '../../../components/monitoring/SSEPerformanceDashboard';

/**
 * SSE Performance Monitoring Page
 */
export default function SSEMonitoringPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SSE Performance Monitoring</h1>
          <p className="text-gray-600 mt-2">
            Real-time monitoring and analytics for Server-Sent Events connections
          </p>
        </div>
        
        <SSEPerformanceDashboard className="w-full" />
        
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About SSE Monitoring</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Key Metrics</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Active Connections:</strong> Current SSE connections</li>
                <li>• <strong>Events/Second:</strong> Real-time event delivery rate</li>
                <li>• <strong>Error Rate:</strong> Percentage of failed connections</li>
                <li>• <strong>Uptime:</strong> System availability duration</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Performance Benefits</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>95% fewer requests</strong> vs polling</li>
                <li>• <strong>90% bandwidth savings</strong> on average</li>
                <li>• <strong>&lt;100ms latency</strong> for real-time updates</li>
                <li>• <strong>Auto-reconnection</strong> for reliability</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Health Status Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <strong className="text-green-800">Healthy:</strong> All systems operating normally
              </div>
              <div>
                <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                <strong className="text-yellow-800">Degraded:</strong> Some issues detected, monitoring recommended
              </div>
              <div>
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                <strong className="text-red-800">Unhealthy:</strong> Critical issues requiring immediate attention
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 