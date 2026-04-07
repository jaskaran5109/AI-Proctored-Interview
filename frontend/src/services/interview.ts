import { api } from "@/services/http";
import {
  AnswerResponse,
  InterviewResult,
  InterviewStartResponse,
  InterviewValidation,
  ProctoringEvent,
} from "@/types/api";


export async function validateInterview(accessToken: string) {
  const { data } = await api.post<InterviewValidation>("/interviews/validate", {
    access_token: accessToken,
  });
  return data;
}


export async function startInterview(accessToken: string) {
  const { data } = await api.post<InterviewStartResponse>("/interviews/start", {
    access_token: accessToken,
  });
  return data;
}


export async function submitAnswer(payload: {
  question_id: string;
  answer_text: string;
  time_taken_seconds: number;
  typing_metrics: Record<string, unknown>;
}) {
  const { data } = await api.post<AnswerResponse>("/interviews/answer", payload);
  return data;
}


export async function fetchInterviewResult(accessToken: string) {
  const { data } = await api.get<InterviewResult>(`/interviews/result/${accessToken}`);
  return data;
}


export async function endInterview(accessToken: string) {
  const { data } = await api.post("/interviews/end", { access_token: accessToken });
  return data;
}


export async function sendAssistantMessage(payload: {
  accessToken: string;
  questionId: string;
  message: string;
}) {
  const { data } = await api.post("/assist/chat", {
    access_token: payload.accessToken,
    question_id: payload.questionId,
    message: payload.message,
  });
  return data;
}


export async function reportProctoringEvent(payload: {
  session_id: string;
  event_type: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data } = await api.post<ProctoringEvent>("/proctoring/events", payload);
  return data;
}
