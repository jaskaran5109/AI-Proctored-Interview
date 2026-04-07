import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchInterviewResult } from "@/services/interview";


export function ResultPage() {
  const { accessToken = "" } = useParams();
  const result = useQuery({
    queryKey: ["interview-result", accessToken],
    queryFn: () => fetchInterviewResult(accessToken),
    enabled: Boolean(accessToken),
  });

  const feedback = result.data?.detailed_feedback || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#020617,#0f172a,#082f49)] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Final evaluation</p>
          <h1 className="mt-2 text-4xl font-semibold">{result.data?.title}</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/5 p-4">Score: {result.data?.score ?? "--"}</div>
            <div className="rounded-3xl bg-white/5 p-4">Authenticity: {result.data?.authenticity_rating ?? "--"}</div>
            <div className="rounded-3xl bg-white/5 p-4">Cheating probability: {result.data?.cheating_probability_score ?? "--"}%</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h2 className="text-2xl font-semibold">Feedback summary</h2>
            <p className="mt-4 text-slate-300">{String(feedback.summary || "Evaluation is being finalized.")}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="font-semibold">Strengths</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {((feedback.strengths as string[]) || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="font-semibold">Weaknesses</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {((feedback.weaknesses as string[]) || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h2 className="text-2xl font-semibold">Violation log</h2>
            <div className="mt-4 space-y-3">
              {result.data?.violations?.map((event, index) => (
                <div key={`${event.event_type}-${index}`} className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
                  <p className="font-semibold">{event.event_type}</p>
                  <p className="mt-1 text-sm text-red-50/80">{event.detail}</p>
                </div>
              ))}
              {!result.data?.violations?.length && (
                <div className="rounded-3xl border border-dashed border-white/10 p-6 text-slate-400">No violations recorded.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
