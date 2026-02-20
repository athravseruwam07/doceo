"use client";

import { useState, useCallback } from "react";
import { createMicroSession, createSession } from "@/lib/api";

interface SubmitOptions {
  microLesson?: boolean;
  includeVoice?: boolean;
}

export function useUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (options: SubmitOptions = {}): Promise<string | null> => {
      const useMicroLesson = options.microLesson === true;
      const includeVoice = options.includeVoice !== false;

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
          if (courseId.trim()) formData.append("course_id", courseId.trim());
          if (useMicroLesson) {
            formData.append("include_voice", includeVoice ? "true" : "false");
          }
          const res = useMicroLesson
            ? await createMicroSession(formData)
            : await createSession(formData);
          sessionId = res.session_id;
        } else {
          const payload = {
            problem_text: text.trim(),
            course_id: courseId.trim() || undefined,
          };
          const res = useMicroLesson
            ? await createMicroSession({
                ...payload,
                include_voice: includeVoice,
              })
            : await createSession(payload);
          sessionId = res.session_id;
        }

        return sessionId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [file, text, courseId]
  );

  const reset = useCallback(() => {
    setFile(null);
    setText("");
    setCourseId("");
    setError(null);
  }, []);

  return {
    file,
    setFile,
    text,
    setText,
    courseId,
    setCourseId,
    loading,
    error,
    submit,
    reset,
  };
}
