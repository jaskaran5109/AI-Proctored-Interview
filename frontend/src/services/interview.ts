import { api } from "@/services/http";
import {
  AnswerResponse,
  CandidateDetailResponse,
  CodeRunResponse,
  CodeRuntimeSupport,
  CodeSubmitResponse,
  InterviewCandidatesResponse,
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

export async function createInterviewCandidateSession(payload: {
  access_token: string;
  candidate_name: string;
  candidate_email: string;
}) {
  const { data } = await api.post("/interviews/session", payload);
  return data;
}

export async function joinInterview(payload: {
  access_token: string;
  candidate_name: string;
  candidate_email: string;
}) {
  const { data } = await api.post("/interviews/join", payload);
  return data;
}

export async function startInterview(sessionToken: string) {
  const { data } = await api.post<InterviewStartResponse>("/interviews/start", {
    session_token: sessionToken,
  });
  return data;
}


export async function submitAnswer(payload: {
  session_token: string;
  question_id: string;
  answer_text: string;
  time_taken_seconds: number;
  typing_metrics: Record<string, unknown>;
}) {
  const { data } = await api.post<AnswerResponse>("/interviews/answer", payload);
  return data;
}


export async function fetchInterviewResult(accessToken: string, sessionToken: string) {
  const { data } = await api.get<InterviewResult>(`/interviews/result/${accessToken}`, {
    params: { session: sessionToken },
  });
  return data;
}


export async function endInterview(sessionToken: string) {
  const { data } = await api.post("/interviews/end", { session_token: sessionToken });
  return data;
}

export async function terminateInterview(sessionToken: string) {
  const { data } = await api.post("/interviews/terminate", {
    session_token: sessionToken,
    reason: "candidate_terminated",
  });
  return data;
}

export async function timeoutInterview(payload: {
  session_token: string;
  question_id?: string;
  current_answer?: string;
  time_taken_seconds?: number;
  typing_metrics?: Record<string, unknown>;
}) {
  const { data } = await api.post("/interviews/timeout", payload);
  return data;
}

export async function sendHeartbeat(sessionToken: string) {
  const { data } = await api.post("/interviews/heartbeat", {
    session_token: sessionToken,
  });
  return data;
}


export async function sendAssistantMessage(payload: {
  sessionToken: string;
  questionId: string;
  message: string;
  currentAnswer?: string;
}) {
  const { data } = await api.post("/assist/chat", {
    session_token: payload.sessionToken,
    question_id: payload.questionId,
    message: payload.message,
    current_answer: payload.currentAnswer || "",
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

export async function runCode(payload: {
  language: string;
  code: string;
  input: string;
}) {
  const { data } = await api.post<CodeRunResponse>("/code/run", payload);
  return data;
}

export async function runQuestionCode(payload: {
  session_token: string;
  question_id: string;
  language: string;
  code: string;
  custom_input?: string;
  use_custom_input?: boolean;
}) {
  const { data } = await api.post("/interview/run-code", payload);
  return data;
}

export async function autosaveCode(payload: {
  session_token: string;
  question_id: string;
  language: string;
  code: string;
}) {
  const { data } = await api.post("/code/autosave", payload);
  return data;
}

export async function submitCode(payload: {
  session_token: string;
  question_id: string;
  language: string;
  code: string;
}) {
  const { data } = await api.post<CodeSubmitResponse>("/code/submit", payload);
  return data;
}

export async function fetchCodeRuntimeSupport() {
  const { data } = await api.get<CodeRuntimeSupport>("/code/runtime-support");
  return data;
}

export async function generateStarterCode(payload: {
  questionId: string;
  language: string;
  title: string;
  description: string;
}) {
  const { data } = await api.post("/interview/generate-starter-code", payload);
  return data as { starterCode: string };
}

export async function fetchInterviewCandidates(interviewId: string) {
  const { data } = await api.get<InterviewCandidatesResponse>(
    `/interview/${interviewId}/candidates`,
  );
  return data;
}

export async function fetchInterviewCandidateDetail(
  interviewId: string,
  sessionId: string,
) {
  const { data } = await api.get<CandidateDetailResponse>(
    `/interview/${interviewId}/candidates/${sessionId}`,
  );
  return data;
}
