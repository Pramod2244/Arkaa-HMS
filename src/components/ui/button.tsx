import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/60',
        'px-4 py-2 text-base shadow-sm',
        {
          'bg-primary text-white hover:bg-primary-light active:scale-95': variant === 'primary',
          'bg-secondary text-primary hover:bg-secondary-light active:scale-95': variant === 'secondary',
          'bg-danger text-white hover:bg-danger/90 active:scale-95': variant === 'danger',
          'bg-transparent text-primary hover:bg-primary/10 active:scale-95': variant === 'ghost',
          'opacity-60 cursor-not-allowed': loading || disabled,
        },
        className
      )}
      disabled={loading || disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin mr-2 h-4 w-4 text-inherit" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
};
