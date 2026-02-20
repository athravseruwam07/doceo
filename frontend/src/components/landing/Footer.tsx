import Link from "next/link";

export default function Footer() {
  return (
    <footer className="landing-shell border-t border-[var(--border)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-[24px] text-[var(--ink)]">Doceo</p>
          <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">Interactive STEM tutoring with context-aware guidance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--ink-secondary)]">
          <a href="#how-it-works" className="hover:text-[var(--ink)]">How it works</a>
          <a href="#features" className="hover:text-[var(--ink)]">Features</a>
          <a href="#exam-cram" className="hover:text-[var(--ink)]">Exam Cram</a>
          <a href="#faq" className="hover:text-[var(--ink)]">FAQ</a>
          <Link href="/auth/signin" className="hover:text-[var(--ink)]">Sign in</Link>
          <Link href="/auth/signup" className="hover:text-[var(--ink)]">Get started</Link>
        </div>
      </div>

      <p className="mx-auto mt-5 w-full max-w-6xl text-[12px] text-[var(--ink-faint)]">
        © {new Date().getFullYear()} Doceo. Built for students who want to understand, not memorize.
      </p>
    </footer>
  );
}
