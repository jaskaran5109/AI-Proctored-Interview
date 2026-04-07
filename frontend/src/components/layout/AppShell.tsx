import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import { useAuthStore } from "@/store/authStore";


const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];


export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200/70 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-700/70 dark:text-cyan-200/70">AI Proctor</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white">Interview OS</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems
          .filter((item) => !item.adminOnly || user?.role === "admin")
          .map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                  active
                    ? "bg-cyan-500 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-900 dark:text-cyan-100">
        Production interview workflows with adaptive AI, replay logs, and proctoring analytics.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(135deg,#f8fafc,#e2e8f0_45%,#f8fafc)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#111827)] dark:text-white">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-4 lg:px-8 lg:py-6">
        <aside className="hidden w-72 shrink-0 md:block">{sidebar}</aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="h-full w-80 max-w-[85vw] p-4" onClick={(event) => event.stopPropagation()}>
              {sidebar}
            </div>
          </div>
        )}

        <div className="flex-1">
          <header className="sticky top-3 z-30 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5 lg:px-5">
            <div className="flex items-center gap-3">
              <button
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white md:hidden dark:border-white/10 dark:bg-white/5"
                onClick={() => setMobileOpen((current) => !current)}
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Control Center</p>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                  <BarChart3 className="h-6 w-6 text-cyan-500 dark:text-cyan-300" />
                  {location.pathname === "/admin" ? "Admin workspace" : "Interview dashboard"}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => {
                  clearAuth();
                  navigate("/auth");
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </span>
              </button>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
