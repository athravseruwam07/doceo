"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#exam-cram", label: "Exam Cram" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      className={`landing-shell fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-lg"
          : "bg-transparent"
      }`}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-[26px] font-semibold tracking-tight text-[var(--ink)]"
        >
          Doceo
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/signin"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full bg-[var(--emerald)] px-4 py-2 text-[13px] font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:translate-y-[-1px] hover:bg-[var(--emerald-dark)]"
          >
            Get started
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
