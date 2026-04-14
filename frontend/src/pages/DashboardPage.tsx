import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { CreateInterviewWizard } from "@/components/dashboard/CreateInterviewWizard";
import { StatCard } from "@/components/shared/StatCard";
import { deleteSession, fetchDashboard, fetchSessions } from "@/services/sessions";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      toast.success("Interview removed");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total interviews"
          value={dashboard.data?.total_sessions ?? 0}
          hint="Reusable interview links across the workspace"
        />
        <StatCard
          label="Active now"
          value={dashboard.data?.active_sessions ?? 0}
          hint="Candidate sessions currently running"
        />
        <StatCard
          label="Avg score"
          value={dashboard.data?.average_score ?? 0}
          hint="Blended candidate evaluation score"
        />
        <StatCard
          label="Cheating risk"
          value={`${dashboard.data?.average_cheating_probability ?? 0}%`}
          hint="Average candidate suspicion probability"
        />
      </section>

      <section className="grid gap-6">
        <CreateInterviewWizard />

        <section className="glass-card p-6">
          <div className="mb-5">
            <p className="section-label">Interviews</p>
            <h2 className="mt-2 text-2xl font-semibold">Recent interview pipeline</h2>
          </div>

          <div className="hidden overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Interview</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Questions</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data?.sessions?.map((session) => (
                  <tr key={session.id} className="border-t border-slate-200 dark:border-white/10">
                    <td className="px-4 py-4">
                      <p className="font-medium">{session.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {session.job_role} · {session.experience_level}
                      </p>
                    </td>
                    <td className="px-4 py-4">{session.interview_format ?? "mixed"}</td>
                    <td className="px-4 py-4">{session.difficulty}</td>
                    <td className="px-4 py-4">{session.question_count}</td>
                    <td className="px-4 py-4">{session.time_limit} mins</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button className="button-secondary px-3 py-2" onClick={() => navigate(`/sessions/${session.id}`)}>
                          Open
                        </button>
                        <button
                          className="button-secondary px-3 py-2"
                          onClick={async () => {
                            await navigator.clipboard.writeText(`${window.location.origin}/interview/${session.access_token}`);
                            toast.success("Link copied!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          className="button-secondary px-3 py-2 text-rose-500"
                          onClick={() => deleteMutation.mutate(session.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {sessions.data?.sessions?.map((session) => (
              <div key={session.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{session.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {session.job_role} · {session.experience_level}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-700 dark:text-cyan-200">
                    {session.interview_format ?? "mixed"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-3 text-sm dark:bg-white/5">Difficulty: {session.difficulty}</div>
                  <div className="rounded-2xl bg-white p-3 text-sm dark:bg-white/5">Questions: {session.question_count}</div>
                  <div className="rounded-2xl bg-white p-3 text-sm dark:bg-white/5">Time: {session.time_limit} mins</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => navigate(`/sessions/${session.id}`)}>
                    <ExternalLink className="mr-2 inline h-4 w-4" />
                    Open
                  </button>
                  <button
                    className="button-secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/interview/${session.access_token}`);
                      toast.success("Link copied!");
                    }}
                  >
                    <Copy className="mr-2 inline h-4 w-4" />
                    Copy Invite Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
