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
    questionCount: { type: Number, default: 5 },
    timeLimit: { type: Number, default: 30 },
    topics: [{ type: String }],
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    accessToken: { type: String, unique: true, required: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "terminated"],
      default: "pending",
    },
    score: Number,
    authenticityRating: String,
    cheatingProbabilityScore: Number,
    detailedFeedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    violationCount: { type: Number, default: 0 },
  },
  baseOptions,
);

const questionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    sequence: { type: Number, required: true },
    topic: String,
    difficulty: String,
    questionText: String,
    expectedTimeSeconds: Number,
    hints: [{ type: String }],
  },
  baseOptions,
);

const answerSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    answerText: String,
    timeTakenSeconds: Number,
    typingMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    authenticity: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);

const aiUsageLogSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
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
    eventType: { type: String, required: true },
    severity: { type: String, default: "medium" },
    detail: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);

const resultSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
    finalScore: Number,
    authenticityScore: String,
    cheatingProbability: Number,
    recommendation: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);

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
const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
const Answer = mongoose.models.Answer || mongoose.model("Answer", answerSchema);
const AIUsageLog = mongoose.models.AIUsageLog || mongoose.model("AIUsageLog", aiUsageLogSchema);
const ProctoringLog = mongoose.models.ProctoringLog || mongoose.model("ProctoringLog", proctoringLogSchema);
const Result = mongoose.models.Result || mongoose.model("Result", resultSchema);
const RoleTemplate = mongoose.models.RoleTemplate || mongoose.model("RoleTemplate", roleTemplateSchema);

module.exports = {
  User,
  Interview,
  Question,
  Answer,
  AIUsageLog,
  ProctoringLog,
  Result,
  RoleTemplate,
};
