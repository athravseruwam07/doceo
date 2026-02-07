interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "emerald";
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const styles = {
    default:
      "bg-[var(--cream-dark)] text-[var(--ink-secondary)] border-[var(--border)]",
    emerald:
      "bg-[var(--emerald-subtle)] text-[var(--emerald)] border-[var(--emerald-subtle)]",
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        text-[12px] font-medium font-[family-name:var(--font-body)]
        tracking-wide uppercase
        border rounded-full
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
