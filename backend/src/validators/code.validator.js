const { z } = require("zod");

const codeLanguageSchema = z.enum(["javascript", "python", "java", "cpp"]);

const codeRunSchema = z.object({
  language: codeLanguageSchema,
  code: z.string().min(1).max(50000),
  input: z.string().max(10000).optional().default(""),
});

const interviewCodeRunSchema = z.object({
  session_token: z.string().min(8).optional(),
  sessionToken: z.string().min(8).optional(),
  question_id: z.string().min(6).optional(),
  questionId: z.string().min(6).optional(),
  language: codeLanguageSchema,
  code: z.string().min(1).max(50000),
  custom_input: z.string().max(10000).optional(),
  customInput: z.string().max(10000).optional(),
  use_custom_input: z.boolean().optional(),
  useCustomInput: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (!(value.session_token || value.sessionToken)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "session_token is required",
      path: ["session_token"],
    });
  }

  if (!(value.question_id || value.questionId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "question_id is required",
      path: ["question_id"],
    });
  }
});

const codeAutosaveSchema = z.object({
  session_token: z.string().min(8),
  question_id: z.string().min(6),
  language: codeLanguageSchema,
  code: z.string().max(50000),
});

const codeSubmitSchema = z.object({
  session_token: z.string().min(8),
  question_id: z.string().min(6),
  language: codeLanguageSchema,
  code: z.string().min(1).max(50000),
  time_taken_seconds: z.number().min(0).optional().default(0),
});

const analyzeCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  question: z.string().min(1),
  testResults: z.any().optional().default({}),
});

module.exports = {
  analyzeCodeSchema,
  codeAutosaveSchema,
  codeLanguageSchema,
  codeRunSchema,
  interviewCodeRunSchema,
  codeSubmitSchema,
};
