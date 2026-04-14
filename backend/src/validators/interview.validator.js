const { z } = require("zod");

const createInterviewSchema = z.object({
  title: z.string().min(3),
  job_role: z.string().min(2),
  experience_level: z.string().min(2).default("mid"),
  topics: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  interview_format: z.enum(["theoretical", "coding", "mixed"]).default("mixed"),
  question_count: z.number().min(2).max(10),
  time_limit: z.number().min(1).max(120),
});

const accessTokenSchema = z.object({
  access_token: z.string().min(8),
});

const sessionTokenSchema = z.object({
  session_token: z.string().min(8),
});

const createInterviewSessionSchema = z.object({
  access_token: z.string().min(8),
  candidate_name: z.string().min(2),
  candidate_email: z.string().email(),
});

const answerSchema = z.object({
  session_token: z.string().min(8),
  question_id: z.string().min(6),
  answer_text: z.string().min(1),
  time_taken_seconds: z.number().min(0),
  typing_metrics: z.record(z.any()).default({}),
});

const assistSchema = z.object({
  session_token: z.string().min(8),
  question_id: z.string().min(6),
  message: z.string().min(1),
  current_answer: z.string().optional().default(""),
});

const proctoringSchema = z.object({
  session_id: z.string().min(6),
  event_type: z.string().min(2),
  detail: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

const roleTemplateSchema = z.object({
  role_name: z.string().min(2),
  description: z.string().min(10),
  topics: z.array(z.string()).default([]),
  default_difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const terminateInterviewSchema = z.object({
  session_token: z.string().min(8),
  current_answer: z.string().optional().default(""),
  question_id: z.string().optional(),
});

const timeoutInterviewSchema = z.object({
  session_token: z.string().min(8),
  current_answer: z.string().optional().default(""),
  question_id: z.string().optional(),
  time_taken_seconds: z.number().min(0).optional().default(0),
  typing_metrics: z.record(z.any()).optional().default({}),
});

const heartbeatSchema = z.object({
  session_token: z.string().min(8),
});

const generateStarterCodeSchema = z.object({
  questionId: z.string().min(6).optional(),
  question_id: z.string().min(6).optional(),
  language: z.enum(["javascript", "python", "java", "cpp"]),
  title: z.string().min(3),
  description: z.string().min(10),
});

module.exports = {
  accessTokenSchema,
  answerSchema,
  assistSchema,
  createInterviewSessionSchema,
  createInterviewSchema,
  generateStarterCodeSchema,
  heartbeatSchema,
  proctoringSchema,
  roleTemplateSchema,
  sessionTokenSchema,
  terminateInterviewSchema,
  timeoutInterviewSchema,
};
