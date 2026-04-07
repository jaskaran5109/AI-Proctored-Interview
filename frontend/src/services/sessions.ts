import { api } from "@/services/http";
import {
  AdminAnalytics,
  CreateSessionPayload,
  Dashboard,
  Session,
  SessionDetail,
} from "@/types/api";


export async function fetchSessions() {
  const { data } = await api.get<{ sessions: Session[]; total: number }>("/sessions");
  return data;
}


export async function fetchDashboard() {
  const { data } = await api.get<Dashboard>("/sessions/dashboard");
  return data;
}


export async function fetchSessionDetail(sessionId: string) {
  const { data } = await api.get<SessionDetail>(`/sessions/${sessionId}`);
  return data;
}


export async function createSession(payload: CreateSessionPayload) {
  const { data } = await api.post<Session>("/sessions", payload);
  return data;
}


export async function deleteSession(sessionId: string) {
  const { data } = await api.delete(`/sessions/${sessionId}`);
  return data;
}


export async function fetchAdminAnalytics() {
  const { data } = await api.get<AdminAnalytics>("/admin/analytics");
  return data;
}


export async function createRoleConfig(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/roles", payload);
  return data;
}
