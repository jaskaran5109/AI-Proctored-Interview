const { z } = require("zod");

const createInterviewSchema = z.object({
  title: z.string().min(3),
  job_role: z.string().min(2),
  experience_level: z.string().min(2).default("mid"),
  candidate_name: z.string().min(2),
  candidate_email: z.string().email(),
  topics: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  question_count: z.number().min(3).max(10),
  time_limit: z.number().min(10).max(120),
});

const accessTokenSchema = z.object({
  access_token: z.string().min(8),
});

const answerSchema = z.object({
  question_id: z.string().min(6),
  answer_text: z.string().min(1),
  time_taken_seconds: z.number().min(0),
  typing_metrics: z.record(z.any()).default({}),
});

const assistSchema = z.object({
  access_token: z.string().min(8),
  question_id: z.string().min(6),
  message: z.string().min(1),
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

module.exports = {
  accessTokenSchema,
  answerSchema,
  assistSchema,
  createInterviewSchema,
  proctoringSchema,
  roleTemplateSchema,
};
