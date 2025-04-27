import React from 'react';

interface KnowledgeStatsProps {
  isLoading: boolean;
  stats: {
    totalItems: number;
    pendingItems: number;
    approvedItems: number;
    rejectedItems: number;
    bySourceType: Record<string, number>;
    byKnowledgeType: Record<string, number>;
  } | null;
}

const KnowledgeStats: React.FC<KnowledgeStatsProps> = ({ isLoading, stats }) => {
  if (isLoading) {
    return (
      <>
        <StatCard title="Total Items" value="Loading..." />
        <StatCard title="Pending Review" value="Loading..." />
        <StatCard title="Processed" value="Loading..." />
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <StatCard title="Total Items" value="No data" />
        <StatCard title="Pending Review" value="No data" />
        <StatCard title="Processed" value="No data" />
      </>
    );
  }

  return (
    <>
      <StatCard 
        title="Total Items" 
        value={stats.totalItems.toString()} 
        detail={`${stats.approvedItems} approved, ${stats.rejectedItems} rejected`}
      />
      <StatCard 
        title="Pending Review" 
        value={stats.pendingItems.toString()}
        detail="Waiting for review" 
        color={stats.pendingItems > 0 ? "amber" : "green"}
      />
      <StatCard 
        title="Processed" 
        value={(stats.approvedItems + stats.rejectedItems).toString()}
        detail={`${Math.round((stats.approvedItems + stats.rejectedItems) / (stats.totalItems || 1) * 100)}% of total`}
      />
    </>
  );
};

// Helper component for individual stat cards
const StatCard: React.FC<{
  title: string;
  value: string;
  detail?: string;
  color?: "blue" | "green" | "amber" | "red";
}> = ({ title, value, detail, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-900/30 border-blue-500",
    green: "bg-green-900/30 border-green-500",
    amber: "bg-amber-900/30 border-amber-500",
    red: "bg-red-900/30 border-red-500",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]} flex flex-col items-center justify-center`}>
      <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
      {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
    </div>
  );
};

export default KnowledgeStats; 