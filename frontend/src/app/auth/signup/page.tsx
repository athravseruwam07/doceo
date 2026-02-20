"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void getProviders().then((providers) => {
      if (!active) return;
      setGoogleEnabled(Boolean(providers?.google));
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/app",
      });

      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--cream)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-[family-name:var(--font-heading)] text-[28px] font-semibold text-[var(--ink)]">
            Doceo
          </Link>
          <p className="mt-2 text-[14px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
            Create your account
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-6 shadow-[var(--shadow-md)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] text-[var(--ink-tertiary)] mb-1 font-[family-name:var(--font-body)]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)] font-[family-name:var(--font-body)]"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--ink-tertiary)] mb-1 font-[family-name:var(--font-body)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)] font-[family-name:var(--font-body)]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--ink-tertiary)] mb-1 font-[family-name:var(--font-body)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)] font-[family-name:var(--font-body)]"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--ink-tertiary)] mb-1 font-[family-name:var(--font-body)]">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)] font-[family-name:var(--font-body)]"
                placeholder="Repeat your password"
              />
            </div>

            {error && (
              <p className="text-[13px] text-[var(--error)] font-[family-name:var(--font-body)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--emerald)] text-white text-[14px] font-medium hover:bg-[var(--emerald-dark)] transition-colors disabled:opacity-60 cursor-pointer font-[family-name:var(--font-body)]"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--paper)] px-3 text-[12px] text-[var(--ink-faint)] font-[family-name:var(--font-body)]">
                or continue with
              </span>
            </div>
          </div>

          {googleEnabled ? (
            <button
              onClick={() => signIn("google", { callbackUrl: "/app" })}
              className="w-full py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--ink)] hover:bg-[var(--cream-dark)] transition-colors cursor-pointer font-[family-name:var(--font-body)] flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </button>
          ) : (
            <p className="text-[12px] text-[var(--ink-tertiary)] text-center">
              Google sign-in is unavailable until OAuth credentials are configured.
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[13px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-[var(--emerald)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
