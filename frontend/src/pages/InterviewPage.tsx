import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Copy,
  Loader2,
  Mic,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

import { AssistantPanel } from "@/components/interview/AssistantPanel";
import { LiveCodingWorkspace } from "@/components/interview/LiveCodingWorkspace";
import { useInterviewMonitor } from "@/hooks/useInterviewMonitor";
import {
  joinInterview,
  reportProctoringEvent,
  sendHeartbeat,
  submitAnswer,
  terminateInterview,
  timeoutInterview,
  validateInterview,
} from "@/services/interview";

function useCountdown(initialSeconds: number, enabled: boolean) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!enabled || timeLeft <= 0) {
      return;
    }
    const timer = window.setInterval(
      () => setTimeLeft((current) => current - 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [enabled, timeLeft]);

  return timeLeft;
}

export function InterviewPage() {
  const navigate = useNavigate();
  const { accessToken = "" } = useParams();
  const sessionStorageKey = `interview-session-token:${accessToken}`;
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [sessionToken, setSessionToken] = useState<string>(
    () => window.sessionStorage.getItem(sessionStorageKey) || "",
  );
  const [skillProgress, setSkillProgress] = useState<Record<string, unknown>>(
    {},
  );
  const [question, setQuestion] = useState<any>(null);
  const [progress, setProgress] = useState({
    current_question: 1,
    total_questions: 1,
  });
  const [answer, setAnswer] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [warningBanner, setWarningBanner] = useState<string | null>(null);
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const validation = useQuery({
    queryKey: ["interview-validation", accessToken],
    queryFn: () => validateInterview(accessToken),
    enabled: Boolean(accessToken),
  });
  const countdown = useCountdown(
    (validation.data?.time_limit || 0) * 60,
    started,
  );
  const monitor = useInterviewMonitor(sessionId);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const syncVideoStream = useCallback(async () => {
    const stream = streamRef.current;
    const element = videoRef.current;
    if (!stream || !element) {
      return;
    }

    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }

    try {
      await element.play();
    } catch {
      // Browser autoplay policies may require the next user interaction.
    }
  }, []);

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    const [videoTrack] = stream.getVideoTracks();
    const [audioTrack] = stream.getAudioTracks();
    setCameraReady(Boolean(videoTrack?.enabled));
    setMicReady(Boolean(audioTrack?.enabled));
    setCameraDisconnected(false);
    void syncVideoStream();
    videoTrack?.addEventListener("ended", () => {
      setCameraDisconnected(true);
      setCameraReady(false);
      setWarningBanner("Camera disconnected");
      toast.error("Camera disconnected");
      if (sessionId) {
        void reportProctoringEvent({
          session_id: sessionId,
          event_type: "warning",
          detail: "Camera disconnected during interview",
        });
      }
    });
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      attachStream(stream);
      toast.success("Camera and microphone ready");
      setCameraError("");
    } catch {
      setCameraError(
        "Camera and microphone permissions are required to begin.",
      );
      toast.error("Camera and microphone permissions are required");
    }
  };

  useEffect(() => {
    void syncVideoStream();
  }, [started, syncVideoStream]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    window.sessionStorage.setItem(sessionStorageKey, sessionToken);
  }, [sessionStorageKey, sessionToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    setSessionToken(window.sessionStorage.getItem(sessionStorageKey) || "");
  }, [accessToken, sessionStorageKey]);

  const startMutation = useMutation({
    mutationFn: async () =>
      joinInterview({
        access_token: accessToken,
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail.trim(),
      }),

    onSuccess: async (startData) => {
      if (!cameraReady || !micReady) {
        toast.error("Camera and microphone must stay active");
        return;
      }

      // ✅ Set session data
      setSessionId(startData.session_id);
      setSessionToken(startData.session_token);
      setSkillProgress(startData.skill_progress || {});

      window.sessionStorage.setItem(sessionStorageKey, startData.session_token);

      // ✅ Set question + progress
      setStarted(true);
      setQuestion(startData.question || startData.next_question);
      setProgress({
        current_question: startData.current_question,
        total_questions: startData.total_questions,
      });

      setWarningBanner(startData.warnings?.[0] || null);

      // ✅ Fullscreen
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        toast("Fullscreen could not be enabled", { icon: "!" });
      }
    },

    onError: (error: any) => {
      const detail = error?.response?.data?.detail;

      if (
        detail === "Interview already completed" ||
        detail === "Interview already ended" ||
        detail === "Interview already timed out"
      ) {
        toast(detail);

        const resolvedSessionToken =
          sessionToken ||
          window.sessionStorage.getItem(sessionStorageKey) ||
          "";

        navigate(`/result/${accessToken}?session=${resolvedSessionToken}`);
        return;
      }

      toast.error(detail || "Unable to start interview");
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitAnswer({
        session_token: sessionToken,
        question_id: question.id,
        answer_text: answer,
        time_taken_seconds: Math.max(
          0,
          (validation.data?.time_limit || 0) * 60 - countdown,
        ),
        typing_metrics: monitor.typingMetrics,
      }),
    onSuccess: (data) => {
      if (data.final_evaluation) {
        toast.success("Interview completed");
        navigate(`/result/${accessToken}?session=${sessionToken}`);
        return;
      }
      setQuestion(data.next_question);
      setProgress(data.progress);
      setSkillProgress(data.skill_progress || {});
      setWarningBanner(
        data.authenticity.rating === "low"
          ? "Authenticity warning: answer pattern looks assisted."
          : null,
      );
      setAnswer("");
      localStorage.removeItem(`draft-${question.id}`);
      monitor.reset(); // Reset typing metrics and violations for next question
      toast.success("Answer submitted");
    },
    onError: () => {
      toast.error("Answer submission failed. Please try again.");
    },
  });

  useEffect(() => {
    if (started && countdown === 0) {
      toast("Time is up. Finalizing interview...");
      if (!sessionToken) {
        return;
      }
      void timeoutInterview({
        session_token: sessionToken,
        question_id: question?.question_type === "text" ? question.id : undefined,
        current_answer: question?.question_type === "text" ? answer : "",
        time_taken_seconds: Math.max(
          0,
          (validation.data?.time_limit || 0) * 60,
        ),
        typing_metrics: monitor.typingMetrics,
      }).finally(() => {
        navigate(`/result/${accessToken}?session=${sessionToken}`);
      });
    }
  }, [
    accessToken,
    answer,
    countdown,
    monitor.typingMetrics,
    navigate,
    question,
    sessionToken,
    started,
    validation.data?.time_limit,
  ]);

  useEffect(() => {
    if (!started || !sessionToken) {
      return;
    }
    const interval = window.setInterval(() => {
      void sendHeartbeat(sessionToken);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [sessionToken, started]);

  useEffect(() => {
    if (!started || !sessionToken || isTerminating) {
      return;
    }

    const handleBeforeUnload = () => {
      void terminateInterview(sessionToken);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isTerminating, sessionToken, started]);

  useEffect(() => {
    if (!sessionId || !started) {
      return;
    }
    const interval = window.setInterval(() => {
      const eventType = Math.random() > 0.7 ? "multiple_face" : "no_face";
      void reportProctoringEvent({
        session_id: sessionId,
        event_type: eventType,
        detail:
          eventType === "multiple_face"
            ? "Multiple faces detected"
            : "No face detected",
        metadata: { source: "mock-face-detector" },
      });
      setWarningBanner(
        eventType === "multiple_face"
          ? "Multiple faces detected"
          : "No face detected",
      );
    }, 45000);
    return () => window.clearInterval(interval);
  }, [sessionId, started]);

  useEffect(() => {
    if (!question?.id) {
      return;
    }
    localStorage.setItem(`draft-${question.id}`, answer);
  }, [answer, question?.id]);

  useEffect(() => {
    if (!question?.id) {
      return;
    }
    setAnswer(localStorage.getItem(`draft-${question.id}`) || "");
  }, [question?.id]);

  useEffect(() => {
    if (!monitor.violations.length) {
      return;
    }
    setWarningBanner(monitor.violations[monitor.violations.length - 1]);
    toast(monitor.violations[monitor.violations.length - 1], { icon: "!" });
  }, [monitor.violations]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const timerText = useMemo(() => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [countdown]);

  const orderedSkills = useMemo(
    () =>
      (validation.data?.skill_graph ||
        validation.data?.topics ||
        []) as string[],
    [validation.data?.skill_graph, validation.data?.topics],
  );

  const startVoiceAnswer = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsRecordingAnswer(true);
    recognition.onend = () => setIsRecordingAnswer(false);
    recognition.onerror = () => {
      setIsRecordingAnswer(false);
      toast.error("Voice input failed");
    };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .map((item: any) => item[0]?.transcript || "")
        .join(" ")
        .trim();
      if (!transcript) {
        return;
      }
      setAnswer((current) =>
        `${current}${current ? " " : ""}${transcript}`.trim(),
      );
      monitor.onTextInput(transcript);
      toast.success("Voice input added");
    };
    speechRecognitionRef.current = recognition;
    recognition.start();
  };

  const bindVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      void syncVideoStream();
    },
    [syncVideoStream],
  );

  const handleTerminate = useCallback(async () => {
    if (!sessionToken || isTerminating) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to end the interview? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setIsTerminating(true);
    try {
      await terminateInterview(sessionToken);
      navigate(`/result/${accessToken}?session=${sessionToken}`);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail ||
          "Failed to terminate session. Please try again.",
      );
      setIsTerminating(false);
    }
  }, [accessToken, isTerminating, navigate, sessionToken]);

  if (!started) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_50%,#dbeafe_100%)] px-4 py-8 text-slate-900 dark:bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] dark:text-white">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-card p-8">
            <p className="section-label">Pre-interview verification</p>
            <h1 className="mt-2 text-4xl font-semibold">
              {validation.data?.title}
            </h1>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-slate-100 p-4 dark:bg-white/5">
                Role: {validation.data?.job_role}
              </div>
              <div className="rounded-3xl bg-slate-100 p-4 dark:bg-white/5">
                Questions: {validation.data?.question_count}
              </div>
              <div className="rounded-3xl bg-slate-100 p-4 dark:bg-white/5">
                Time limit: {validation.data?.time_limit} mins
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Candidate name
                </label>
                <input
                  className="input-premium"
                  placeholder="Enter your full name"
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Candidate email
                </label>
                <input
                  className="input-premium"
                  placeholder="Enter your email"
                  type="email"
                  value={candidateEmail}
                  onChange={(event) => setCandidateEmail(event.target.value)}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {validation.data?.attempted_count ?? 0} candidates have attempted
              this interview so far.
            </p>
            <div className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-900 dark:text-cyan-100">
              Camera and microphone must remain active. Tab switches, fullscreen
              exits, copy/paste attempts, and camera anomalies are logged and
              sent into final evaluation.
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="button-primary" onClick={requestPermissions}>
                <Camera className="mr-2 inline h-4 w-4" />
                Enable camera and microphone
              </button>
              <button
                className="button-secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast.success("Link copied!"))
                }
              >
                <Copy className="mr-2 inline h-4 w-4" />
                Copy interview link
              </button>
            </div>

            {cameraError && (
              <p className="mt-3 text-sm text-rose-500">{cameraError}</p>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div
                className={`rounded-3xl p-4 ${cameraReady ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-slate-100 dark:bg-white/5"}`}
              >
                <Camera className="mb-2 h-5 w-5" />
                Camera {cameraReady ? "active" : "not ready"}
              </div>
              <div
                className={`rounded-3xl p-4 ${micReady ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-slate-100 dark:bg-white/5"}`}
              >
                <Mic className="mb-2 h-5 w-5" />
                Microphone {micReady ? "active" : "not ready"}
              </div>
            </div>
          </section>

          <section className="glass-card overflow-hidden p-4">
            <div className="aspect-video rounded-[24px] bg-slate-950">
              <video
                ref={bindVideoNode}
                className="h-full w-full rounded-[24px] object-cover"
                autoPlay
                muted
                playsInline
              />
            </div>
            <button
              className="button-primary mt-4 w-full"
              disabled={
                !cameraReady ||
                !micReady ||
                !candidateName.trim() ||
                !candidateEmail.trim() ||
                startMutation.isPending
              }
              onClick={() => {
                startMutation.mutate();
              }}
            >
              {startMutation.isPending ? "Preparing session..." : "Start interview"}
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_50%,#dbeafe_100%)] text-slate-900 dark:bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] dark:text-white">
      {isTerminating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/90 px-8 py-7 text-center text-white shadow-2xl">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
            <p className="mt-4 text-lg font-semibold">Saving your progress...</p>
            <p className="mt-2 text-sm text-slate-300">
              Please keep this tab open while we end the interview.
            </p>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <div>
            <p className="section-label">Interview in progress</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {validation.data?.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {orderedSkills.map((skill) => (
                <span
                  key={skill}
                  className={`rounded-full px-3 py-1 text-xs ${
                    (question?.skill || skillProgress.current_skill) === skill
                      ? "bg-cyan-500 text-white"
                      : "border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 font-semibold text-cyan-900 dark:text-cyan-100">
              {timerText}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-white/5">
              Question {progress.current_question} / {progress.total_questions}
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
              Violations {monitor.violations.length}
            </div>
          </div>
        </div>
        {warningBanner && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {warningBanner}
          </div>
        )}
      </header>

      {question?.question_type === "coding" ? (
        <div className="mx-auto max-w-[96rem] p-4 lg:p-6">
          <LiveCodingWorkspace
            sessionId={sessionId}
            sessionToken={sessionToken}
            question={question}
            monitor={monitor}
            cameraDisconnected={cameraDisconnected}
            bindVideoNode={bindVideoNode}
            isTerminating={isTerminating}
            onTerminate={handleTerminate}
            onAdvance={(nextQuestion, nextSkillProgress) => {
              setQuestion(nextQuestion);
              setProgress((current) => ({
                current_question: nextQuestion.sequence,
                total_questions: current.total_questions,
              }));
              setSkillProgress(nextSkillProgress || {});
              setWarningBanner(null);
            }}
            onFinished={() =>
              navigate(`/result/${accessToken}?session=${sessionToken}`)
            }
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:items-start lg:p-6">
          <div className="space-y-6">
            <section className="glass-card overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-label">{question?.difficulty}</p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {question?.question_text}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-700 dark:text-cyan-200">
                      Skill: {question?.skill || question?.topic}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-white/5 dark:text-slate-300">
                      Difficulty: {question?.difficulty}
                    </span>
                    {question?.adaptive_metadata?.accuracyBand && (
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-200">
                        Adaptive:{" "}
                        {String(question.adaptive_metadata.accuracyBand)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
                  Topic: {question?.topic}
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {question?.hints?.map((hint: string) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>

              <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Your answer
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Keep it structured. Drafts are autosaved for this
                      question.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      {answer.trim().split(/\s+/).filter(Boolean).length} words
                    </div>
                    <button
                      type="button"
                      className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                      onClick={startVoiceAnswer}
                      disabled={isRecordingAnswer || isTerminating}
                    >
                      {isRecordingAnswer ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                      {isRecordingAnswer ? "Listening..." : "Voice input"}
                    </button>
                  </div>
                </div>

                <textarea
                  className="input-premium h-80 resize-none bg-white dark:bg-slate-950/60"
                  placeholder="Write your answer here..."
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    monitor.onTextInput(event.target.value);
                  }}
                  disabled={isTerminating}
                />

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">
                    Typing speed: {monitor.typingMetrics.typingSpeed}
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">
                    Pauses: {monitor.typingMetrics.pauseCount}
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">
                    Edits: {monitor.typingMetrics.editCount}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-5 dark:border-white/10">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review once, then submit to move to the next question.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="button-primary inline-flex items-center gap-2 disabled:bg-cyan-500/60 disabled:hover:bg-cyan-500/60"
                    disabled={!answer.trim() || submitMutation.isPending || isTerminating}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {submitMutation.isPending
                      ? "Submitting..."
                      : "Submit answer"}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      void handleTerminate();
                    }}
                    disabled={isTerminating}
                  >
                    {isTerminating ? "Ending interview..." : "End interview"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6 lg:sticky lg:top-28">
            <section className="glass-card overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                  <span className="font-medium">Live proctor feed</span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${cameraDisconnected ? "bg-rose-500/10 text-rose-600 dark:text-rose-200" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"}`}
                >
                  {cameraDisconnected ? "Camera disconnected" : "Camera on"}
                </span>
              </div>
              <div className="aspect-video rounded-[24px] bg-slate-950">
                <video
                  ref={bindVideoNode}
                  className="h-full w-full rounded-[24px] object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Face presence checks are mock-enabled. No-face and multiple-face
                signals are recorded as interview events.
              </p>
            </section>

            <AssistantPanel
              sessionToken={sessionToken}
              questionId={question?.id}
              currentAnswer={answer}
              disabled={isTerminating}
            />
          </div>
        </div>
      )}
    </div>
  );
}
