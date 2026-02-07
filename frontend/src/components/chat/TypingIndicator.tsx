"use client";

export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 px-3.5 py-2.5 bg-[var(--paper-warm)] border border-[var(--border)] rounded-[var(--radius-md)] rounded-bl-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--ink-faint)]"
            style={{
              animation: `dot-pulse 1.2s infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
