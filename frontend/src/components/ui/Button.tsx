"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)] active:brightness-95",
  secondary:
    "bg-transparent text-[var(--ink)] border border-[var(--border-strong)] hover:border-[var(--ink-faint)] hover:bg-[var(--cream-dark)]",
  ghost:
    "bg-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)]",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-4 py-2 text-[14px]",
  lg: "px-6 py-2.5 text-[15px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-[family-name:var(--font-body)] font-medium
          rounded-[var(--radius-md)]
          transition-all duration-150 ease-out
          cursor-pointer select-none
          disabled:opacity-40 disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export default Button;
