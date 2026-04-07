import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Info, Mail, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import toast from "react-hot-toast";

import { createSession } from "@/services/sessions";
import { CreateSessionPayload } from "@/types/api";

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  job_role: z.string().min(2, "Role is required"),
  experience_level: z.enum(["junior", "mid", "senior", "staff"]),
  candidate_name: z.string().min(2, "Candidate name is required"),
  candidate_email: z.string().email("Enter a valid email"),
  topics: z.string().min(3, "Add at least one topic"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_count: z.coerce.number().min(3).max(10),
  time_limit: z.coerce.number().min(10).max(120),
});

type FormValues = z.infer<typeof schema>;

const steps = ["Role setup", "Candidate", "Interview config"];

const smartDefaults: Record<string, Partial<FormValues>> = {
  "Frontend Engineer": {
    topics: "react,typescript,performance,accessibility",
    difficulty: "medium",
    time_limit: 35,
  },
  "Backend Engineer": {
    topics: "python,fastapi,apis,scalability",
    difficulty: "medium",
    time_limit: 40,
  },
  "Product Designer": {
    topics: "ux research,design systems,collaboration,accessibility",
    difficulty: "medium",
    time_limit: 30,
  },
};

export function CreateInterviewWizard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [createdLink, setCreatedLink] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      job_role: "Backend Engineer",
      experience_level: "mid",
      candidate_name: "",
      candidate_email: "",
      topics: "python,fastapi,apis,scalability",
      difficulty: "medium",
      question_count: 5,
      time_limit: 40,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CreateSessionPayload = {
        title: values.title,
        job_role: values.job_role,
        experience_level: values.experience_level,
        candidate_name: values.candidate_name,
        candidate_email: values.candidate_email,
        difficulty: values.difficulty,
        question_count: values.question_count,
        time_limit: values.time_limit,
        topics: values.topics
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      return createSession(payload);
    },
    onSuccess: (session) => {
      setCreatedLink(
        `${window.location.origin}/interview/${session.access_token}`,
      );
      toast.success("Interview created");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => toast.error("Could not create interview"),
  });

  const completion = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const nextStep = async () => {
    const fields = [
      ["title", "job_role", "experience_level"],
      ["candidate_name", "candidate_email"],
      ["topics", "difficulty", "question_count", "time_limit"],
    ][step] as Array<keyof FormValues>;

    const valid = await form.trigger(fields);
    if (!valid) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const applyDefaults = (role: string) => {
    const defaults = smartDefaults[role];
    if (!defaults) {
      return;
    }
    Object.entries(defaults).forEach(([key, value]) => {
      form.setValue(key as keyof FormValues, value as never);
    });
    toast.success("Smart defaults applied");
  };

  return (
    <section className="glass-card p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Create interview</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Step-based interview builder
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Smart defaults, inline validation, and share-ready invite links.
          </p>
        </div>
        <div className="hidden rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-700 dark:text-cyan-200 sm:block">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {steps[step]}
          </span>
          <span className="font-medium">
            {step + 1}/{steps.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <input
                className="input-premium"
                placeholder="Interview title"
                {...form.register("title")}
              />
              <p className="mt-1 text-sm text-rose-500">
                {form.formState.errors.title?.message}
              </p>
            </div>
            <div>
              <select
                className="input-premium"
                {...form.register("job_role")}
                onChange={(event) => {
                  form.setValue("job_role", event.target.value);
                  applyDefaults(event.target.value);
                }}
              >
                {[
                  "Backend Engineer",
                  "Frontend Engineer",
                  "Product Designer",
                  "ML Engineer",
                ].map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                Smart defaults adapt topics and timing.
              </p>
            </div>
            <div>
              <select
                className="input-premium"
                {...form.register("experience_level")}
              >
                {["junior", "mid", "senior", "staff"].map((level) => (
                  <option key={level} value={level}>
                    {level
                      ? level.substring(0, 1).toUpperCase() + level.slice(1)
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <input
                className="input-premium"
                placeholder="Candidate name"
                {...form.register("candidate_name")}
              />
              <p className="mt-1 text-sm text-rose-500">
                {form.formState.errors.candidate_name?.message}
              </p>
            </div>
            <div>
              <input
                className="input-premium"
                placeholder="Candidate email"
                {...form.register("candidate_email")}
              />
              <p className="mt-1 text-sm text-rose-500">
                {form.formState.errors.candidate_email?.message}
              </p>
            </div>
            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Mail className="mr-2 inline h-4 w-4" />
              Optional email sharing can be layered in later; invite link
              generation is ready immediately after creation.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <input
                className="input-premium"
                placeholder="Topics, comma separated"
                {...form.register("topics")}
              />
              <p className="mt-1 text-sm text-rose-500">
                {form.formState.errors.topics?.message}
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Difficulty
              </label>
              <select
                className="input-premium"
                {...form.register("difficulty")}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Question count
              </label>
              <input
                className="input-premium"
                type="number"
                min={3}
                max={10}
                {...form.register("question_count")}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Time limit (minutes)
              </label>
              <input
                className="input-premium"
                type="number"
                min={10}
                max={120}
                {...form.register("time_limit")}
              />
            </div>
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-900 dark:text-cyan-100">
              Tooltips by design: ` Difficulty controls question depth` ` Time
              limit sets the full interview window` ` Experience level
              influences generated question seniority`
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className="button-primary" onClick={nextStep}>
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="button-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating..." : "Create interview"}
            </button>
          )}
        </div>
      </form>

      {createdLink && (
        <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            Interview created
          </p>
          <p className="mt-2 break-all text-sm text-emerald-800 dark:text-emerald-200">
            {createdLink}
          </p>
          <button
            className="button-secondary mt-3"
            onClick={async () => {
              await navigator.clipboard.writeText(createdLink);
              toast.success("Link copied!");
            }}
          >
            <Copy className="mr-2 inline h-4 w-4" />
            Copy Invite Link
          </button>
        </div>
      )}
    </section>
  );
}
