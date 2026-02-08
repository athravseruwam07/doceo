"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEResult<T> {
  data: T[];
  isConnected: boolean;
  error: string | null;
  isComplete: boolean;
}

export function useSSE<T = unknown>(url: string | null): UseSSEResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!url) return;

    // Guard flag to prevent stale event handlers from firing after cleanup
    let active = true;

    cleanup();
    queueMicrotask(() => {
      if (!active) return;
      setData([]);
      setError(null);
      setIsComplete(false);
    });

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      if (!active) return;
      setIsConnected(true);
      setError(null);
    };

    source.addEventListener("step", (e) => {
      if (!active) return;
      try {
        const parsed = JSON.parse(e.data) as T;
        setData((prev) => [...prev, parsed]);
      } catch {
        // skip malformed events
      }
    });

    source.addEventListener("complete", (e) => {
      if (!active) return;
      try {
        const parsed = JSON.parse(e.data) as T;
        setData((prev) => [...prev, parsed]);
      } catch {
        // skip
      }
      setIsComplete(true);
      source.close();
      setIsConnected(false);
    });

    source.onerror = () => {
      if (!active) return;
      // Let EventSource auto-reconnect instead of hard-closing on transient errors.
      setError("Connection interrupted. Reconnecting...");
      setIsConnected(false);
    };

    return () => {
      active = false;
      cleanup();
    };
  }, [url, cleanup]);

  return { data, isConnected, error, isComplete };
}
