const crypto = require("crypto");

const {
  AIUsageLog,
  Answer,
  Interview,
  ProctoringLog,
  Question,
  Result,
  RoleTemplate,
} = require("../models");
const aiService = require("../services/ai.service");
const { emitToSession } = require("../utils/socket");
const { AppError } = require("../utils/appError");
const {
  accessTokenSchema,
  answerSchema,
  createInterviewSchema,
  proctoringSchema,
  roleTemplateSchema,
} = require("../validators/interview.validator");

function mapSession(interview) {
  return {
    id: interview._id.toString(),
    title: interview.title,
    job_role: interview.jobRole,
    experience_level: interview.experienceLevel,
    candidate_name: interview.candidateName,
    candidate_email: interview.candidateEmail,
    difficulty: interview.difficulty,
    question_count: interview.questionCount,
    time_limit: interview.timeLimit,
    status: interview.status,
    access_token: interview.accessToken,
    created_at: interview.createdAt,
    score: interview.score ?? null,
    authenticity_rating: interview.authenticityRating ?? null,
    cheating_probability_score: interview.cheatingProbabilityScore ?? null,
  };
}

function toQuestion(question) {
  return {
    id: question._id.toString(),
    sequence: question.sequence,
    question_text: question.questionText,
    topic: question.topic,
    difficulty: question.difficulty,
    expected_time_seconds: question.expectedTimeSeconds,
    hints: question.hints || [],
  };
}

async function createSession(req, res, next) {
  try {
    const payload = createInterviewSchema.parse(req.body);
    const accessToken = crypto.randomBytes(24).toString("hex");
    const interview = await Interview.create({
      title: payload.title,
      jobRole: payload.job_role,
      experienceLevel: payload.experience_level,
      candidateName: payload.candidate_name,
      candidateEmail: payload.candidate_email,
      difficulty: payload.difficulty,
      questionCount: payload.question_count,
      timeLimit: payload.time_limit,
      topics: payload.topics,
      recruiterId: req.user._id,
      accessToken,
    });

    const questions = await aiService.generateQuestions({
      role: payload.job_role,
      difficulty: payload.difficulty,
      topics: payload.topics,
      count: payload.question_count,
      experienceLevel: payload.experience_level,
    });

    await Question.insertMany(
      questions.map((question, index) => ({
        interviewId: interview._id,
        sequence: question.sequence || index + 1,
        topic: question.topic,
        difficulty: question.difficulty,
        questionText: question.questionText || question.question_text,
        expectedTimeSeconds: question.expectedTimeSeconds || question.expected_time_seconds || 240,
        hints: question.hints || [],
      })),
    );

    res.json(mapSession(interview));
  } catch (error) {
    next(error);
  }
}

async function listSessions(req, res, next) {
  try {
    const query = req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const sessions = await Interview.find(query).sort({ createdAt: -1 }).lean();
    res.json({ sessions: sessions.map(mapSession), total: sessions.length });
  } catch (error) {
    next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    const query = req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const sessions = await Interview.find(query).sort({ createdAt: -1 }).lean();
    const scored = sessions.filter((session) => typeof session.score === "number");
    const risked = sessions.filter((session) => typeof session.cheatingProbabilityScore === "number");
    res.json({
      total_sessions: sessions.length,
      active_sessions: sessions.filter((session) => session.status === "in_progress").length,
      completed_sessions: sessions.filter((session) => session.status === "completed").length,
      average_score: scored.length ? Number((scored.reduce((sum, item) => sum + item.score, 0) / scored.length).toFixed(2)) : 0,
      average_cheating_probability: risked.length ? Number((risked.reduce((sum, item) => sum + item.cheatingProbabilityScore, 0) / risked.length).toFixed(2)) : 0,
      recent_sessions: sessions.slice(0, 5).map(mapSession),
    });
  } catch (error) {
    next(error);
  }
}

