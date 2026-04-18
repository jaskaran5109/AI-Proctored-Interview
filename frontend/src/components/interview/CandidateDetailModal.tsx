import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Clock3, Copy, Shield } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchInterviewCandidateDetail } from "@/services/interview";

const TypedDialogContent = DialogContent as any;
const TypedDialogHeader = DialogHeader as any;
const TypedDialogTitle = DialogTitle as any;
const TypedDialogDescription = DialogDescription as any;
type SkillScoreValue =
  | number
  | {
      score?: number;
      difficulty?: string;
    };

type SkillChartItem = {
  name: string;
  score: number;
  difficulty: string;
};
function formatDate(value?: string | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleString();
}

function formatDuration(seconds?: number | null) {
  if (!seconds && seconds !== 0) {
    return "--";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function badgeClass(label?: string) {
  const value = String(label || "").toLowerCase();
  if (
    value.includes("hire") ||
    value.includes("clean") ||
    value.includes("completed")
  ) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (
    value.includes("consider") ||
    value.includes("suspicious") ||
    value.includes("in_progress")
  ) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  return "bg-rose-500/10 text-rose-700 dark:text-rose-200";
}

export function CandidateDetailModal({
  interviewId,
  candidateSessionId,
  open,
  onOpenChange,
}: {
  interviewId: string;
  candidateSessionId?: string | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "questions" | "proctoring"
  >("overview");

  const detailQuery = useQuery({
    queryKey: ["candidate-detail", interviewId, candidateSessionId],
    queryFn: () =>
      fetchInterviewCandidateDetail(interviewId, candidateSessionId || ""),
    enabled: open && Boolean(interviewId) && Boolean(candidateSessionId),
  });

  const detail = detailQuery.data;

  const skillChartData = useMemo<SkillChartItem[]>(() => {
    const skillScores = (detail?.session?.skill_scores ?? {}) as Record<
      string,
      SkillScoreValue
    >;

    return Object.entries(skillScores).map(
      ([name, value]): SkillChartItem => ({
        name,
        score: typeof value === "number" ? value : (value?.score ?? 0),

        difficulty:
          typeof value === "object" && value !== null
            ? (value?.difficulty ?? "easy")
            : "easy",
      }),
    );
  }, [detail?.session?.skill_scores]);

  const gaugeData = useMemo(
    () => [
      {
        name: "score",
        value: Number(detail?.session?.overall_score || 0) * 10,
      },
    ],
    [detail?.session?.overall_score],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TypedDialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <TypedDialogHeader>
          <TypedDialogTitle>
            {detail?.session?.candidate_name || "Candidate details"}
          </TypedDialogTitle>
          <TypedDialogDescription>
            Review interview performance, question-by-question output, and
            proctoring events.
          </TypedDialogDescription>
        </TypedDialogHeader>

        {detailQuery.isLoading ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            Loading candidate details...
          </div>
        ) : !detail ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            Candidate details are unavailable right now.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              {[
                { key: "overview", label: "Overview" },
                { key: "questions", label: "Question Review" },
                { key: "proctoring", label: "Proctoring Report" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-cyan-500 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300"
                  }`}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Status
                      </p>
                      <p
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(detail?.session?.status)}`}
                      >
                        {detail?.session?.status}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Recommendation
                      </p>
                      <p
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(detail?.session?.recommendation)}`}
                      >
                        {detail?.session?.recommendation || "--"}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Started
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {formatDate(detail?.session?.started_at)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Duration
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {formatDuration(detail?.session?.duration_seconds)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      AI Summary
                    </p>
                    <div className="mt-4 space-y-3 text-sm">
                      <h4 className="font-semibold">
                        Evaluation Score :{" "}
                        {typeof detail?.session?.ai_summary === "string" ? (
                          <p>{detail.session.ai_summary}</p>
                        ) : (
                          <>
                            <h4>
                              Evaluation Score:{" "}
                              {detail?.session?.ai_summary?.evaluation?.score}
                            </h4>
                          </>
                        )}
                      </h4>

                      <div>
                        <h4 className="font-semibold">Weaknesses</h4>

                        <ul className="list-disc pl-5">
                          {detail?.session?.ai_summary?.evaluation?.weaknesses?.map(
                            (w, i) => (
                              <li key={i}>{w}</li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold">Improvements</h4>

                        <ul className="list-disc pl-5">
                          {detail?.session?.ai_summary?.evaluation?.improvements?.map(
                            (imp, i) => (
                              <li key={i}>{imp}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Strengths
                      </p>
                      <div className="mt-3 space-y-2">
                        {(detail?.session?.strengths || []).length ? (
                          detail?.session?.strengths?.map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-100"
                            >
                              {item}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No strengths captured.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Improvements
                      </p>
                      <div className="mt-3 space-y-2">
                        {(detail?.session?.improvements || []).length ? (
                          detail?.session?.improvements?.map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100"
                            >
                              {item}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No improvements captured.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Overall score
                    </p>
                    <div className="mt-3 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          data={gaugeData}
                          innerRadius="65%"
                          outerRadius="100%"
                          startAngle={180}
                          endAngle={0}
                          barSize={20}
                        >
                          <RadialBar
                            dataKey="value"
                            cornerRadius={20}
                            fill="#06b6d4"
                          />
                          <Tooltip />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="-mt-12 text-center">
                      <p className="text-4xl font-semibold text-slate-950 dark:text-white">
                        {detail?.session?.overall_score ?? "--"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        out of 10
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Per-skill score breakdown
                    </p>
                    <div className="mt-4 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={skillChartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#cbd5e1"
                          />
                          <XAxis dataKey="name" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Bar
                            dataKey="score"
                            fill="#0f766e"
                            radius={[12, 12, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Authenticity
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {detail?.session?.authenticity_score ?? "--"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {detail?.session?.confidence_score ?? "--"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        AI usage
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {Number(
                          detail?.session?.authenticity_breakdown
                            ?.ai_usage_count || 0,
                        )}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "questions" && (
              <section className="space-y-4">
                {detail?.questions &&
                  detail?.questions?.map((question) => (
                    <div
                      key={`${question?.question_type || question?.id}-${question?.sequence}`}
                      className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                              #{question?.sequence}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(question?.question_type)}`}
                            >
                              {question?.question_type === "coding"
                                ? "Coding"
                                : "Text"}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
                            {question?.title || question?.question_text}
                          </h3>
                          {question?.description && (
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {question?.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                          <p>
                            Score: {String(question?.evaluation?.score ?? "--")}
                          </p>
                          <p>
                            Time: {formatDuration(question?.time_taken_seconds)}
                          </p>
                          <p>
                            AI assist:{" "}
                            {question?.ai_assistance_used ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {question?.question_type === "coding"
                              ? "Final code"
                              : "Candidate answer"}
                          </p>
                          <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-cyan-100">
                            {question?.answer_text || "No submission captured."}
                          </pre>
                          {question?.language && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              Language used: {question?.language}
                            </p>
                          )}
                        </div>

                        <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            AI evaluation
                          </p>
                          <div className="mt-3 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                            <p>
                              {String(
                                question?.evaluation?.feedback ||
                                  "No evaluation feedback captured.",
                              )}
                            </p>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Strengths
                              </p>
                              <div className="mt-2 space-y-2">
                                {Array.isArray((question as any).strengths) &&
                                (question as any).strengths.length ? (
                                  (question as any).strengths.map(
                                    (item: string) => (
                                      <div
                                        key={item}
                                        className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-100"
                                      >
                                        {item}
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    No strengths captured.
                                  </p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Weaknesses
                              </p>
                              <div className="mt-2 space-y-2">
                                {Array.isArray((question as any).weaknesses) &&
                                (question as any).weaknesses.length ? (
                                  (question as any).weaknesses.map(
                                    (item: any, index: number) => (
                                      <div
                                        key={index}
                                        className="rounded-2xl bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-100"
                                      >
                                        {typeof item === "string" ? (
                                          item
                                        ) : (
                                          <span>
                                            {item.type && (
                                              <span className="font-semibold capitalize">
                                                {item.type}:{" "}
                                              </span>
                                            )}
                                            {item.description ??
                                              JSON.stringify(item)}
                                          </span>
                                        )}
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    No weaknesses captured.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {question?.question_type === "coding" && (
                        <div className="mt-4 rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Visible test case results
                          </p>
                          <div className="mt-3 space-y-2">
                            {(question?.test_results || []).length ? (
                              question?.test_results?.map((item, index) => (
                                <div
                                  key={`${question?.id}-test-${index}`}
                                  className={`rounded-2xl px-3 py-3 text-sm ${
                                    item.passed
                                      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
                                      : "bg-rose-500/10 text-rose-800 dark:text-rose-100"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span>Case {index + 1}</span>
                                    <span>
                                      {item.passed ? "Passed" : "Failed"}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                                      {item.input || "--"}
                                    </pre>
                                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                                      {item.expectedOutput || "--"}
                                    </pre>
                                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                                      {item.actualOutput || item.stderr || "--"}
                                    </pre>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No test-case result data captured.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </section>
            )}

            {activeTab === "proctoring" && (
              <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Flag level
                        </p>
                        <p
                          className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(detail.proctoring.flag_level)}`}
                        >
                          {detail.proctoring.flag_level}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          AI assistant usage
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {detail.proctoring.ai_assistant_usage_count}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Tab switches
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {detail.proctoring.tab_switch_count}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Copy / paste
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {detail.proctoring.copy_paste_count}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-3xl bg-white p-4 dark:bg-slate-900/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Authenticity breakdown
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm dark:bg-white/5">
                          <Shield className="mb-2 h-4 w-4" />
                          Authenticity score:{" "}
                          {detail.proctoring.authenticity_score ?? "--"}
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm dark:bg-white/5">
                          <AlertTriangle className="mb-2 h-4 w-4" />
                          Risk score:{" "}
                          {detail.proctoring.cheating_probability_score ?? "--"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Timeline
                  </p>
                  <div className="mt-4 space-y-3">
                    {detail.proctoring.events.length ? (
                      detail.proctoring.events.map((event) => (
                        <div
                          key={
                            event.id ||
                            `${event.event_type}-${event.created_at}`
                          }
                          className="rounded-3xl bg-white p-4 dark:bg-slate-900/70"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {event.event_type?.includes("copy") ? (
                                <Copy className="h-4 w-4 text-rose-500" />
                              ) : event.event_type?.includes("ai") ? (
                                <Bot className="h-4 w-4 text-cyan-500" />
                              ) : event.event_type?.includes("warning") ? (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <Clock3 className="h-4 w-4 text-slate-500" />
                              )}
                              <p className="font-medium text-slate-900 dark:text-white">
                                {event.event_type}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass((event as any).severity)}`}
                            >
                              {(event as any).severity || "info"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {event.detail || "No extra detail provided."}
                          </p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(event.created_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No proctoring events were captured for this candidate.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </TypedDialogContent>
    </Dialog>
  );
}
