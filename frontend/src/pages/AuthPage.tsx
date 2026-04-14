import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import toast from "react-hot-toast";

import { login, signup } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";


const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});


type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;


export function AuthPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@aiproctor.com",
      password: "admin123",
    },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        const values = loginForm.getValues();
        return login({
          email: values.email,
          password: values.password,
        });
      }
      const values = signupForm.getValues();
      return signup({
        name: values.name,
        email: values.email,
        password: values.password,
        role: "recruiter",
      });
    },
    onSuccess: (data) => {
      setAuth(data);
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      navigate("/");
    },
    onError: () => toast.error("Authentication failed"),
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const isValid =
      mode === "login"
        ? await loginForm.trigger()
        : await signupForm.trigger();
    if (!isValid) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_40%,#dbeafe_100%)] px-4 py-10 text-slate-900 dark:bg-[linear-gradient(135deg,#082f49_0%,#020617_45%,#111827_100%)] dark:text-white">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-card p-8">
          <p className="section-label">AI Proctored Interviews</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">
            Interview intelligence, live proctoring, and hiring signals in one workspace.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Adaptive question generation, candidate authenticity scoring, recruiter dashboards,
            and an admin-grade review trail built for real hiring teams.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              "Role-aware and difficulty-aware AI interview creation",
              "Proctoring event capture with replay-friendly timelines",
              "AI hint panel with authenticity-aware usage tracking",
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-950 dark:text-cyan-50">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">
              {mode === "login" ? <ShieldCheck className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {mode === "login" ? "Access workspace" : "Create recruiter account"}
              </p>
              <h2 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Sign up"}</h2>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                className={`rounded-2xl px-4 py-3 text-sm ${
                  mode === item
                    ? "bg-cyan-500 text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setMode(item)}
              >
                {item === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <div>
                <input
                  className="input-premium"
                  placeholder="Full name"
                  {...signupForm.register("name")}
                />
                <p className="mt-1 text-sm text-rose-500">{signupForm.formState.errors.name?.message}</p>
              </div>
            )}

            <div>
              {mode === "login" ? (
                <>
                  <input className="input-premium" placeholder="Email" {...loginForm.register("email")} />
                  <p className="mt-1 text-sm text-rose-500">{loginForm.formState.errors.email?.message}</p>
                </>
              ) : (
                <>
                  <input className="input-premium" placeholder="Email" {...signupForm.register("email")} />
                  <p className="mt-1 text-sm text-rose-500">{signupForm.formState.errors.email?.message}</p>
                </>
              )}
            </div>

            <div>
              {mode === "login" ? (
                <>
                  <input className="input-premium" placeholder="Password" type="password" {...loginForm.register("password")} />
                  <p className="mt-1 text-sm text-rose-500">{loginForm.formState.errors.password?.message}</p>
                </>
              ) : (
                <>
                  <input className="input-premium" placeholder="Password" type="password" {...signupForm.register("password")} />
                  <p className="mt-1 text-sm text-rose-500">{signupForm.formState.errors.password?.message}</p>
                </>
              )}
            </div>

            <button className="button-primary w-full" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
