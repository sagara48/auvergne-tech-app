import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// ================================================
// BUTTON
// ================================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:shadow-blue-500/25',
      secondary: cn(
        'border transition-theme',
        'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)]',
        'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      ),
      success: 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-500/25',
      danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
      ghost: cn(
        'transition-theme',
        'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      ),
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200',
          variants[variant],
          sizes[size],
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ================================================
// INPUT
// ================================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm transition-theme',
          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)]',
          'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

// ================================================
// TIME INPUT
// ================================================
export const TimeInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="time"
        className={cn(
          'px-2 py-2 rounded-lg text-sm text-center font-mono transition-theme',
          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]',
          'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);
TimeInput.displayName = 'TimeInput';

// ================================================
// SELECT
// ================================================
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm transition-theme',
          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]',
          'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// ================================================
// TEXTAREA
// ================================================
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm transition-theme resize-none',
          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)]',
          'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// ================================================
// CARD
// ================================================
interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden transition-theme',
        'bg-[var(--bg-secondary)] border border-[var(--border-secondary)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-b transition-theme',
        'bg-[var(--bg-tertiary)]/50 border-[var(--border-secondary)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ className, children }: CardProps) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  );
}

// ================================================
// BADGE
// ================================================
interface BadgeProps {
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'pink' | 'gray' | 'orange';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  const variants = {
    blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/20 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    orange: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
    red: 'bg-red-500/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    pink: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
    gray: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ================================================
// ICON BUTTON
// ================================================
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, ...props }, ref) => {
    const variants = {
      ghost: cn(
        'transition-theme',
        'text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
      ),
      danger: cn(
        'transition-theme',
        'text-[var(--text-tertiary)] hover:bg-red-500/20 hover:text-red-400'
      ),
    };

    const sizes = {
      sm: 'w-7 h-7',
      md: 'w-9 h-9',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-all',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

// ================================================
// PROGRESS BAR
// ================================================
interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'blue' | 'green' | 'amber' | 'purple' | 'orange';
  className?: string;
}

export function ProgressBar({ value, max = 100, variant = 'blue', className }: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  const variants = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-400',
    green: 'bg-gradient-to-r from-green-500 to-green-400',
    amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-400',
    orange: 'bg-gradient-to-r from-orange-500 to-orange-400',
  };

  return (
    <div className={cn('h-2.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)]', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', variants[variant])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ================================================
// SKELETON
// ================================================
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[var(--bg-tertiary)]',
        className
      )}
    />
  );
}

// ================================================
// SWITCH / TOGGLE
// ================================================
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, disabled, className }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

// ================================================
// DIVIDER
// ================================================
export function Divider({ className }: { className?: string }) {
  return (
    <div className={cn('h-px bg-[var(--border-primary)]', className)} />
  );
}

// ================================================
// TOOLTIP
// ================================================
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group">
      {children}
      <div className={cn(
        'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded z-50',
        'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap',
        'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-lg'
      )}>
        {content}
      </div>
    </div>
  );
}
