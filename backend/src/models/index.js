const mongoose = require("mongoose");

const baseOptions = { timestamps: true };

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "recruiter", "candidate"],
      default: "recruiter",
    },
  },
  baseOptions,
);

const interviewSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    jobRole: { type: String, required: true },
    experienceLevel: { type: String, default: "mid" },
    difficulty: { type: String, default: "medium" },
    interviewFormat: {
      type: String,
      enum: ["theoretical", "coding", "mixed"],
      default: "mixed",
    },
    questionCount: { type: Number, default: 5 },
    timeLimit: { type: Number, default: 30 },
    topics: [{ type: String }],
    skillGraph: [{ type: String }],
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    accessToken: { type: String, unique: true, required: true },
  },
  baseOptions,
);

const interviewSessionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true, lowercase: true, index: true },
    sessionToken: { type: String, unique: true, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "terminated", "timed_out"],
      default: "pending",
    },
    startTime: Date,
    endTime: Date,
    lastHeartbeatAt: Date,
    resumeCount: { type: Number, default: 0 },
    terminationReason: String,
    score: Number,
    authenticityRating: Number,
    cheatingProbabilityScore: Number,
    detailedFeedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    finalEvaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    violationCount: { type: Number, default: 0 },
    skillProgress: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);
interviewSessionSchema.index({ interviewId: 1, candidateEmail: 1 }, { unique: true });

const questionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      default: null,
      index: true,
    },
    sequence: { type: Number, required: true },
    questionType: { type: String, enum: ["text"], default: "text" },
    topic: String,
    skill: String,
    difficulty: String,
    questionText: String,
    expectedTimeSeconds: Number,
    hints: [{ type: String }],
    adaptiveMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    generationSource: { type: String, default: "ai" },
  },
  baseOptions,
);
questionSchema.index({ interviewId: 1, sessionId: 1 });
questionSchema.index({ interviewId: 1, sessionId: 1, sequence: 1 });
questionSchema.index({ interviewId: 1, sequence: 1 }, { unique: true });

const codingQuestionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      default: null,
      index: true,
    },
    sequence: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, default: "medium" },
    constraints: [{ type: String }],
    starterCode: { type: mongoose.Schema.Types.Mixed, default: {} },
    testCases: [
      {
        input: { type: String, default: "" },
        expectedOutput: { type: String, default: "" },
        hidden: { type: Boolean, default: false },
        explanation: { type: String, default: "" },
      },
    ],
    supportedLanguages: [{ type: String }],
    topic: { type: String, default: "algorithms" },
    generationSource: { type: String, default: "ai" },
  },
  baseOptions,
);
codingQuestionSchema.index({ interviewId: 1, sessionId: 1 });
codingQuestionSchema.index({ interviewId: 1, sessionId: 1, sequence: 1 });
codingQuestionSchema.index({ interviewId: 1, sequence: 1 }, { unique: true });

const answerSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession", required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    skill: String,
    difficulty: String,
    answerText: String,
    timeTakenSeconds: Number,
    typingMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    authenticity: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);
answerSchema.index({ sessionId: 1, questionId: 1 }, { unique: true });

const aiUsageLogSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession", required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    userMessage: String,
    assistantMessage: String,
    intent: String,
  },
  baseOptions,
);

const proctoringLogSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession", required: true, index: true },
    eventType: { type: String, required: true },
    severity: { type: String, default: "medium" },
    detail: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);

const resultSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession", required: true, unique: true, index: true },
    finalScore: Number,
    authenticityScore: Number,
    cheatingProbability: Number,
    recommendation: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);

const codeSubmissionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession", required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "CodingQuestion", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    code: { type: String, default: "" },
    language: { type: String, required: true },
    status: { type: String, enum: ["draft", "run", "submitted"], default: "draft" },
    output: { type: String, default: "" },
    stderr: { type: String, default: "" },
    executionTime: { type: Number, default: 0 },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    authenticity: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeTakenSeconds: { type: Number, default: 0 },
  },
  baseOptions,
);
codeSubmissionSchema.index({ sessionId: 1, questionId: 1, status: 1 });

const roleTemplateSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true },
    description: { type: String, required: true },
    topics: [{ type: String }],
    defaultDifficulty: { type: String, default: "medium" },
  },
  baseOptions,
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Interview = mongoose.models.Interview || mongoose.model("Interview", interviewSchema);
const InterviewSession = mongoose.models.InterviewSession || mongoose.model("InterviewSession", interviewSessionSchema);
const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
const CodingQuestion = mongoose.models.CodingQuestion || mongoose.model("CodingQuestion", codingQuestionSchema);
const Answer = mongoose.models.Answer || mongoose.model("Answer", answerSchema);
const AIUsageLog = mongoose.models.AIUsageLog || mongoose.model("AIUsageLog", aiUsageLogSchema);
const ProctoringLog = mongoose.models.ProctoringLog || mongoose.model("ProctoringLog", proctoringLogSchema);
const Result = mongoose.models.Result || mongoose.model("Result", resultSchema);
const CodeSubmission = mongoose.models.CodeSubmission || mongoose.model("CodeSubmission", codeSubmissionSchema);
const RoleTemplate = mongoose.models.RoleTemplate || mongoose.model("RoleTemplate", roleTemplateSchema);

module.exports = {
  User,
  Interview,
  InterviewSession,
  Question,
  CodingQuestion,
  Answer,
  AIUsageLog,
  ProctoringLog,
  Result,
  CodeSubmission,
  CodingSubmission: CodeSubmission,
  RoleTemplate,
};
