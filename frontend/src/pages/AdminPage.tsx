import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { createRoleConfig, fetchAdminAnalytics } from "@/services/sessions";
import CustomDropdown from "@/components/shared/CustomDropdown";

const options = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];

export function AdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    role_name: "",
    description: "",
    topics: "architecture,apis,behavioral",
    default_difficulty: "medium",
  });


  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: fetchAdminAnalytics,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      createRoleConfig({
        ...form,
        topics: form.topics
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Role configuration added");
      void queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="rounded-[28px] border dark:border-white/10 border-gray-400 bg-white/5 p-6 backdrop-blur"
        onSubmit={handleSubmit}
      >
        <p className="text-xs uppercase tracking-[0.35em] dark:text-slate-400 text-slate-800">
          Admin panel
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Create interview role template
        </h2>
        <div className="mt-5 space-y-4">
          <input
            className="w-full rounded-2xl border dark:border-white/10 border-gray-400 bg-white/5 px-4 py-3"
            placeholder="Role name"
            value={form.role_name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                role_name: event.target.value,
              }))
            }
          />
          <textarea
            className="h-32 w-full rounded-2xl border dark:border-white/10 border-gray-400 bg-white/5 px-4 py-3"
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <input
            className="w-full rounded-2xl border dark:border-white/10 border-gray-400 bg-white/5 px-4 py-3"
            placeholder="Topics"
            value={form.topics}
            onChange={(event) =>
              setForm((current) => ({ ...current, topics: event.target.value }))
            }
          />
          <CustomDropdown options={options} value={form.default_difficulty} onChange={(value) => setForm((current) => ({ ...current, default_difficulty: value }))} />
          <button className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">
            Save role
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <section className="rounded-[28px] border dark:border-white/10 border-gray-400 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] dark:text-slate-400 text-slate-800">
            Violation trends
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(analytics.data?.violation_breakdown || {}).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="rounded-3xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <p className="text-smdark:text-slate-400 text-slate-800">
                    {key}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="rounded-[28px] border dark:border-white/10 border-gray-400 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] dark:text-slate-400 text-slate-800">
            Suspicious sessions
          </p>
          <div className="mt-4 space-y-3">
            {analytics.data?.suspicious_sessions?.map((session) => (
              <div
                key={session.id}
                className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4"
              >
                <p className="font-semibold">{session.title}</p>
                <p className="text-sm text-red-100/80">
                  {session.job_role} · risk {session.cheating_probability_score}
                  %
                </p>
              </div>
            ))}
            {!analytics.data?.suspicious_sessions?.length && (
              <div className="rounded-3xl border border-dashed border-white/10 p-6d dark:text-slate-400 text-slate-800 p-3">
                No suspicious sessions yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
