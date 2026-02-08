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

    cleanup();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData([]);
    setError(null);
    setIsComplete(false);

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setIsConnected(true);

    source.addEventListener("step", (e) => {
      try {
        const parsed = JSON.parse(e.data) as T;
        setData((prev) => [...prev, parsed]);
      } catch {
        // skip malformed events
      }
    });

    source.addEventListener("complete", (e) => {
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
      setError("Connection lost. The lesson may still be loading.");
      setIsConnected(false);
      source.close();
    };

    return cleanup;
  }, [url, cleanup]);

  return { data, isConnected, error, isComplete };
}
