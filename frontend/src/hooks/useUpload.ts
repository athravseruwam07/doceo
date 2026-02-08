"use client";

import { useState, useCallback } from "react";
import { createSession } from "@/lib/api";

export function useUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [subjectHint, setSubjectHint] = useState<string>("General STEM");
  const [courseId, setCourseId] = useState<string>("");
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
        if (subjectHint.trim()) formData.append("subject_hint", subjectHint.trim());
        if (courseId.trim()) formData.append("course_id", courseId.trim());
        const res = await createSession(formData);
        sessionId = res.session_id;
      } else {
        const res = await createSession({
          problem_text: text.trim(),
          subject_hint: subjectHint.trim() || undefined,
          course_id: courseId.trim() || undefined,
        });
        sessionId = res.session_id;
      }

      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, [file, text, subjectHint, courseId]);

  const reset = useCallback(() => {
    setFile(null);
    setText("");
    setSubjectHint("General STEM");
    setCourseId("");
    setError(null);
  }, []);

  return {
    file,
    setFile,
    text,
    setText,
    subjectHint,
    setSubjectHint,
    courseId,
    setCourseId,
    loading,
    error,
    submit,
    reset,
  };
}
