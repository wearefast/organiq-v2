import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DA304F] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gradient-cta text-white shadow-xs hover:opacity-90',
        navy: 'bg-gradient-secondary-cta text-white shadow-xs hover:opacity-90',
        destructive: 'bg-[#DA304F] text-white shadow-xs hover:opacity-90',
        outline: 'border border-[#E8EAF0] bg-white text-[#111827] shadow-xs hover:bg-[#F8F9FC]',
        secondary: 'bg-[#F8F9FC] text-[#111827] border border-[#E8EAF0] hover:bg-[#F0F1F5]',
        ghost: 'text-[#4B5563] hover:bg-[#F8F9FC] hover:text-[#111827]',
        link: 'text-[#DA304F] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-11 px-7',
        icon: 'h-9 w-9',
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
