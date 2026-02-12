import React from 'react';
import clsx from 'clsx';

export interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string; // Optional: for custom gradient/icon bg
  loading?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  color = 'from-primary/80 to-emerald-400',
  loading = false,
}) => {
  return (
    <div
      className={clsx(
        'relative bg-white rounded-lg shadow-card border border-gray-100 p-6 flex flex-col gap-3 min-w-[200px] transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-1',
        'group'
      )}
    >
      <div
        className={clsx(
          'absolute -top-1 left-6 right-6 h-1 rounded-t-lg',
          `bg-gradient-to-r ${color}`
        )}
      />
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-emerald-50 h-12 w-12 shadow-soft">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">{title}</div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? <span className="animate-pulse bg-gray-200 rounded w-16 h-6 inline-block" /> : value}
          </div>
        </div>
      </div>
    </div>
  );
};