async function sessionDetail(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.sessionId).lean();
    if (!interview) throw new AppError(404, "Session not found");
    if (req.user.role !== "admin" && interview.recruiterId.toString() !== req.user._id.toString()) {
      throw new AppError(403, "Forbidden");
    }
    const [questions, answers, aiLogs, violations] = await Promise.all([
      Question.find({ interviewId: interview._id }).sort({ sequence: 1 }).lean(),
      Answer.find({ interviewId: interview._id }).lean(),
      AIUsageLog.find({ interviewId: interview._id }).sort({ createdAt: 1 }).lean(),
      ProctoringLog.find({ interviewId: interview._id }).sort({ createdAt: 1 }).lean(),
    ]);
    const answerMap = new Map(answers.map((item) => [item.questionId.toString(), item]));
    const replay_timeline = [
      ...aiLogs.map((item) => ({ type: "ai", created_at: item.createdAt, detail: item.userMessage, ...item })),
      ...violations.map((item) => ({ type: "proctoring", created_at: item.createdAt, detail: item.detail, ...item })),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json({
      session: {
        ...mapSession(interview),
        topics: interview.topics,
        questions: questions.map((question) => {
          const answer = answerMap.get(question._id.toString());
          return {
            ...toQuestion(question),
            answer_text: answer?.answerText,
            evaluation: answer?.evaluation || {},
            confidence: answer?.confidence || {},
            authenticity: answer?.authenticity || {},
          };
        }),
        violations: violations.map((log) => ({
          id: log._id.toString(),
          event_type: log.eventType,
          detail: log.detail,
          created_at: log.createdAt,
          metadata: log.metadata,
        })),
      },
      replay_timeline,
      ai_usage_summary: {
        total_interactions: aiLogs.length,
        by_intent: aiLogs.reduce((acc, item) => {
          acc[item.intent] = (acc[item.intent] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function deleteSession(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.sessionId);
    if (!interview) throw new AppError(404, "Session not found");
    if (req.user.role !== "admin" && interview.recruiterId.toString() !== req.user._id.toString()) {
      throw new AppError(403, "Forbidden");
    }
    await Promise.all([
      Question.deleteMany({ interviewId: interview._id }),
      Answer.deleteMany({ interviewId: interview._id }),
      AIUsageLog.deleteMany({ interviewId: interview._id }),
      ProctoringLog.deleteMany({ interviewId: interview._id }),
      Result.deleteMany({ interviewId: interview._id }),
      Interview.deleteOne({ _id: interview._id }),
    ]);
    res.json({ message: "Session deleted" });
  } catch (error) {
    next(error);
  }
}

async function validateInterview(req, res, next) {
  try {
    const payload = accessTokenSchema.parse(req.body);
    const interview = await Interview.findOne({ accessToken: payload.access_token }).lean();
    if (!interview) throw new AppError(404, "Invalid access token");
    res.json({
      session_id: interview._id.toString(),
      title: interview.title,
      job_role: interview.jobRole,
      experience_level: interview.experienceLevel,
      candidate_name: interview.candidateName,
      question_count: interview.questionCount,
      time_limit: interview.timeLimit,
      status: interview.status,
      difficulty: interview.difficulty,
      topics: interview.topics,
    });
  } catch (error) {
    next(error);
  }
}

async function startInterview(req, res, next) {
  try {
    const payload = accessTokenSchema.parse(req.body);
    const interview = await Interview.findOne({ accessToken: payload.access_token });
    if (!interview) throw new AppError(404, "Invalid access token");

    if (interview.status === "completed") {
      throw new AppError(409, "Interview already completed");
    }

    if (interview.status === "terminated") {
      throw new AppError(409, "Interview already ended");
    }

    const answeredIds = (await Answer.find({ interviewId: interview._id }).lean()).map((item) => item.questionId.toString());
    const question = await Question.findOne({
      interviewId: interview._id,
      _id: { $nin: answeredIds },
    })
      .sort({ sequence: 1 })
      .lean();

    if (!question) {
      interview.status = "completed";
      await interview.save();
      throw new AppError(409, "Interview already completed");
    }

    interview.status = "in_progress";
    await interview.save();
    res.json({
      session_id: interview._id.toString(),
      current_question: question.sequence,
      total_questions: interview.questionCount,
      question: toQuestion(question),
      warnings: [
        "Stay in fullscreen and keep the camera active.",
        "AI assistant activity is tracked for authenticity scoring.",
      ],
    });
  } catch (error) {
    next(error);
  }
}

async function submitAnswer(req, res, next) {
  try {
    const payload = answerSchema.parse(req.body);
    const question = await Question.findById(payload.question_id).lean();
    if (!question) throw new AppError(404, "Question not found");
    const interview = await Interview.findById(question.interviewId);
    if (!interview) throw new AppError(404, "Interview not found");

    const aiUsageLogs = await AIUsageLog.find({
      interviewId: interview._id,
      questionId: question._id,
    }).lean();
    const proctoringLogs = await ProctoringLog.find({ interviewId: interview._id }).lean();

    const evaluation = await aiService.analyzeAnswer({
      question: question.questionText,
      answer: payload.answer_text,
      timeTaken: payload.time_taken_seconds,
      aiAssisted: aiUsageLogs.length > 0,
    });

    const confidenceScore = Math.max(
      20,
      Math.min(
        95,
        78 - (payload.typing_metrics.pauseCount || 0) * 4 - (payload.typing_metrics.editCount || 0) * 2,
      ),
    );

    const authenticityValue = Math.max(
      5,
      90 - aiUsageLogs.length * 8 - proctoringLogs.length * 9 - (payload.time_taken_seconds < 25 ? 10 : 0),
    );
    const authenticity = {
      authenticity_score: authenticityValue,
      rating: authenticityValue >= 75 ? "high" : authenticityValue >= 45 ? "medium" : "low",
      used_ai_help: aiUsageLogs.length > 0,
    };

    const confidence = {
      score: confidenceScore,
      typing_speed: payload.typing_metrics.typingSpeed || 0,
      pause_count: payload.typing_metrics.pauseCount || 0,
      edit_count: payload.typing_metrics.editCount || 0,
      signal: confidenceScore >= 70 ? "steady" : confidenceScore >= 45 ? "hesitant" : "erratic",
    };

    await Answer.findOneAndUpdate(
      { interviewId: interview._id, questionId: question._id },
      {
        interviewId: interview._id,
        questionId: question._id,
        answerText: payload.answer_text,
        timeTakenSeconds: payload.time_taken_seconds,
        typingMetrics: payload.typing_metrics,
        evaluation,
        authenticity,
        confidence,
      },
      { new: true, upsert: true },
    );

    const answered = await Answer.find({ interviewId: interview._id }).lean();
    const nextQuestion = await Question.findOne({
      interviewId: interview._id,
      _id: { $nin: answered.map((item) => item.questionId) },
    })
      .sort({ sequence: 1 })
      .lean();

    let finalEvaluation = null;
    if (!nextQuestion) {
      const computed = await aiService.finalEvaluation({
        answers: answered,
        aiUsageLogs: await AIUsageLog.find({ interviewId: interview._id }).lean(),
        proctoringLogs,
      });
      interview.status = "completed";
      interview.score = computed.finalScore;
      interview.authenticityRating = computed.authenticityScore;
      interview.cheatingProbabilityScore = computed.cheatingProbability;
      interview.detailedFeedback = {
        summary: computed.summary,
        strengths: answered.flatMap((item) => item.evaluation?.strengths || []).slice(0, 3),
        weaknesses: answered.flatMap((item) => item.evaluation?.weaknesses || []).slice(0, 3),
        suggestions: answered.flatMap((item) => item.evaluation?.improvements || []).slice(0, 3),
        recommendation: computed.recommendation,
      };
      await interview.save();
      await Result.findOneAndUpdate(
        { interviewId: interview._id },
        {
          interviewId: interview._id,
          finalScore: computed.finalScore,
          authenticityScore: computed.authenticityScore,
          cheatingProbability: computed.cheatingProbability,
          recommendation: computed.recommendation,
          payload: interview.detailedFeedback,
        },
        { upsert: true, new: true },
      );
      finalEvaluation = {
        score: computed.finalScore,
        authenticity_rating: computed.authenticityScore,
        cheating_probability_score: computed.cheatingProbability,
        detailed_feedback: interview.detailedFeedback,
      };
    }

    res.json({
      status: nextQuestion ? "in_progress" : "completed",
      evaluation: {
        score: evaluation.score,
        strengths: evaluation.strengths || [],
        weaknesses: evaluation.weaknesses || [],
        suggestions: evaluation.improvements || evaluation.suggestions || [],
        feedback: evaluation.feedback,
        confidenceScore: evaluation.confidenceScore,
      },
      authenticity,
      confidence,
      progress: {
        current_question: nextQuestion ? nextQuestion.sequence : interview.questionCount,
        total_questions: interview.questionCount,
      },
      next_question: nextQuestion ? toQuestion(nextQuestion) : null,
      final_evaluation: finalEvaluation,
    });
  } catch (error) {
    next(error);
  }
}

async function interviewResult(req, res, next) {
  try {
    const interview = await Interview.findOne({ accessToken: req.params.accessToken }).lean();
    if (!interview) throw new AppError(404, "Interview not found");
    const [questions, violations] = await Promise.all([
      Question.find({ interviewId: interview._id }).sort({ sequence: 1 }).lean(),
      ProctoringLog.find({ interviewId: interview._id }).sort({ createdAt: 1 }).lean(),
    ]);
    res.json({
      session_id: interview._id.toString(),
      title: interview.title,
      candidate_name: interview.candidateName,
      status: interview.status,
      score: interview.score ?? null,
      authenticity_rating: interview.authenticityRating ?? null,
      cheating_probability_score: interview.cheatingProbabilityScore ?? null,
      detailed_feedback: interview.detailedFeedback || {},
      violations: violations.map((log) => ({
        id: log._id.toString(),
        event_type: log.eventType,
        detail: log.detail,
        created_at: log.createdAt,
      })),
      questions: questions.map(toQuestion),
    });
  } catch (error) {
    next(error);
  }
}

async function endInterview(req, res, next) {
  try {
    const payload = accessTokenSchema.parse(req.body);
    await Interview.findOneAndUpdate({ accessToken: payload.access_token }, { status: "terminated" });
    res.json({ message: "Interview terminated" });
  } catch (error) {
    next(error);
  }
}

async function createProctoringEvent(req, res, next) {
  try {
    const payload = proctoringSchema.parse(req.body);
    const interview = await Interview.findById(payload.session_id);
    if (!interview) throw new AppError(404, "Session not found");

    const severity =
      payload.event_type.includes("copy") || payload.event_type.includes("fullscreen")
        ? "high"
        : payload.event_type.includes("warning")
        ? "medium"
        : "low";

    const log = await ProctoringLog.create({
      interviewId: interview._id,
      eventType: payload.event_type,
      detail: payload.detail,
      metadata: payload.metadata,
      severity,
    });
    interview.violationCount += 1;
    await interview.save();
    const event = {
      id: log._id.toString(),
      event_type: log.eventType,
      detail: log.detail,
      created_at: log.createdAt,
      metadata: log.metadata,
    };
    emitToSession(interview._id.toString(), "proctoring:warning", event);
    res.json(event);
  } catch (error) {
    next(error);
  }
}

async function createRoleTemplate(req, res, next) {
  try {
    const payload = roleTemplateSchema.parse(req.body);
    const template = await RoleTemplate.create({
      roleName: payload.role_name,
      description: payload.description,
      topics: payload.topics,
      defaultDifficulty: payload.default_difficulty,
    });
    res.json(template);
  } catch (error) {
    next(error);
  }
}

async function adminAnalytics(req, res, next) {
  try {
    const [roleConfigs, violationBreakdown, suspiciousSessions, interviews] = await Promise.all([
      RoleTemplate.find().sort({ createdAt: -1 }).lean(),
      ProctoringLog.aggregate([{ $group: { _id: "$eventType", count: { $sum: 1 } } }]),
      Interview.find({
        $or: [{ cheatingProbabilityScore: { $gte: 55 } }, { violationCount: { $gte: 2 } }],
      })
        .sort({ updatedAt: -1 })
        .lean(),
      Interview.find().lean(),
    ]);
    res.json({
      role_configs: roleConfigs.map((item) => ({
        id: item._id.toString(),
        role_name: item.roleName,
        description: item.description,
        topics: item.topics,
        default_difficulty: item.defaultDifficulty,
      })),
      violation_breakdown: violationBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      status_breakdown: interviews.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
      suspicious_sessions: suspiciousSessions.map(mapSession),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  adminAnalytics,
  createProctoringEvent,
  createRoleTemplate,
  createSession,
  dashboard,
  deleteSession,
  endInterview,
  interviewResult,
  listSessions,
  sessionDetail,
  startInterview,
  submitAnswer,
  validateInterview,
};
