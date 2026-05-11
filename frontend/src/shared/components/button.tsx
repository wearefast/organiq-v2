import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-semibold transition-[opacity,colors,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gradient-cta text-white shadow-sm hover:opacity-90',
        navy: 'bg-gradient-secondary-cta text-white shadow-sm hover:opacity-90',
        destructive: 'bg-[var(--cc-red-dark)] text-white shadow-sm hover:opacity-90',
        outline: 'border border-[var(--border)] bg-[var(--canvas)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--surface)]',
        secondary: 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--section-tint)]',
        ghost: 'text-[var(--text-body)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]',
        link: 'text-[var(--cc-red)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-11 px-7',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
