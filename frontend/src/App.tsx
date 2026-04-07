import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AppShell } from "@/components/layout/AppShell";
import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";
import { useAuthStore } from "@/store/authStore";


const AdminPage = lazy(() => import("@/pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AuthPage = lazy(() => import("@/pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const InterviewPage = lazy(() => import("@/pages/InterviewPage").then((module) => ({ default: module.InterviewPage })));
const ResultPage = lazy(() => import("@/pages/ResultPage").then((module) => ({ default: module.ResultPage })));
const SessionDetailPage = lazy(() => import("@/pages/SessionDetailPage").then((module) => ({ default: module.SessionDetailPage })));


function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      Loading platform...
    </div>
  );
}


function ProtectedRoute({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: string[];
}) {
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}


export default function App() {
  const bootstrap = useAuthBootstrap();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
    bootstrap();
  }, [bootstrap, hydrate]);

  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/interview/:accessToken" element={<InterviewPage />} />
            <Route path="/result/:accessToken" element={<ResultPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SessionDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AppShell>
                    <AdminPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" />
    </>
  );
}
