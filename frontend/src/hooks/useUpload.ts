"use client";

import { useState, useCallback } from "react";
import { createSession } from "@/lib/api";

export function useUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (): Promise<string | null> => {
    if (!file && !text.trim()) {
      setError("Please upload an image or type a problem.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let sessionId: string;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        if (text.trim()) formData.append("problem_text", text.trim());
        const res = await createSession(formData);
        sessionId = res.session_id;
      } else {
        const res = await createSession({ problem_text: text.trim() });
        sessionId = res.session_id;
      }

      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, [file, text]);

  const reset = useCallback(() => {
    setFile(null);
    setText("");
    setError(null);
  }, []);

  return { file, setFile, text, setText, loading, error, submit, reset };
}
