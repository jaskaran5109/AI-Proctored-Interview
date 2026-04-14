import Editor from "@monaco-editor/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { AssistantPanel } from "@/components/interview/AssistantPanel";
import {
  autosaveCode,
  fetchCodeRuntimeSupport,
  generateStarterCode,
  reportProctoringEvent,
  runQuestionCode,
  submitCode,
} from "@/services/interview";
import { InterviewQuestion } from "@/types/api";

type MonitorShape = {
  violations: string[];
  typingMetrics: {
    editCount: number;
    pauseCount: number;
    typingSpeed: number;
  };
  onTextInput: (value: string) => void;
  reset: () => void;
};

export function LiveCodingWorkspace({
  sessionId,
  sessionToken,
  question,
  monitor,
  cameraDisconnected,
  bindVideoNode,
  isTerminating,
  onTerminate,
  onAdvance,
  onFinished,
}: {
  sessionId?: string;
  sessionToken?: string;
  question: InterviewQuestion;
  monitor: MonitorShape;
  cameraDisconnected: boolean;
  bindVideoNode: (node: HTMLVideoElement | null) => void;
  isTerminating: boolean;
  onTerminate: () => Promise<void>;
  onAdvance: (
    nextQuestion: InterviewQuestion,
    nextSkillProgress?: Record<string, unknown>,
  ) => void;
  onFinished: () => void;
}) {
  const defaultLanguage =
    question.language || question.supported_languages?.[0] || "javascript";
  const [language, setLanguage] = useState(defaultLanguage);
  const [starterCodeMap, setStarterCodeMap] = useState<Record<string, string>>(
    question.starter_code || {},
  );
  const [languageSnapshots, setLanguageSnapshots] = useState<Record<string, string>>(
    {},
  );
  const [dirtyLanguages, setDirtyLanguages] = useState<Record<string, boolean>>(
    {},
  );
  const [code, setCode] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [stderr, setStderr] = useState("");
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [customRunResult, setCustomRunResult] = useState<{
    input: string;
    output: string;
    error?: string;
  } | null>(null);
  const [testResults, setTestResults] = useState<
    Array<Record<string, unknown>>
  >(
    Array.isArray((question.execution_result as any)?.results)
      ? ((question.execution_result as any).results as Array<
          Record<string, unknown>
        >)
      : [],
  );
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    (question.ai_analysis as Record<string, unknown>) || null,
  );
  const lastSavedCode = useRef(code);
  const previousCodeLength = useRef(code.length);

  const isGenericStarterCode = (value?: string) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    return [
      /^class main \{ public static void main\(string\[] args\) \{\} \}$/i,
      /^int main\(\)\s*\{\s*return 0;\s*\}$/i,
      /^function solve\(input\)/i,
      /^def solve\(raw/i,
    ].some((pattern) => pattern.test(normalized));
  };

  const starterCodeForLanguage = useMemo(
    () => starterCodeMap?.[language] || "",
    [language, starterCodeMap],
  );
  const runtimeSupportQuery = useQuery({
    queryKey: ["code-runtime-support"],
    queryFn: fetchCodeRuntimeSupport,
  });
  const runtimeSupport = useMemo(
    () => runtimeSupportQuery.data?.runtimes || {},
    [runtimeSupportQuery.data?.runtimes],
  );
  const availableLanguages = useMemo(
    () =>
      (question.supported_languages || ["javascript", "python", "java", "cpp"]).filter(
        (item) => runtimeSupport[item] ?? true,
      ),
    [question.supported_languages, runtimeSupport],
  );

  useEffect(() => {
    const nextLanguage =
      question.language || question.supported_languages?.[0] || "javascript";
    const nextCode =
      question.draft_code ||
      question.starter_code?.[nextLanguage] ||
      "";
    setLanguage(nextLanguage);
    setStarterCodeMap(question.starter_code || {});
    setLanguageSnapshots(
      Object.fromEntries(
        (question.supported_languages || ["javascript", "python", "java", "cpp"]).map(
          (item) => [item, item === nextLanguage ? nextCode : ""],
        ),
      ),
    );
    setDirtyLanguages(
      Object.fromEntries(
        (question.supported_languages || ["javascript", "python", "java", "cpp"]).map(
          (item) => [item, false],
        ),
      ),
    );
    setCode(nextCode);
    setOutput("");
    setStderr("");
    setExecutionTime(null);
    setCustomRunResult(null);
    setTestResults(
      Array.isArray((question.execution_result as any)?.results)
        ? ((question.execution_result as any).results as Array<
            Record<string, unknown>
          >)
        : [],
    );
    setAnalysis((question.ai_analysis as Record<string, unknown>) || null);
    lastSavedCode.current = nextCode;
    previousCodeLength.current = nextCode.length;
  }, [question]);

  useEffect(() => {
    if (!availableLanguages.length) {
      return;
    }
    if (!availableLanguages.includes(language)) {
      const nextLanguage = availableLanguages[0];
      setLanguage(nextLanguage);
      setCode(starterCodeMap?.[nextLanguage] || "");
    }
  }, [availableLanguages, language, starterCodeMap]);

  const starterCodeMutation = useMutation({
    mutationFn: (nextLanguage: string) =>
      generateStarterCode({
        questionId: question.id,
        language: nextLanguage,
        title: question.title || question.question_text,
        description: question.description || question.question_text,
      }),
  });

  useEffect(() => {
    if (!question.id || !language) {
      return;
    }

    if (!isGenericStarterCode(starterCodeMap?.[language])) {
      return;
    }

    if (starterCodeMutation.isPending) {
      return;
    }

    starterCodeMutation.mutate(language, {
      onSuccess: (data) => {
        const generatedCode = data.starterCode || "";
        setStarterCodeMap((current) => ({
          ...current,
          [language]: generatedCode,
        }));
        setLanguageSnapshots((current) => ({
          ...current,
          [language]:
            current[language] && current[language].trim()
              ? current[language]
              : generatedCode,
        }));
        setCode((current) =>
          dirtyLanguages[language] && current.trim() ? current : generatedCode,
        );
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.detail || "Failed to generate starter code",
        );
      },
    });
  }, [
    dirtyLanguages,
    language,
    question.description,
    question.id,
    question.question_text,
    question.title,
    starterCodeMap,
    starterCodeMutation,
  ]);

  const autosaveMutation = useMutation({
    mutationFn: autosaveCode,
    onSuccess: () => {
      lastSavedCode.current = code;
    },
  });
  const autosaveDraft = autosaveMutation.mutateAsync;

  useEffect(() => {
    if (!question.id || code === lastSavedCode.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!sessionToken) {
        return;
      }
      void autosaveDraft({
        session_token: sessionToken,
        question_id: question.id,
        language,
        code,
      });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [autosaveDraft, code, language, question.id, sessionToken]);

  const runMutation = useMutation({
    mutationFn: () =>
      runQuestionCode({
        session_token: sessionToken || "",
        question_id: question.id,
        language,
        code,
        custom_input: customInput,
        use_custom_input: true,
      }),
    onSuccess: (data) => {
      setOutput(data.output || "");
      setStderr(data.error || "");
      setExecutionTime(data.executionTime);
      setTestResults(
        (data.testResults ||
          data.results ||
          []) as Array<Record<string, unknown>>,
      );
      setCustomRunResult((data.customInputResult as any) || null);
      if (!data.error) {
        toast.success("Code executed successfully");
      } else {
        toast.error("Compilation error");
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Code execution failed");
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitCode({
        session_token: sessionToken || "",
        question_id: question.id,
        language,
        code,
      }),
    onSuccess: (data) => {
      setTestResults(data.results as Array<Record<string, unknown>>);
      setAnalysis(data.aiAnalysis);
      setExecutionTime(data.executionTime);
      setOutput("");
      setStderr("");
      monitor.reset(); // Reset typing metrics for next question
      toast.success(
        data.passedCount === data.totalCount
          ? "All test cases passed"
          : "Some test cases failed",
      );
      if (data.next_question) {
        onAdvance(data.next_question, data.skill_progress);
        return;
      }
      if (data.final_evaluation || data.status === "completed") {
        onFinished();
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Submission failed");
    },
  });

  const handleEditorChange = (value: string | undefined) => {
    const nextValue = value || "";
    const delta = nextValue.length - previousCodeLength.current;
    previousCodeLength.current = nextValue.length;
    setCode(nextValue);
    setLanguageSnapshots((current) => ({
      ...current,
      [language]: nextValue,
    }));
    setDirtyLanguages((current) => ({
      ...current,
      [language]: nextValue !== (starterCodeMap?.[language] || ""),
    }));
    monitor.onTextInput(nextValue);

    if (delta > 140 && sessionId) {
      void reportProctoringEvent({
        session_id: sessionId,
        event_type: "code_paste",
        detail: "Large code paste detected",
        metadata: { inserted_characters: delta },
      });
      toast.error("Large code paste detected");
    }
  };

  const changeLanguage = async (nextLanguage: string) => {
    if (nextLanguage === language) {
      return;
    }

    if (dirtyLanguages[language]) {
      const confirmed = window.confirm(
        "Switching languages will replace the editor with that language's starter code. Continue?",
      );
      if (!confirmed) {
        return;
      }
    }

    const nextStarter = starterCodeMap?.[nextLanguage] || "";
    const nextCode = languageSnapshots?.[nextLanguage] || nextStarter;
    setLanguage(nextLanguage);
    setCode(nextCode);
    previousCodeLength.current = nextCode.length;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.25fr_0.85fr]">
      <section className="glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">Coding challenge</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {question.title || question.question_text}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {question.description}
            </p>
          </div>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-100">
            {question.difficulty}
          </span>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Constraints
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {(question.constraints || []).map((item) => (
              <li
                key={item}
                className="rounded-2xl bg-white px-3 py-2 dark:bg-slate-900/80"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Sample test cases
          </p>
          <div className="mt-3 space-y-3">
            {(question.sample_test_cases || []).map((item, index) => (
              <div
                key={`${item.input}-${index}`}
                className="rounded-2xl bg-white p-3 text-sm dark:bg-slate-900/80"
              >
                <p className="font-medium text-slate-900 dark:text-white">
                  Case {index + 1}
                </p>
                <p className="mt-2 text-slate-500 dark:text-slate-400">Input</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                  {item.input}
                </pre>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  Expected output
                </p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                  {item.expected_output}
                </pre>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              Hidden cases: {question.hidden_test_case_count || 0}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              value={language}
              onChange={(event) => {
                void changeLanguage(event.target.value);
              }}
              disabled={isTerminating}
            >
              {(
                question.supported_languages || [
                  "javascript",
                  "python",
                  "java",
                  "cpp",
                ]
              ).map((item) => (
                <option key={item} value={item} disabled={runtimeSupport[item] === false}>
                  {item}{runtimeSupport[item] === false ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Autosave {autosaveMutation.isPending ? "saving..." : "enabled"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="button-secondary inline-flex items-center gap-2"
              onClick={() => {
                setCode(starterCodeForLanguage);
                previousCodeLength.current = starterCodeForLanguage.length;
                setLanguageSnapshots((current) => ({
                  ...current,
                  [language]: starterCodeForLanguage,
                }));
                setDirtyLanguages((current) => ({
                  ...current,
                  [language]: false,
                }));
              }}
              type="button"
              disabled={isTerminating}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              className="button-secondary inline-flex items-center gap-2"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                toast.success("Code copied");
              }}
              type="button"
              disabled={isTerminating}
            >
              <Clipboard className="h-4 w-4" />
              Copy
            </button>
            <button
              className="button-secondary inline-flex items-center gap-2"
              onClick={() => {
                const blob = new Blob([code], {
                  type: "text/plain;charset=utf-8",
                });
                const href = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = href;
                link.download = `solution.${language === "javascript" ? "js" : language === "python" ? "py" : language === "java" ? "java" : "cpp"}`;
                link.click();
                URL.revokeObjectURL(href);
              }}
              type="button"
              disabled={isTerminating}
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>

        <div className="min-h-[34rem]">
          <Editor
            height="34rem"
            language={language === "cpp" ? "cpp" : language}
            theme={
              document.documentElement.classList.contains("dark")
                ? "vs-dark"
                : "light"
            }
            value={code}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              roundedSelection: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              tabSize: 2,
              readOnly: isTerminating,
            }}
          />
        </div>

        <div className="border-t border-slate-200/70 p-4 dark:border-white/10">
          <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            Runtime support on this server:
            {" "}
            {["javascript", "python", "java", "cpp"]
              .filter((item) => runtimeSupport[item])
              .join(", ") || "checking..."}
          </div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
            Custom input
          </label>
          <textarea
            className="input-premium h-24 resize-none bg-white dark:bg-slate-950/60"
            placeholder="Provide custom stdin here..."
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            disabled={isTerminating}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                Typing speed: {monitor.typingMetrics.typingSpeed}
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                Pauses: {monitor.typingMetrics.pauseCount}
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                Edits: {monitor.typingMetrics.editCount}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="button-secondary inline-flex items-center gap-2"
                disabled={
                  !sessionToken ||
                  runMutation.isPending ||
                  submitMutation.isPending ||
                  isTerminating ||
                  runtimeSupport[language] === false
                }
                onClick={() => runMutation.mutate()}
                type="button"
              >
                {runMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {runMutation.isPending ? "Running..." : "Run code"}
              </button>
              <button
                className="button-primary inline-flex items-center gap-2 disabled:bg-cyan-500/60 disabled:hover:bg-cyan-500/60"
                disabled={!sessionToken || !code.trim() || submitMutation.isPending || isTerminating || runtimeSupport[language] === false}
                onClick={() => submitMutation.mutate()}
                type="button"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitMutation.isPending ? "Submitting..." : "Submit solution"}
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  void onTerminate();
                }}
                type="button"
                disabled={isTerminating}
              >
                {isTerminating ? "Ending interview..." : "End interview"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
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
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Large paste events, tab switches, fullscreen exits, and camera
            issues are logged for review.
          </div>
        </section>

        <section className="glass-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Output and results
            </h3>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Console output
              </p>
              <pre className="mt-3 min-h-[6rem] overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-cyan-100">
                {output || stderr || "Click 'Run code' to see output."}
              </pre>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {executionTime !== null
                  ? `Execution time: ${executionTime} ms`
                  : "No execution yet"}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Test case results
              </p>
              <div className="mt-3 space-y-3">
                {testResults.length ? (
                  testResults.map((item, index) => (
                    <div
                      key={index}
                      className={`rounded-2xl p-3 text-sm ${
                        item.passed
                          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {item.hidden
                            ? `Hidden case ${index + 1}`
                            : `Case ${index + 1}`}
                        </span>
                        <span>{item.passed ? "Passed" : "Failed"}</span>
                      </div>
                      {!item.hidden && (
                        <div className="mt-2 space-y-1 text-xs opacity-90">
                          <p>Expected: {String(item.expectedOutput || "")}</p>
                          <p>Actual: {String(item.actualOutput || "")}</p>
                          <p>Input: {String(item.input || "")}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Submit your solution to evaluate against all test cases.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Custom input result
              </p>
              <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-cyan-100">
                  {customRunResult?.input || customInput || "No custom input yet."}
                </pre>
                <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-cyan-100">
                  {customRunResult?.output || customRunResult?.error || "Run code with custom stdin to see output."}
                </pre>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                AI code review
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>Score: {String(analysis?.codeQualityScore || "--")}</p>
                <p>
                  Complexity: {String(analysis?.timeComplexityEstimate || "--")}
                </p>
                {Array.isArray(analysis?.suggestions) && (
                  <ul className="space-y-2">
                    {(analysis?.suggestions as string[]).map((item) => (
                      <li
                        key={item}
                        className="rounded-2xl bg-white px-3 py-2 dark:bg-slate-900/80"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <AssistantPanel
          sessionToken={sessionToken}
          questionId={question.id}
          currentAnswer={code}
          disabled={isTerminating}
        />
      </div>
    </div>
  );
}
