"use client";

import { TextareaHTMLAttributes, forwardRef, useEffect, useRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ autoResize = false, className = "", ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || innerRef;

    useEffect(() => {
      if (!autoResize || !ref.current) return;
      const el = ref.current;
      const resize = () => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      };
      el.addEventListener("input", resize);
      resize();
      return () => el.removeEventListener("input", resize);
    }, [autoResize, ref]);

    return (
      <textarea
        ref={ref}
        className={`
          w-full
          bg-[var(--paper)] text-[var(--ink)]
          border border-[var(--border)]
          rounded-[var(--radius-md)]
          px-3 py-2.5
          text-[14px] font-[family-name:var(--font-body)]
          leading-relaxed
          placeholder:text-[var(--ink-faint)]
          focus:outline-none focus:border-[var(--emerald)] focus:ring-1 focus:ring-[var(--emerald)]
          transition-colors duration-150
          resize-none
          ${className}
        `}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
