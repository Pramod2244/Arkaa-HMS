import React from 'react';
import clsx from 'clsx';

export const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div
    className={clsx(
      'backdrop-blur-lg bg-white/70 dark:bg-slate-900/60 border border-white/30 shadow-2xl rounded-2xl p-8',
      'transition-all duration-300',
      className
    )}
    style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}
  >
    {children}
  </div>
);
