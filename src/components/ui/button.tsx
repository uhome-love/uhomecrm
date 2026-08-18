import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-600",
        destructive: "bg-danger-500 text-white hover:bg-danger-700",
        success: "bg-success-500 text-success-foreground hover:bg-success-700",
        warning: "bg-warning-500 text-warning-foreground hover:bg-warning-700",
        outline: "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        "outline-success": "border border-success-500/40 bg-background text-success-700 hover:bg-success-50 dark:text-success-500 dark:hover:bg-success-500/10",
        "outline-warning": "border border-warning-500/40 bg-background text-warning-700 hover:bg-warning-50 dark:text-warning-500 dark:hover:bg-warning-500/10",
        "outline-destructive": "border border-danger-500/40 bg-background text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10",
        secondary: "bg-muted text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-sm",
        lg: "h-10 rounded-md px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
