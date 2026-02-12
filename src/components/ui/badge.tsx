import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'active' | 'inactive' | 'system';

export function Badge({
  children,
  variant = 'active',
  className = '',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
        {
          'bg-emerald-100 text-emerald-700 border border-emerald-200': variant === 'active',
          'bg-gray-100 text-gray-500 border border-gray-200': variant === 'inactive',
          'bg-indigo-100 text-indigo-700 border border-indigo-200': variant === 'system',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
