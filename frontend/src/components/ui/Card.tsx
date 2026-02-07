import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export default function Card({
  hover = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-[var(--paper)] border border-[var(--border)]
        rounded-[var(--radius-md)]
        ${hover ? "transition-shadow duration-200 hover:shadow-[var(--shadow-md)]" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
