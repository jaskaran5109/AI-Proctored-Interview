import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchSessionDetail } from "@/services/sessions";


export function SessionDetailPage() {
  const { sessionId = "" } = useParams();
  const detail = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: Boolean(sessionId),
  });

  const session = detail.data?.session;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Interview detail</p>
        <h2 className="mt-2 text-3xl font-semibold">{session?.title}</h2>
        <p className="mt-2 text-slate-300">{session?.candidate_name} · {session?.job_role}</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-black/10 bg-white/5 dark:bg-white/5   p-6 backdrop-blur">
          <h3 className="text-xl font-semibold">Question breakdown</h3>
          <div className="mt-4 space-y-4">
            {session?.questions?.map((question) => (
              <div key={question.id} className="rounded-3xl border dark:border-white/10 border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-cyan-200">Question {question.sequence}</p>
                    <p className="mt-2 font-medium">{question.question_text}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs">{question.difficulty}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-3 text-sm">Score: {(question.evaluation as any)?.score ?? "--"}</div>
                  <div className="rounded-2xl bg-white/5 p-3 text-sm">Authenticity: {(question.authenticity as any)?.rating ?? "--"}</div>
                  <div className="rounded-2xl bg-white/5 p-3 text-sm">Confidence: {(question.confidence as any)?.signal ?? "--"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-xl font-semibold">AI usage summary</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white/5 p-4">Interactions: {detail.data?.ai_usage_summary.total_interactions ?? 0}</div>
              {Object.entries(detail.data?.ai_usage_summary.by_intent || {}).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-white/5 p-4 text-sm">{key}: {value}</div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-xl font-semibold">Replay timeline</h3>
            <div className="mt-4 space-y-3">
              {detail.data?.replay_timeline.map((event, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm">
                  <p className="font-medium">{String(event.type).toUpperCase()}</p>
                  <p className="mt-1 text-slate-400">{event.created_at as string}</p>
                  <p className="mt-2 text-slate-300">{String(event.detail || event.user_message || event.assistant_message || "")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
