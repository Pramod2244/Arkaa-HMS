import React from 'react';
import clsx from 'clsx';

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <table className={clsx('min-w-full bg-white rounded-lg shadow-soft border border-gray-100', className)}>{children}</table>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50 text-gray-700 text-sm font-semibold">{children}</thead>;
}

export function TableRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <tr className={clsx('hover:bg-primary/5 transition', className)}>{children}</tr>;
}

export function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-2 border-b border-gray-100', className)}>{children}</td>;
}
