import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";

import { fetchInterviewResult } from "@/services/interview";

function recommendationTone(value?: string) {
  if (value === "Hire") {
    return "bg-emerald-500/15 text-emerald-100 border-emerald-400/30";
  }
  if (value === "Consider") {
    return "bg-amber-500/15 text-amber-100 border-amber-400/30";
  }
  return "bg-rose-500/15 text-rose-100 border-rose-400/30";
}

export function ResultPage() {
  const { accessToken = "" } = useParams();
  const [searchParams] = useSearchParams();
  const sessionToken = useMemo(
    () =>
      searchParams.get("session") ||
      window.sessionStorage.getItem(`interview-session-token:${accessToken}`) ||
      "",
    [accessToken, searchParams],
  );

  const result = useQuery({
    queryKey: ["interview-result", accessToken, sessionToken],
    queryFn: () => fetchInterviewResult(accessToken, sessionToken),
    enabled: Boolean(accessToken && sessionToken),
  });

  const feedback = (result.data?.detailed_feedback || {}) as Record<string, any>;
  const finalEvaluation = (result.data?.final_evaluation || {}) as Record<
    string,
    any
  >;
  const questionReviews =
    (feedback.question_reviews as Array<Record<string, any>>) ||
    (result.data?.questions as Array<Record<string, any>>) ||
    [];
  const skillScores =
    (feedback.skill_scores as Record<string, number>) ||
    (feedback.topic_scores as Record<string, number>) ||
    {};
  const proctoringSummary = (feedback.proctoring_summary || {}) as Record<
    string,
    any
  >;

  const handleDownload = () => {
    window.print();
  };

  if (result.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] text-white">
        Loading interview results...
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] px-4 text-white">
        Result not available for this session yet.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Interview result
              </p>
              <h1 className="mt-2 text-4xl font-semibold">
                {result.data.title}
              </h1>
              <p className="mt-3 text-slate-300">
                {result.data.candidate_name} • {result.data.job_role}
              </p>
              {result.data.ended_early && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Interview ended early
                </p>
              )}
              {result.data.timed_out && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
                  <Clock3 className="h-4 w-4" />
                  Interview ended because time ran out
                </p>
              )}
            </div>

            <button
              className="button-secondary inline-flex items-center gap-2 print:hidden"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Overall score</p>
              <p className="mt-3 text-4xl font-semibold">
                {result.data.score ?? "--"}
              </p>
              <p className="mt-2 text-xs text-slate-400">Out of 10</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Authenticity</p>
              <p className="mt-3 text-4xl font-semibold">
                {result.data.authenticity_rating ?? "--"}
              </p>
              <p className="mt-2 text-xs text-slate-400">Out of 100</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Cheating probability</p>
              <p className="mt-3 text-4xl font-semibold">
                {result.data.cheating_probability_score ?? "--"}%
              </p>
              <p className="mt-2 text-xs text-slate-400">Behavioral risk model</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Recommendation</p>
              <p
                className={`mt-3 inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${recommendationTone(
                  finalEvaluation.recommendation || feedback.recommendation,
                )}`}
              >
                {finalEvaluation.recommendation || feedback.recommendation || "Pending"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Performance trend: {feedback.performance_trend || finalEvaluation.performanceTrend || "steady"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-cyan-300" />
              <h2 className="text-2xl font-semibold">Summary</h2>
            </div>
            <p className="mt-4 text-slate-300">
              {String(feedback.summary || finalEvaluation.summary || "Evaluation is being finalized.")}
            </p>

            {!!Object.keys(skillScores).length && (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {Object.entries(skillScores).map(([skill, score]) => (
                  <div
                    key={skill}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-sm text-slate-400">{skill}</p>
                    <p className="mt-2 text-2xl font-semibold">{score}%</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <p className="font-semibold">Strengths</p>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {((feedback.strengths as string[]) || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <p className="font-semibold">Improvements</p>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {((feedback.suggestions as string[]) || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-cyan-300" />
                <h2 className="text-2xl font-semibold">Proctoring Summary</h2>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl bg-white/5 p-4">
                  Events: {proctoringSummary.total_events ?? result.data.violations.length}
                </div>
                <div className="rounded-3xl bg-white/5 p-4">
                  AI hints used: {proctoringSummary.ai_usage_count ?? result.data.ai_usage_count ?? 0}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {result.data.violations.length ? (
                  result.data.violations.map((item) => (
                    <div
                      key={item.id || `${item.event_type}-${item.created_at}`}
                      className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4"
                    >
                      <p className="font-semibold">{item.event_type}</p>
                      <p className="mt-1 text-sm text-rose-100/90">
                        {item.detail || "No extra detail provided"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-5 text-slate-400">
                    No suspicious activity was recorded.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h2 className="text-2xl font-semibold">Question-by-question review</h2>
          <div className="mt-6 space-y-4">
            {questionReviews.map((item, index) => (
              <article
                key={item.question_id || `${item.sequence}-${index}`}
                className="rounded-3xl border border-white/10 bg-slate-950/25 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      {item.question_type === "coding" ? "Coding challenge" : "Question"} {item.sequence}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">
                      {item.title || item.question_text}
                    </h3>
                    {item.topic && (
                      <p className="mt-2 text-sm text-cyan-200">Topic: {item.topic}</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-2 text-sm">
                    Score: {item.evaluation?.score ?? "--"}
                  </div>
                </div>

                {item.description && (
                  <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                )}

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl bg-white/5 p-4">
                    <p className="text-sm font-semibold text-slate-200">
                      Candidate response
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                      {item.answer_text || "No response captured"}
                    </pre>
                  </div>
                  <div className="rounded-3xl bg-white/5 p-4">
                    <p className="text-sm font-semibold text-slate-200">AI feedback</p>
                    <p className="mt-3 text-sm text-slate-300">
                      {item.evaluation?.feedback ||
                        item.ai_analysis?.suggestions?.join(" ") ||
                        "No detailed feedback available."}
                    </p>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-950/40 p-3 text-sm">
                        Confidence: {item.confidence?.score ?? "--"}
                      </div>
                      <div className="rounded-2xl bg-slate-950/40 p-3 text-sm">
                        Authenticity: {item.authenticity?.authenticity_score ?? "--"}
                      </div>
                    </div>
                  </div>
                </div>

                {Array.isArray(item.execution_result?.results) && (
                  <div className="mt-5 rounded-3xl bg-white/5 p-4">
                    <p className="text-sm font-semibold text-slate-200">
                      Test results
                    </p>
                    <div className="mt-3 space-y-3">
                      {item.execution_result.results.map((testCase: any, caseIndex: number) => (
                        <div
                          key={`${item.question_id}-case-${caseIndex}`}
                          className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm"
                        >
                          <p className="font-medium">
                            {testCase.hidden ? "Hidden case" : `Case ${caseIndex + 1}`} • {testCase.passed ? "Passed" : "Failed"}
                          </p>
                          {!testCase.hidden && (
                            <div className="mt-2 space-y-1 text-slate-300">
                              <p>Input: {String(testCase.input || "")}</p>
                              <p>Expected: {String(testCase.expectedOutput || "")}</p>
                              <p>Actual: {String(testCase.actualOutput || "")}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
