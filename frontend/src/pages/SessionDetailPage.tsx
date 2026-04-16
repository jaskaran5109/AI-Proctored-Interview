import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Users } from "lucide-react";
import toast from "react-hot-toast";

import { CandidateDetailModal } from "@/components/interview/CandidateDetailModal";
import { fetchInterviewCandidates } from "@/services/interview";

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

function badgeClass(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("hire") || normalized.includes("completed") || normalized.includes("active")) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (normalized.includes("consider") || normalized.includes("in_progress")) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  return "bg-rose-500/10 text-rose-700 dark:text-rose-200";
}

export function SessionDetailPage() {
  const { sessionId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  const candidatesQuery = useQuery({
    queryKey: ["interview-candidates", sessionId],
    queryFn: () => fetchInterviewCandidates(sessionId),
    enabled: Boolean(sessionId),
  });

  const interview = candidatesQuery.data?.interview;
  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (candidatesQuery.data?.candidates || []).filter((candidate) => {
      if (!query) {
        return true;
      }
      return (
        candidate.candidate_name.toLowerCase().includes(query) ||
        candidate.candidate_email.toLowerCase().includes(query)
      );
    });
  }, [candidatesQuery.data?.candidates, search]);

  const copyAccessToken = async () => {
    if (!interview?.access_token) {
      return;
    }
    await navigator.clipboard.writeText(interview.access_token);
    toast.success("Access token copied");
  };

  if (candidatesQuery.isLoading) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        Loading interview details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_45%,#e2e8f0_100%)] p-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.95)_0%,rgba(8,47,73,0.92)_45%,rgba(2,6,23,0.95)_100%)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Interview Overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              {interview?.title || "Interview"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {interview?.job_role}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {interview?.experience_level}
              </span>
              <span className={`rounded-full px-3 py-1 ${badgeClass(interview?.interview_format)}`}>
                {interview?.interview_format}
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Access token</p>
            <div className="mt-2 flex items-center gap-3">
              <code className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-white/5 dark:text-slate-200">
                {interview?.access_token || "--"}
              </code>
              <button
                type="button"
                className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void copyAccessToken();
                }}
              >
                <Copy className="mr-2 inline h-4 w-4" />
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white/85 p-4 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Difficulty</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{interview?.difficulty || "--"}</p>
          </div>
          <div className="rounded-3xl bg-white/85 p-4 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Questions</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{interview?.question_count ?? 0}</p>
          </div>
          <div className="rounded-3xl bg-white/85 p-4 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Time limit</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{interview?.time_limit ?? 0} mins</p>
          </div>
          <div className="rounded-3xl bg-white/85 p-4 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Created</p>
            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDate(interview?.created_at)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
            <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(interview?.status)}`}>
              {interview?.status || "--"}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Attempted</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {interview?.candidates?.attempted ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {interview?.candidates?.completed ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">In progress</p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {interview?.candidates?.in_progress ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Candidates
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              Candidate attempts
            </h2>
          </div>
          <div className="flex w-full max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Search by candidate name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th className="pb-3 pr-4 font-medium">Candidate</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Score</th>
                <th className="pb-3 pr-4 font-medium">Recommendation</th>
                <th className="pb-3 pr-4 font-medium">Authenticity</th>
                <th className="pb-3 pr-4 font-medium">Started</th>
                <th className="pb-3 pr-4 font-medium">Completed</th>
                <th className="pb-3 pr-4 font-medium">Duration</th>
                <th className="pb-3 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((candidate) => (
                <tr
                  key={candidate.id}
                  className="border-b border-slate-100 align-top dark:border-white/5"
                >
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {candidate.candidate_name}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {candidate.candidate_email}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(candidate.status)}`}>
                      {candidate.status}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-slate-700 dark:text-slate-300">
                    {candidate?.score ?? "--"}%
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(candidate.recommendation)}`}>
                      {candidate.recommendation || "--"}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-slate-700 dark:text-slate-300">
                    {candidate.authenticity_score ?? candidate.authenticity_rating ?? "--"}
                  </td>
                  <td className="py-4 pr-4 text-slate-700 dark:text-slate-300">
                    {formatDate(candidate.started_at)}
                  </td>
                  <td className="py-4 pr-4 text-slate-700 dark:text-slate-300">
                    {formatDate(candidate.completed_at)}
                  </td>
                  <td className="py-4 pr-4 text-slate-700 dark:text-slate-300">
                    {formatDuration(candidate.duration_seconds)}
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400"
                      onClick={() => {
                        setSelectedCandidateId(candidate.id);
                        setModalOpen(true);
                      }}
                    >
                      <Eye className="mr-2 inline h-4 w-4" />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredCandidates.length && (
            <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No candidate attempts match the current search.
            </div>
          )}
        </div>
      </section>

      <CandidateDetailModal
        interviewId={sessionId}
        candidateSessionId={selectedCandidateId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
