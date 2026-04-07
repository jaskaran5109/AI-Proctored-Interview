export type UserRole = "admin" | "candidate" | "recruiter";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Session {
  id: string;
  title: string;
  job_role: string;
  experience_level: string;
  candidate_name: string;
  candidate_email: string;
  difficulty: string;
  question_count: number;
  time_limit: number;
  status: string;
  access_token: string;
  created_at: string;
  score?: number | null;
  authenticity_rating?: string | null;
  cheating_probability_score?: number | null;
}

export interface Dashboard {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  average_score: number;
  average_cheating_probability: number;
  recent_sessions: Session[];
}

export interface SessionDetail {
  session: Session & {
    topics: string[];
    questions: InterviewQuestion[];
    violations: ProctoringEvent[];
  };
  replay_timeline: Array<Record<string, unknown>>;
  ai_usage_summary: {
    total_interactions: number;
    by_intent: Record<string, number>;
  };
}

export interface InterviewValidation {
  session_id: string;
  title: string;
  job_role: string;
  experience_level?: string;
  candidate_name: string;
  question_count: number;
  time_limit: number;
  status: string;
  difficulty: string;
  topics: string[];
}

export interface InterviewQuestion {
  id: string;
  sequence: number;
  question_text: string;
  topic: string;
  difficulty: string;
  expected_time_seconds: number;
  hints: string[];
  answer_text?: string;
  evaluation?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  authenticity?: Record<string, unknown>;
}

export interface InterviewStartResponse {
  session_id: string;
  current_question: number;
  total_questions: number;
  question: InterviewQuestion;
  warnings: string[];
}

export interface AnswerResponse {
  status: string;
  evaluation: Record<string, unknown>;
  authenticity: Record<string, unknown>;
  confidence: Record<string, unknown>;
  progress: {
    current_question: number;
    total_questions: number;
  };
  next_question?: InterviewQuestion | null;
  final_evaluation?: FinalEvaluation | null;
}

export interface FinalEvaluation {
  score: number;
  authenticity_rating: string;
  cheating_probability_score: number;
  detailed_feedback: Record<string, unknown>;
}

export interface InterviewResult {
  session_id: string;
  title: string;
  candidate_name: string;
  status: string;
  score: number | null;
  authenticity_rating: string | null;
  cheating_probability_score: number | null;
  detailed_feedback: Record<string, unknown>;
  violations: ProctoringEvent[];
  questions: InterviewQuestion[];
}

export interface ProctoringEvent {
  id?: string;
  event_type: string;
  detail?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminAnalytics {
  role_configs: Array<Record<string, unknown>>;
  violation_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  suspicious_sessions: Session[];
}

export interface CreateSessionPayload {
  title: string;
  job_role: string;
  experience_level: string;
  candidate_name: string;
  candidate_email: string;
  topics: string[];
  difficulty: string;
  question_count: number;
  time_limit: number;
}
