import React from 'react';
import clsx from 'clsx';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-lg shadow-card border border-gray-100 p-6', className)}>{children}</div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4', className)}>{children}</div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={clsx('text-lg font-semibold text-gray-900', className)}>{children}</h3>
  );
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={clsx('text-sm text-gray-600', className)}>{children}</p>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('', className)}>{children}</div>
  );
}
