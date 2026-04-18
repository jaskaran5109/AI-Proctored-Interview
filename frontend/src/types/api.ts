export type UserRole = "admin" | "candidate" | "recruiter";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  created_at: string;
  updated_at: string;
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
  difficulty: string;
  interview_format?: "theoretical" | "coding" | "mixed";
  question_count: number;
  time_limit: number;
  status?: string;
  access_token: string;
  created_at: string;
  score?: number | null;
  authenticity_rating?: number | null;
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
  interview: Session & {
    topics: string[];
    skill_graph?: string[];
    questions: InterviewQuestion[];
    candidates?: {
      attempted: number;
      completed: number;
      in_progress: number;
    };
    status?: string;
  };
  candidate_sessions: CandidateInterviewSession[];
}

export interface InterviewValidation {
  interview_id: string;
  title: string;
  job_role: string;
  experience_level?: string;
  question_count: number;
  time_limit: number;
  difficulty: string;
  interview_format?: "theoretical" | "coding" | "mixed";
  topics: string[];
  skill_graph?: string[];
  attempted_count?: number;
}

export interface CandidateInterviewSession {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  session_token: string;
  created_at: string;
  score?: number | null;
  authenticity_rating?: number | null;
  authenticity_score?: number | null;
  cheating_probability_score?: number | null;
  violation_count?: number;
  skill_progress?: Record<string, unknown>;
  recommendation?: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
}

export interface InterviewQuestion {
  id: string;
  sequence: number;
  question_type?: "text" | "coding";
  question_text: string;
  topic: string;
  skill?: string;
  difficulty: string;
  expected_time_seconds: number;
  hints: string[];
  adaptive_metadata?: Record<string, unknown>;
  title?: string;
  description?: string;
  constraints?: string[];
  starter_code?: Record<string, string>;
  supported_languages?: string[];
  sample_test_cases?: Array<{
    input: string;
    expected_output: string;
    explanation?: string;
  }>;
  hidden_test_case_count?: number;
  draft_code?: string;
  execution_result?: Record<string, unknown> | null;
  ai_analysis?: Record<string, unknown> | null;
  answer_text?: string;
  code_submission?: string;
  language?: string | null;
  evaluation?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  authenticity?: Record<string, unknown>;
  time_taken_seconds?: number;
  ai_assistance_used?: boolean;
  ai_assistance_count?: number;
  test_results?: Array<{
    input?: string;
    expectedOutput?: string;
    actualOutput?: string;
    hidden: boolean;
    passed: boolean;
    executionTime: number;
    stderr?: string;
  }>;
}

export interface InterviewStartResponse {
  session_id: string;
  session_token: string;
  current_question: number;
  total_questions: number;
  skill_progress?: Record<string, unknown>;
  question: InterviewQuestion;
  warnings: string[];
}

export interface AnswerResponse {
  status: string;
  evaluation: Record<string, unknown>;
  authenticity: Record<string, unknown>;
  confidence: Record<string, unknown>;
  skill_progress?: Record<string, unknown>;
  progress: {
    current_question: number;
    total_questions: number;
  };
  next_question?: InterviewQuestion | null;
  final_evaluation?: FinalEvaluation | null;
}

export interface FinalEvaluation {
  score: number;
  authenticity_rating: number;
  cheating_probability_score: number;
  detailed_feedback: Record<string, unknown>;
  final_evaluation?: Record<string, unknown>;
}

export interface InterviewResult {
  session_id: string;
  title: string;
  job_role?: string;
  interview_format?: "theoretical" | "coding" | "mixed";
  candidate_name: string;
  status: string;
  score: number | null;
  authenticity_rating: number | null;
  cheating_probability_score: number | null;
  detailed_feedback: Record<string, unknown>;
  final_evaluation?: Record<string, unknown>;
  skill_progress?: Record<string, unknown>;
  violations: ProctoringEvent[];
  questions: InterviewQuestion[];
  ai_usage_count?: number;
  ended_early?: boolean;
  timed_out?: boolean;
  completed_at?: string | null;
}

export interface ProctoringEvent {
  id?: string;
  event_type: string;
  detail?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface CodeRunResponse {
  stdout: string;
  stderr: string;
  executionTime: number;
  success: boolean;
}

export interface CodeSubmitResponse {
  submission_id: string;
  passedCount: number;
  totalCount: number;
  executionTime: number;
  results: Array<{
    input?: string;
    expectedOutput?: string;
    actualOutput?: string;
    hidden: boolean;
    passed: boolean;
    executionTime: number;
    stderr?: string;
  }>;
  aiAnalysis: Record<string, unknown>;
  evaluation?: Record<string, unknown>;
  authenticity?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  skill_progress?: Record<string, unknown>;
  next_question?: InterviewQuestion | null;
  status?: string;
  final_evaluation?: FinalEvaluation | null;
}

export interface InterviewCandidatesResponse {
  interview: Session & {
    topics?: string[];
    skill_graph?: string[];
    candidates?: {
      attempted: number;
      completed: number;
      in_progress: number;
    };
    status?: string;
  };
  candidates: CandidateInterviewSession[];
}

export interface CandidateDetailResponse {
  interview: InterviewCandidatesResponse["interview"];
  session: {
    id: string;
    candidate_name: string;
    candidate_email: string;
    status: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration_seconds?: number | null;
    overall_score?: number | null;
    recommendation?: string;
    authenticity_score?: number | null;
    confidence_score?: number | null;
    ai_summary?: {
      evaluation?: {
        score: number;
        weaknesses: string[];
        improvements: string[];
      };
    };
    strengths?: string[];
    improvements?: string[];
    skill_scores?: Record<string, number>;
    authenticity_breakdown?: Record<string, unknown>;
  };
  questions: InterviewQuestion[];
  proctoring: {
    events: ProctoringEvent[];
    tab_switch_count: number;
    copy_paste_count: number;
    ai_assistant_usage_count: number;
    authenticity_score?: number | null;
    cheating_probability_score?: number | null;
    flag_level: string;
  };
}

export interface CodeRuntimeSupport {
  runtimes: Record<string, boolean>;
}

export interface AdminAnalytics {
  role_configs: Array<Record<string, unknown>>;
  violation_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  suspicious_sessions: Session[];
}

export interface RoleTemplate {
  id: string;
  role_name: string;
  description: string;
  topics: string[];
  default_difficulty: "easy" | "medium" | "hard";
}

export interface CreateSessionPayload {
  title: string;
  job_role: string;
  experience_level: string;
  topics: string[];
  difficulty: string;
  interview_format: "theoretical" | "coding" | "mixed";
  question_count: number;
  time_limit: number;
}
