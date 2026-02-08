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
  const [subjectHint, setSubjectHint] = useState<string>("General STEM");
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
          if (subjectHint.trim()) formData.append("subject_hint", subjectHint.trim());
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
            subject_hint: subjectHint.trim() || undefined,
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
    [file, text, subjectHint, courseId]
  );

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
