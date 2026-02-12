import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

export function EmptyState({
  title = 'No data',
  description = '',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-dashed border-gray-200 shadow-soft">
      <PlusIcon className="h-10 w-10 text-primary/30 mb-2" />
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-gray-500 mb-2">{description}</p>}
      {action}
    </div>
  );
}
