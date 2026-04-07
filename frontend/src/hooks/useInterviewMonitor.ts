import { useEffect, useMemo, useRef, useState } from "react";

import { reportProctoringEvent } from "@/services/interview";


export function useInterviewMonitor(sessionId?: string) {
  const [violations, setViolations] = useState<string[]>([]);
  const [typingMetrics, setTypingMetrics] = useState({
    editCount: 0,
    pauseCount: 0,
    typingBursts: 0,
    typingSpeed: 0,
  });
  const lastTypedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const logViolation = async (eventType: string, detail: string) => {
      await reportProctoringEvent({
        session_id: sessionId,
        event_type: eventType,
        detail,
      });
      setViolations((current) => [...current, detail]);
    };

    const onVisibility = () => {
      if (document.hidden) {
        void logViolation("tab_switch", "Tab switch detected");
      }
    };

    const onWindowBlur = () => void logViolation("warning", "Window blur detected");
    const onCopyPaste = () => void logViolation("copy_paste", "Copy or paste detected");
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        void logViolation("fullscreen_exit", "Fullscreen exited");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [sessionId]);

  const onTextInput = (value: string) => {
    const now = Date.now();
    const gap = lastTypedAt.current ? now - lastTypedAt.current : 0;
    lastTypedAt.current = now;
    setTypingMetrics((current) => ({
      editCount: current.editCount + 1,
      pauseCount: current.pauseCount + (gap > 5000 ? 1 : 0),
      typingBursts: current.typingBursts + (gap > 0 && gap < 1200 ? 1 : 0),
      typingSpeed: Math.round((value.length / Math.max(1, now / 1000)) * 10) / 10,
    }));
  };

  return useMemo(
    () => ({
      violations,
      typingMetrics,
      onTextInput,
      setViolations,
    }),
    [typingMetrics, violations],
  );
}
