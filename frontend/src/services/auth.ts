import { api } from "@/services/http";
import { AuthResponse, User } from "@/types/api";


export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  return data;
}


export async function signup(payload: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "candidate" | "recruiter";
}) {
  const { data } = await api.post<AuthResponse>("/auth/signup", payload);
  return data;
}


export async function me() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}
