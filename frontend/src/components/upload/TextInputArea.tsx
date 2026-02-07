"use client";

import Textarea from "@/components/ui/Textarea";

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TextInputArea({
  value,
  onChange,
  disabled,
}: TextInputAreaProps) {
  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-medium text-[var(--ink-secondary)] tracking-wide uppercase font-[family-name:var(--font-body)]">
        Or type your problem
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Find the derivative of f(x) = 3x⁴ - 2x² + 7x - 5"
        rows={4}
        autoResize
        disabled={disabled}
        className="min-h-[120px]"
      />
    </div>
  );
}
