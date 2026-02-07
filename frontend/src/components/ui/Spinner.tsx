interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 18, className = "" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="var(--border-strong)"
        strokeWidth="2"
      />
      <path
        d="M9 2a7 7 0 0 1 7 7"
        stroke="var(--emerald)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
