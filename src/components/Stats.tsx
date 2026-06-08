import React from 'react';
import { ShoppingBag, Clock, Package, CheckCircle2, AlertTriangle, Boxes, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

const StatCard = ({ title, value, icon: Icon, trend, color, subtitle }: any) => (
  <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-apple-gray-200 dark:border-dark-border flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div className={cn("p-2.5 rounded-2xl shadow-lg", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <span className="text-emerald-500 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
          +{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
      {subtitle && <p className="text-[10px] text-neutral-400 mt-1 uppercase font-black tracking-widest">{subtitle}</p>}
    </div>
  </div>
);

export default function Stats({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-4">
      <StatCard 
        title="Total Orders" 
        value={stats.total} 
        icon={ShoppingBag} 
        color="bg-premium-gold shadow-premium-gold/20" 
        subtitle="Lifetime"
      />
      <StatCard 
        title="Pending" 
        value={stats.pending} 
        icon={Clock} 
        color="bg-neutral-500 shadow-neutral-500/20" 
        subtitle="Unprocessed"
      />
      <StatCard 
        title="Processing" 
        value={stats.processing} 
        icon={Package} 
        color="bg-premium-gold/60 shadow-premium-gold/10" 
        subtitle="Working on it"
      />
      <StatCard 
        title="Shipping" 
        value={stats.shipping} 
        icon={Package} 
        color="bg-neutral-800 shadow-neutral-800/20" 
        subtitle="In transit"
      />
      <StatCard 
        title="Delivered" 
        value={stats.delivered} 
        icon={CheckCircle2} 
        color="bg-emerald-500 shadow-emerald-500/20" 
        subtitle="Completed"
      />
      <StatCard 
        title="Products" 
        value={stats.totalProducts} 
        icon={Boxes} 
        color="bg-indigo-500 shadow-indigo-500/20" 
        subtitle="Items"
      />
      <StatCard 
        title="Low Stock" 
        value={stats.lowStock} 
        icon={AlertTriangle} 
        color={stats.lowStock > 0 ? "bg-rose-500 shadow-rose-500/20" : "bg-apple-gray-300 shadow-apple-gray-200/20"} 
        subtitle="Alerts"
      />
      {stats.customRequests !== undefined && (
        <StatCard 
          title="Custom Requests" 
          value={stats.customRequests} 
          icon={FileText} 
          color="bg-amber-500 shadow-amber-500/20" 
          subtitle="New Designs"
        />
      )}
    </div>
  );
}
