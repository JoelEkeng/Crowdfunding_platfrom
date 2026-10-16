import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-lime-300 px-5 py-3 text-slate-950 hover:bg-lime-200",
        secondary:
          "border border-white/15 bg-white/5 px-5 py-3 text-white hover:bg-white/10",
        ghost: "px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white",
        danger: "bg-rose-500/15 px-5 py-3 text-rose-200 hover:bg-rose-500/25",
      },
      size: {
        default: "min-h-11",
        sm: "min-h-9 px-3 py-2",
        lg: "min-h-13 px-7 py-4",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
