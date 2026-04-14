const crypto = require("crypto");

const {
  AIUsageLog,
  Answer,
  CodeSubmission,
  CodingQuestion,
  Interview,
  InterviewSession,
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
  createInterviewSessionSchema,
  generateStarterCodeSchema,
  heartbeatSchema,
  proctoringSchema,
  roleTemplateSchema,
  sessionTokenSchema,
  terminateInterviewSchema,
  timeoutInterviewSchema,
} = require("../validators/interview.validator");
const {
  buildSkillGraph,
  ensureInterviewBlueprintQuestions,
  ensureSessionActive,
  ensureSessionBootstrapQuestions,
  finalizeInterview,
  findNextInterviewQuestion,
  generateNextQuestionForSession,
  loadInterviewByAccessToken,
  loadSessionByToken,
  mapInterviewCandidateSession,
  mapQuestionForResponse,
  mapSession,
  toCodingQuestion,
  toQuestion,
  upsertCandidateSession,
} = require("../services/interview-flow.service");

function ensureInterviewOwnership(req, interview) {
  if (
    req.user.role !== "admin" &&
    interview.recruiterId.toString() !== req.user._id.toString()
  ) {
    throw new AppError(403, "Forbidden");
  }
}

function mapEvaluationPayload(evaluation) {
  return {
    score: evaluation.score,
    accuracy: Math.round(Number(evaluation.score || 0) * 10),
    strengths: evaluation.strengths || [],
    weaknesses: evaluation.weaknesses || [],
    suggestions: evaluation.improvements || evaluation.suggestions || [],
    feedback: evaluation.feedback,
    confidenceScore: evaluation.confidenceScore,
    suggestedDifficulty: evaluation.suggestedDifficulty,
  };
}

function mapRecommendationBadge(recommendation = "") {
  const normalized = String(recommendation || "").toLowerCase();
  if (normalized.includes("hire") || normalized === "proceed") {
    return "Hire";
  }
  if (normalized.includes("consider") || normalized === "review") {
    return "Consider";
  }
  return "Reject";
}

function getRiskFlagLevel(session, proctoringEvents = []) {
  const riskSignals = [
    Number(session.cheatingProbabilityScore || 0) >= 70,
    Number(session.violationCount || 0) >= 5,
    proctoringEvents.length >= 5,
  ].filter(Boolean).length;

  if (riskSignals >= 2) {
    return "High Risk";
  }
  if (riskSignals === 1) {
    return "Suspicious";
  }
  return "Clean";
}

async function buildInterviewOverview(interview) {
  const candidateSessions = await InterviewSession.find({
    interviewId: interview._id,
  }).lean();

  const attempted = candidateSessions.length;
  const completed = candidateSessions.filter(
    (item) => item.status === "completed",
  ).length;
  const inProgress = candidateSessions.filter(
    (item) => item.status === "in_progress",
  ).length;

  return {
    id: interview._id.toString(),
    title: interview.title,
    job_role: interview.jobRole,
    experience_level: interview.experienceLevel,
    difficulty: interview.difficulty,
    interview_format: interview.interviewFormat,
    question_count: interview.questionCount,
    time_limit: interview.timeLimit,
    created_at: interview.createdAt,
    status: attempted && completed === attempted ? "expired" : "active",
    access_token: interview.accessToken,
    topics: interview.topics || [],
    skill_graph: interview.skillGraph || [],
    candidates: {
      attempted,
      completed,
      in_progress: inProgress,
    },
  };
}

async function buildCandidateQuestions(interviewId, sessionId) {
  const [textQuestions, codingQuestions, answers, codeSubmissions, aiUsageLogs] =
    await Promise.all([
      Question.find({ interviewId, sessionId: { $in: [null, sessionId] } })
        .sort({ sequence: 1 })
        .lean(),
      CodingQuestion.find({ interviewId, sessionId: { $in: [null, sessionId] } })
        .sort({ sequence: 1 })
        .lean(),
      Answer.find({ interviewId, sessionId }).lean(),
      CodeSubmission.find({ interviewId, sessionId }).sort({ updatedAt: -1 }).lean(),
      AIUsageLog.find({ interviewId, sessionId }).lean(),
    ]);

  const answerMap = new Map(
    answers.map((item) => [item.questionId.toString(), item]),
  );
  const latestSubmissionMap = new Map();
  codeSubmissions.forEach((item) => {
    const key = item.questionId.toString();
    if (!latestSubmissionMap.has(key)) {
      latestSubmissionMap.set(key, item);
    }
  });
  const aiUsageByQuestion = aiUsageLogs.reduce((acc, item) => {
    const key = item.questionId?.toString();
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return [
    ...textQuestions.map((question) => {
      const answer = answerMap.get(question._id.toString());
      return {
        id: question._id.toString(),
        question_id: question._id.toString(),
        sequence: question.sequence,
        type: "text",
        question_type: "text",
        title: question.questionText,
        question_text: question.questionText,
        description: "",
        difficulty: question.difficulty,
        topic: question.topic,
        answer_text: answer?.answerText || "",
        code_submission: "",
        language: null,
        time_taken_seconds: answer?.timeTakenSeconds || 0,
        ai_assistance_used: (aiUsageByQuestion[question._id.toString()] || 0) > 0,
        ai_assistance_count: aiUsageByQuestion[question._id.toString()] || 0,
        evaluation: answer?.evaluation || {},
        strengths: answer?.evaluation?.strengths || [],
        weaknesses: answer?.evaluation?.weaknesses || [],
        improvements:
          answer?.evaluation?.improvements ||
          answer?.evaluation?.suggestions ||
          [],
      };
    }),
    ...codingQuestions.map((question) => {
      const submission = latestSubmissionMap.get(question._id.toString());
      return {
        id: question._id.toString(),
        question_id: question._id.toString(),
        sequence: question.sequence,
        type: "coding",
        question_type: "coding",
        title: question.title,
        question_text: question.title,
        description: question.description,
        difficulty: question.difficulty,
        topic: question.topic,
        answer_text: submission?.code || "",
        code_submission: submission?.code || "",
        language: submission?.language || null,
        time_taken_seconds: submission?.timeTakenSeconds || 0,
        ai_assistance_used: (aiUsageByQuestion[question._id.toString()] || 0) > 0,
        ai_assistance_count: aiUsageByQuestion[question._id.toString()] || 0,
        evaluation: submission?.evaluation || {},
        strengths:
          submission?.evaluation?.strengths ||
          submission?.aiAnalysis?.improvements ||
          [],
        weaknesses:
          submission?.evaluation?.weaknesses ||
          submission?.aiAnalysis?.mistakes ||
          [],
        improvements:
          submission?.evaluation?.improvements ||
          submission?.aiAnalysis?.suggestions ||
          [],
        test_results: submission?.result?.results || [],
      };
    }),
  ].sort((left, right) => left.sequence - right.sequence);
}

function updateCurrentStepProgress(candidateSession, interview, nextStep) {
  if (!nextStep) {
    return candidateSession.skillProgress || {};
  }

  candidateSession.skillProgress = {
    ...(candidateSession.skillProgress || {}),
    current_skill:
      nextStep.type === "coding"
        ? nextStep.question.topic || "coding"
        : nextStep.question.skill || nextStep.question.topic,
    ordered_skills: interview.skillGraph || [],
  };

  return candidateSession.skillProgress;
}

async function saveTimedOutDraftIfNeeded({
  interview,
  candidateSession,
  payload,
}) {
  if (!payload.current_answer?.trim() || !payload.question_id) {
    return null;
  }

  const question = await Question.findById(payload.question_id);
  if (!question) {
    return null;
  }

  if (
    question.interviewId.toString() !== interview._id.toString() ||
    (question.sessionId &&
      question.sessionId.toString() !== candidateSession._id.toString())
  ) {
    return null;
  }

  const alreadyAnswered = await Answer.findOne({
    interviewId: interview._id,
    sessionId: candidateSession._id,
    questionId: question._id,
  }).lean();
  if (alreadyAnswered) {
    return null;
  }

  const [aiUsageLogs, proctoringLogs] = await Promise.all([
    AIUsageLog.find({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      questionId: question._id,
    }).lean(),
    ProctoringLog.find({
      interviewId: interview._id,
      sessionId: candidateSession._id,
    }).lean(),
  ]);

  const evaluation = await aiService.analyzeAnswer({
    question: question.questionText,
    answer: payload.current_answer,
    timeTaken: payload.time_taken_seconds,
    aiAssisted: aiUsageLogs.length > 0,
    skill: question.skill || question.topic,
    difficulty: question.difficulty,
  });

  const authenticityScore = Math.max(
    5,
    88 - aiUsageLogs.length * 8 - proctoringLogs.length * 9,
  );

  await Answer.create({
    interviewId: interview._id,
    sessionId: candidateSession._id,
    questionId: question._id,
    skill: question.skill || question.topic,
    difficulty: question.difficulty,
    answerText: payload.current_answer,
    timeTakenSeconds: payload.time_taken_seconds,
    typingMetrics: payload.typing_metrics || {},
    evaluation,
    authenticity: {
      authenticity_score: authenticityScore,
      rating:
        authenticityScore >= 75
          ? "high"
          : authenticityScore >= 45
            ? "medium"
            : "low",
      used_ai_help: aiUsageLogs.length > 0,
    },
    confidence: {
      score: Math.max(20, Math.min(90, Number(evaluation.confidenceScore || 65))),
    },
  });
}

async function createSession(req, res, next) {
  try {
    const payload = createInterviewSchema.parse(req.body);
    const interview = await Interview.create({
      title: payload.title,
      jobRole: payload.job_role,
      experienceLevel: payload.experience_level,
      difficulty: payload.difficulty,
      interviewFormat: payload.interview_format,
      questionCount: payload.question_count,
      timeLimit: payload.time_limit,
      topics: payload.topics,
      skillGraph: buildSkillGraph(payload.job_role, payload.topics),
      recruiterId: req.user._id,
      accessToken: crypto.randomBytes(24).toString("hex"),
    });

    await ensureInterviewBlueprintQuestions(interview);

    res.status(201).json(mapSession(interview));
  } catch (error) {
    next(error);
  }
}

async function terminateSession(req, res, next) {
  try {
    const payload = terminateInterviewSchema.parse(req.body);
    const { interview, candidateSession } = await loadSessionByToken(
      payload.session_token,
    );

    if (candidateSession.status === "completed") {
      res.json({
        message: "Interview already completed",
        status: candidateSession.status,
        final_evaluation: candidateSession.finalEvaluation || null,
      });
      return;
    }

    const finalEvaluation = await finalizeInterview(interview, candidateSession, {
      status: "terminated",
      terminationReason: "manual_end",
    });

    res.json({
      message: "Interview ended early",
      status: "terminated",
      final_evaluation: finalEvaluation,
    });
  } catch (error) {
    next(error);
  }
}

async function handleTimeout(req, res, next) {
  try {
    const payload = timeoutInterviewSchema.parse(req.body);
    const { interview, candidateSession } = await loadSessionByToken(
      payload.session_token,
    );

    if (candidateSession.status === "completed") {
      res.json({
        message: "Interview already completed",
        status: candidateSession.status,
        final_evaluation: candidateSession.finalEvaluation || null,
      });
      return;
    }

    await saveTimedOutDraftIfNeeded({ interview, candidateSession, payload });

    const finalEvaluation = await finalizeInterview(interview, candidateSession, {
      status: "timed_out",
      terminationReason: "time_limit_reached",
    });

    res.json({
      message: "Interview timed out",
      status: "timed_out",
      final_evaluation: finalEvaluation,
    });
  } catch (error) {
    next(error);
  }
}

async function generateStarterCode(req, res, next) {
  try {
    const payload = generateStarterCodeSchema.parse(req.body);
    const questionId = payload.questionId || payload.question_id;

    const codingQuestion = await CodingQuestion.findById(questionId);
    if (!codingQuestion) {
      throw new AppError(404, "Coding question not found");
    }

    const starterCode = await aiService.generateStarterCodeForLanguage({
      language: payload.language,
      title: payload.title,
      description: payload.description,
      fallbackStarterCode: codingQuestion.starterCode?.[payload.language] || "",
    });

    await CodingQuestion.findOneAndUpdate(
      { _id: codingQuestion._id },
      {
        $set: {
          [`starterCode.${payload.language}`]: starterCode,
        },
      },
      { new: true },
    );

    console.log("✅ Generated starter code", {
      questionId: codingQuestion._id.toString(),
      language: payload.language,
    });

    res.json({ starterCode });
  } catch (error) {
    console.error("❌ Failed to generate starter code", {
      error: error.message,
    });
    next(error);
  }
}

async function heartbeat(req, res, next) {
  try {
    const payload = heartbeatSchema.parse(req.body);
    const { candidateSession } = await loadSessionByToken(payload.session_token);
    candidateSession.lastHeartbeatAt = new Date();
    await candidateSession.save();
    res.json({ status: "ok", last_heartbeat_at: candidateSession.lastHeartbeatAt });
  } catch (error) {
    next(error);
  }
}

async function createProctoringEvent(req, res, next) {
  try {
    const payload = proctoringSchema.parse(req.body);
    const candidateSession = await InterviewSession.findById(payload.session_id);
    if (!candidateSession) {
      throw new AppError(404, "Session not found");
    }
    const interview = await Interview.findById(candidateSession.interviewId);
    if (!interview) {
      throw new AppError(404, "Interview not found");
    }

    const severity =
      payload.event_type.includes("copy") ||
      payload.event_type.includes("fullscreen") ||
      payload.event_type.includes("face")
        ? "high"
        : payload.event_type.includes("warning")
          ? "medium"
          : "low";

    const log = await ProctoringLog.create({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      eventType: payload.event_type,
      detail: payload.detail,
      metadata: payload.metadata,
      severity,
    });

    candidateSession.violationCount += 1;
    candidateSession.lastHeartbeatAt = new Date();
    await candidateSession.save();

    const event = {
      id: log._id.toString(),
      event_type: log.eventType,
      detail: log.detail,
      created_at: log.createdAt,
      metadata: log.metadata,
    };

    emitToSession(candidateSession._id.toString(), "proctoring:warning", event);
    res.status(201).json(event);
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
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
}

async function listRoleTemplates(_req, res, next) {
  try {
    const templates = await RoleTemplate.find().sort({ createdAt: -1 }).lean();
    res.json({
      templates: templates.map((item) => ({
        id: item._id.toString(),
        role_name: item.roleName,
        description: item.description,
        topics: item.topics,
        default_difficulty: item.defaultDifficulty,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function listInterviewCandidateSessions(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.interviewId).lean();
    if (!interview) {
      throw new AppError(404, "Interview not found");
    }
    ensureInterviewOwnership(req, interview);

    const sessions = await InterviewSession.find({ interviewId: interview._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      interview: mapSession(interview),
      sessions: sessions.map(mapInterviewCandidateSession),
      total: sessions.length,
    });
  } catch (error) {
    next(error);
  }
}

async function getInterviewCandidates(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.interviewId).lean();
    if (!interview) {
      throw new AppError(404, "Interview not found");
    }
    ensureInterviewOwnership(req, interview);

    const [overview, sessions] = await Promise.all([
      buildInterviewOverview(interview),
      InterviewSession.find({ interviewId: interview._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      interview: overview,
      candidates: sessions.map((session) => ({
        id: session._id.toString(),
        candidate_name: session.candidateName,
        candidate_email: session.candidateEmail,
        status: session.status,
        score: session.score ?? null,
        recommendation: mapRecommendationBadge(
          session.finalEvaluation?.recommendation ||
            session.detailedFeedback?.recommendation ||
            session.finalEvaluation?.final_evaluation?.recommendation,
        ),
        authenticity_score: session.authenticityRating ?? null,
        started_at: session.startTime || null,
        completed_at: session.endTime || null,
        duration_seconds:
          session.startTime && session.endTime
            ? Math.max(
                0,
                Math.round(
                  (new Date(session.endTime) - new Date(session.startTime)) / 1000,
                ),
              )
            : null,
        session_token: session.sessionToken,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function getInterviewCandidateDetail(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.interviewId).lean();
    if (!interview) {
      throw new AppError(404, "Interview not found");
    }
    ensureInterviewOwnership(req, interview);

    const candidateSession = await InterviewSession.findOne({
      _id: req.params.sessionId,
      interviewId: interview._id,
    }).lean();
    if (!candidateSession) {
      throw new AppError(404, "Candidate session not found");
    }

    const [questions, proctoringEvents, aiUsageLogs] = await Promise.all([
      buildCandidateQuestions(interview._id, candidateSession._id),
      ProctoringLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      })
        .sort({ createdAt: 1 })
        .lean(),
      AIUsageLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      }).lean(),
    ]);

    const skillScores =
      candidateSession.finalEvaluation?.topicScores ||
      candidateSession.finalEvaluation?.skillScores ||
      candidateSession.detailedFeedback?.skill_scores ||
      {};
    const confidenceValues = questions
      .map((item) => Number(item.evaluation?.confidenceScore || 0))
      .filter((item) => !Number.isNaN(item) && item > 0);
    const averageConfidence = confidenceValues.length
      ? Math.round(
          confidenceValues.reduce((sum, value) => sum + value, 0) /
            confidenceValues.length,
        )
      : null;
    const flagLevel = getRiskFlagLevel(candidateSession, proctoringEvents);

    res.json({
      interview: await buildInterviewOverview(interview),
      session: {
        id: candidateSession._id.toString(),
        candidate_name: candidateSession.candidateName,
        candidate_email: candidateSession.candidateEmail,
        status: candidateSession.status,
        started_at: candidateSession.startTime || null,
        completed_at: candidateSession.endTime || null,
        duration_seconds:
          candidateSession.startTime && candidateSession.endTime
            ? Math.max(
                0,
                Math.round(
                  (new Date(candidateSession.endTime) -
                    new Date(candidateSession.startTime)) /
                    1000,
                ),
              )
            : null,
        overall_score: candidateSession.score ?? null,
        recommendation: mapRecommendationBadge(
          candidateSession.finalEvaluation?.recommendation ||
            candidateSession.detailedFeedback?.recommendation,
        ),
        authenticity_score: candidateSession.authenticityRating ?? null,
        confidence_score: averageConfidence,
        ai_summary:
          candidateSession.finalEvaluation?.summary ||
          candidateSession.detailedFeedback?.summary ||
          "",
        strengths:
          candidateSession.finalEvaluation?.strengths ||
          candidateSession.detailedFeedback?.strengths ||
          [],
        improvements:
          candidateSession.finalEvaluation?.improvements ||
          candidateSession.detailedFeedback?.suggestions ||
          [],
        skill_scores: skillScores,
        authenticity_breakdown: {
          authenticity_score: candidateSession.authenticityRating ?? null,
          cheating_probability_score:
            candidateSession.cheatingProbabilityScore ?? null,
          ai_usage_count: aiUsageLogs.length,
          violation_count: candidateSession.violationCount || 0,
        },
      },
      questions,
      proctoring: {
        events: proctoringEvents.map((item) => ({
          id: item._id.toString(),
          event_type: item.eventType,
          severity: item.severity,
          detail: item.detail,
          metadata: item.metadata || {},
          created_at: item.createdAt,
        })),
        tab_switch_count: proctoringEvents.filter((item) =>
          /tab|window|focus/i.test(item.eventType),
        ).length,
        copy_paste_count: proctoringEvents.filter((item) =>
          /copy|paste/i.test(item.eventType),
        ).length,
        ai_assistant_usage_count: aiUsageLogs.length,
        authenticity_score: candidateSession.authenticityRating ?? null,
        cheating_probability_score:
          candidateSession.cheatingProbabilityScore ?? null,
        flag_level: flagLevel,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function adminAnalytics(req, res, next) {
  try {
    const interviewQuery =
      req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const interviews = await Interview.find(interviewQuery).lean();
    const interviewIds = interviews.map((item) => item._id);
    const [
      roleConfigs,
      violationBreakdown,
      suspiciousSessions,
      candidateSessions,
    ] = await Promise.all([
      RoleTemplate.find().sort({ createdAt: -1 }).lean(),
      ProctoringLog.aggregate([
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ]),
      InterviewSession.find({
        interviewId: { $in: interviewIds },
        $or: [
          { cheatingProbabilityScore: { $gte: 55 } },
          { violationCount: { $gte: 3 } },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean(),
      InterviewSession.find({ interviewId: { $in: interviewIds } }).lean(),
    ]);

    const interviewMap = new Map(
      interviews.map((item) => [item._id.toString(), item]),
    );
    const completionRate = candidateSessions.length
      ? Number(
          (
            (candidateSessions.filter((item) => item.status === "completed").length /
              candidateSessions.length) *
            100
          ).toFixed(2),
        )
      : 0;

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
      status_breakdown: candidateSessions.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
      suspicious_sessions: suspiciousSessions.map((item) => {
        const interview = interviewMap.get(item.interviewId.toString());
        return {
          id: item._id.toString(),
          title: interview?.title || "Interview",
          job_role: interview?.jobRole || "Role",
          candidate_name: item.candidateName,
          candidate_email: item.candidateEmail,
          cheating_probability_score: item.cheatingProbabilityScore ?? 0,
          authenticity_rating: item.authenticityRating ?? null,
          status: item.status,
        };
      }),
      completion_rate: completionRate,
      average_score: candidateSessions.length
        ? Number(
            (
              candidateSessions.reduce(
                (sum, item) => sum + Number(item.score || 0),
                0,
              ) /
              Math.max(
                1,
                candidateSessions.filter((item) => item.score != null).length,
              )
            ).toFixed(2),
          )
        : 0,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  adminAnalytics,
  createInterviewCandidateSession,
  createProctoringEvent,
  createRoleTemplate,
  createSession,
  dashboard,
  deleteSession,
  endInterview: terminateSession,
  generateStarterCode,
  getInterviewCandidateDetail,
  getInterviewCandidates,
  handleTimeout,
  heartbeat,
  interviewResult,
  joinInterview,
  listInterviewCandidateSessions,
  listRoleTemplates,
  listSessions,
  sessionDetail,
  startInterview,
  submitAnswer,
  terminateSession,
  validateInterview,
};

async function listSessions(req, res, next) {
  try {
    const query =
      req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const interviews = await Interview.find(query).sort({ createdAt: -1 }).lean();
    res.json({
      sessions: interviews.map(mapSession),
      total: interviews.length,
    });
  } catch (error) {
    next(error);
  }
}

async function createInterviewCandidateSession(req, res, next) {
  try {
    const payload = createInterviewSessionSchema.parse(req.body);
    const interview = await loadInterviewByAccessToken(payload.access_token);
    const candidateSession = await upsertCandidateSession(interview, payload);

    await ensureSessionBootstrapQuestions(interview, candidateSession);

    res.status(201).json({
      session_id: candidateSession._id.toString(),
      session_token: candidateSession.sessionToken,
      candidate_name: candidateSession.candidateName,
      candidate_email: candidateSession.candidateEmail,
      status: candidateSession.status,
      skill_progress: candidateSession.skillProgress || {},
    });
  } catch (error) {
    next(error);
  }
}

async function joinInterview(req, res, next) {
  try {
    const payload = createInterviewSessionSchema.parse(req.body);
    const interview = await loadInterviewByAccessToken(payload.access_token);
    const candidateSession = await upsertCandidateSession(interview, payload);

    if (["completed", "terminated", "timed_out"].includes(candidateSession.status)) {
      res.json({
        session_id: candidateSession._id.toString(),
        session_token: candidateSession.sessionToken,
        status: candidateSession.status,
        final_evaluation: candidateSession.finalEvaluation || null,
        question: null,
        next_question: null,
      });
      return;
    }

    await ensureSessionBootstrapQuestions(interview, candidateSession);

    const nextStep = await findNextInterviewQuestion(interview, candidateSession);
    if (!nextStep) {
      const finalEvaluation = await finalizeInterview(interview, candidateSession);
      res.json({
        session_id: candidateSession._id.toString(),
        session_token: candidateSession.sessionToken,
        status: "completed",
        final_evaluation: finalEvaluation,
        question: null,
        next_question: null,
      });
      return;
    }

    candidateSession.status = "in_progress";
    candidateSession.startTime = candidateSession.startTime || new Date();
    candidateSession.lastHeartbeatAt = new Date();
    candidateSession.resumeCount += candidateSession.startTime ? 1 : 0;
    updateCurrentStepProgress(candidateSession, interview, nextStep);
    await candidateSession.save();

    res.json({
      session_id: candidateSession._id.toString(),
      session_token: candidateSession.sessionToken,
      status: candidateSession.status,
      current_question: nextStep.question.sequence,
      total_questions: interview.questionCount,
      skill_progress: candidateSession.skillProgress || {},
      question: mapQuestionForResponse(nextStep),
      next_question: mapQuestionForResponse(nextStep),
    });
  } catch (error) {
    next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    const query =
      req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const interviews = await Interview.find(query).sort({ createdAt: -1 }).lean();
    const interviewIds = interviews.map((item) => item._id);
    const candidateSessions = interviewIds.length
      ? await InterviewSession.find({ interviewId: { $in: interviewIds } }).lean()
      : [];

    const completedSessions = candidateSessions.filter(
      (session) => session.status === "completed",
    );
    const scoredSessions = candidateSessions.filter(
      (session) => typeof session.score === "number",
    );
    const riskedSessions = candidateSessions.filter(
      (session) => typeof session.cheatingProbabilityScore === "number",
    );
    const dropOffMap = {};
    candidateSessions.forEach((session) => {
      const value = session.skillProgress?.current_skill || "not_started";
      dropOffMap[value] = (dropOffMap[value] || 0) + 1;
    });
    const mostCommonDropOff =
      Object.entries(dropOffMap).sort((left, right) => right[1] - left[1])[0]?.[0] ||
      null;

    res.json({
      total_sessions: interviews.length,
      active_sessions: candidateSessions.filter(
        (session) => session.status === "in_progress",
      ).length,
      completed_sessions: completedSessions.length,
      average_score: scoredSessions.length
        ? Number(
            (
              scoredSessions.reduce((sum, item) => sum + item.score, 0) /
              scoredSessions.length
            ).toFixed(2),
          )
        : 0,
      average_cheating_probability: riskedSessions.length
        ? Number(
            (
              riskedSessions.reduce(
                (sum, item) => sum + item.cheatingProbabilityScore,
                0,
              ) / riskedSessions.length
            ).toFixed(2),
          )
        : 0,
      completion_rate: candidateSessions.length
        ? Number(
            ((completedSessions.length / candidateSessions.length) * 100).toFixed(2),
          )
        : 0,
      drop_off_point: mostCommonDropOff,
      recent_sessions: interviews.slice(0, 5).map(mapSession),
      suspicious_sessions: candidateSessions
        .filter(
          (session) =>
            (session.cheatingProbabilityScore || 0) >= 55 ||
            (session.violationCount || 0) >= 3,
        )
        .slice(0, 5)
        .map(mapInterviewCandidateSession),
    });
  } catch (error) {
    next(error);
  }
}

async function sessionDetail(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.sessionId).lean();
    if (!interview) {
      throw new AppError(404, "Session not found");
    }
    ensureInterviewOwnership(req, interview);

    const [questions, codingQuestions, candidateSessions] = await Promise.all([
      Question.find({ interviewId: interview._id, sessionId: null })
        .sort({ sequence: 1 })
        .lean(),
      CodingQuestion.find({ interviewId: interview._id, sessionId: null })
        .sort({ sequence: 1 })
        .lean(),
      InterviewSession.find({ interviewId: interview._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      interview: {
        ...mapSession(interview),
        topics: interview.topics,
        skill_graph: interview.skillGraph || [],
        questions: [
          ...questions.map((question) => toQuestion(question)),
          ...codingQuestions.map((question) => toCodingQuestion(question)),
        ].sort((left, right) => left.sequence - right.sequence),
      },
      candidate_sessions: candidateSessions.map(mapInterviewCandidateSession),
    });
  } catch (error) {
    next(error);
  }
}

async function deleteSession(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.sessionId);
    if (!interview) {
      throw new AppError(404, "Session not found");
    }
    ensureInterviewOwnership(req, interview);

    await Promise.all([
      Question.deleteMany({ interviewId: interview._id }),
      CodingQuestion.deleteMany({ interviewId: interview._id }),
      Answer.deleteMany({ interviewId: interview._id }),
      AIUsageLog.deleteMany({ interviewId: interview._id }),
      ProctoringLog.deleteMany({ interviewId: interview._id }),
      CodeSubmission.deleteMany({ interviewId: interview._id }),
      Result.deleteMany({ interviewId: interview._id }),
      InterviewSession.deleteMany({ interviewId: interview._id }),
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
    const interview = await loadInterviewByAccessToken(payload.access_token);
    const attemptedCount = await InterviewSession.countDocuments({
      interviewId: interview._id,
    });

    res.json({
      interview_id: interview._id.toString(),
      title: interview.title,
      job_role: interview.jobRole,
      experience_level: interview.experienceLevel,
      question_count: interview.questionCount,
      time_limit: interview.timeLimit,
      difficulty: interview.difficulty,
      interview_format: interview.interviewFormat || "mixed",
      topics: interview.topics,
      skill_graph: interview.skillGraph || [],
      attempted_count: attemptedCount,
    });
  } catch (error) {
    next(error);
  }
}

async function startInterview(req, res, next) {
  try {
    const payload = sessionTokenSchema.parse(req.body);
    const { interview, candidateSession } = await loadSessionByToken(
      payload.session_token,
    );
    ensureSessionActive(candidateSession);

    await ensureSessionBootstrapQuestions(interview, candidateSession);

    const nextStep = await findNextInterviewQuestion(interview, candidateSession);
    if (!nextStep) {
      const finalEvaluation = await finalizeInterview(interview, candidateSession);
      res.json({
        session_id: candidateSession._id.toString(),
        session_token: candidateSession.sessionToken,
        status: "completed",
        current_question: interview.questionCount,
        total_questions: interview.questionCount,
        skill_progress: candidateSession.skillProgress || {},
        question: null,
        next_question: null,
        final_evaluation: finalEvaluation,
        warnings: [],
      });
      return;
    }

    candidateSession.status = "in_progress";
    candidateSession.startTime = candidateSession.startTime || new Date();
    candidateSession.lastHeartbeatAt = new Date();
    if (candidateSession.startTime) {
      candidateSession.resumeCount += 1;
    }
    updateCurrentStepProgress(candidateSession, interview, nextStep);
    await candidateSession.save();

    res.json({
      session_id: candidateSession._id.toString(),
      session_token: candidateSession.sessionToken,
      current_question: nextStep.question.sequence,
      total_questions: interview.questionCount,
      skill_progress: candidateSession.skillProgress || {},
      question: mapQuestionForResponse(nextStep),
      next_question: mapQuestionForResponse(nextStep),
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
    const { interview, candidateSession } = await loadSessionByToken(
      payload.session_token,
    );
    ensureSessionActive(candidateSession);

    const question = await Question.findById(payload.question_id);
    if (!question) {
      throw new AppError(404, "Question not found");
    }
    if (
      question.interviewId.toString() !== interview._id.toString() ||
      (question.sessionId &&
        question.sessionId.toString() !== candidateSession._id.toString())
    ) {
      throw new AppError(400, "Question does not belong to this interview session");
    }

    const existingAnswer = await Answer.findOne({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      questionId: question._id,
    }).lean();
    if (existingAnswer) {
      throw new AppError(409, "Question has already been answered in this session");
    }

    const [aiUsageLogs, proctoringLogs] = await Promise.all([
      AIUsageLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: question._id,
      }).lean(),
      ProctoringLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      }).lean(),
    ]);

    const evaluation = await aiService.analyzeAnswer({
      question: question.questionText,
      answer: payload.answer_text,
      timeTaken: payload.time_taken_seconds,
      aiAssisted: aiUsageLogs.length > 0,
      skill: question.skill || question.topic,
      difficulty: question.difficulty,
    });

    const confidenceScore = Math.max(
      20,
      Math.min(
        95,
        78 -
          (payload.typing_metrics.pauseCount || 0) * 4 -
          (payload.typing_metrics.editCount || 0) * 2,
      ),
    );
    const authenticityScore = Math.max(
      5,
      90 -
        aiUsageLogs.length * 8 -
        proctoringLogs.length * 9 -
        (payload.time_taken_seconds < 25 ? 10 : 0),
    );

    const authenticity = {
      authenticity_score: authenticityScore,
      rating:
        authenticityScore >= 75
          ? "high"
          : authenticityScore >= 45
            ? "medium"
            : "low",
      used_ai_help: aiUsageLogs.length > 0,
    };
    const confidence = {
      score: confidenceScore,
      typing_speed: payload.typing_metrics.typingSpeed || 0,
      pause_count: payload.typing_metrics.pauseCount || 0,
      edit_count: payload.typing_metrics.editCount || 0,
      signal:
        confidenceScore >= 70
          ? "steady"
          : confidenceScore >= 45
            ? "hesitant"
            : "erratic",
    };

    const storedAnswer = await Answer.create({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      questionId: question._id,
      skill: question.skill || question.topic,
      difficulty: question.difficulty,
      answerText: payload.answer_text,
      timeTakenSeconds: payload.time_taken_seconds,
      typingMetrics: payload.typing_metrics,
      evaluation,
      authenticity,
      confidence,
    });

    const nextStep = await generateNextQuestionForSession({
      interview,
      candidateSession,
      lastResponse: {
        type: "text",
        skill: question.skill || question.topic,
        difficulty: question.difficulty,
        evaluation,
      },
    });

    updateCurrentStepProgress(candidateSession, interview, nextStep);
    await candidateSession.save();

    const finalEvaluation = nextStep
      ? null
      : await finalizeInterview(interview, candidateSession);

    res.json({
      status: nextStep ? "in_progress" : "completed",
      evaluation: mapEvaluationPayload(evaluation),
      authenticity,
      confidence,
      progress: {
        current_question: nextStep
          ? nextStep.question.sequence
          : interview.questionCount,
        total_questions: interview.questionCount,
      },
      skill_progress: candidateSession.skillProgress || {},
      next_question: mapQuestionForResponse(nextStep),
      final_evaluation: finalEvaluation,
      answer_id: storedAnswer._id.toString(),
    });
  } catch (error) {
    next(error);
  }
}

async function interviewResult(req, res, next) {
  try {
    const sessionToken =
      req.query.session_token || req.query.session || req.query.sessionToken;
    if (!sessionToken) {
      throw new AppError(400, "session_token is required");
    }

    const candidateSession = await InterviewSession.findOne({
      sessionToken,
    }).lean();
    if (!candidateSession) {
      throw new AppError(404, "Interview session not found");
    }

    const interview = await Interview.findOne({
      accessToken: req.params.accessToken,
    }).lean();
    if (
      !interview ||
      interview._id.toString() !== candidateSession.interviewId.toString()
    ) {
      throw new AppError(404, "Interview not found");
    }

    const [questions, codingQuestions, answers, codeSubmissions, violations, aiUsageLogs] =
      await Promise.all([
        Question.find({
          interviewId: interview._id,
          sessionId: { $in: [null, candidateSession._id] },
        })
          .sort({ sequence: 1 })
          .lean(),
        CodingQuestion.find({
          interviewId: interview._id,
          sessionId: { $in: [null, candidateSession._id] },
        })
          .sort({ sequence: 1 })
          .lean(),
        Answer.find({
          interviewId: interview._id,
          sessionId: candidateSession._id,
        }).lean(),
        CodeSubmission.find({
          interviewId: interview._id,
          sessionId: candidateSession._id,
        })
          .sort({ updatedAt: -1 })
          .lean(),
        ProctoringLog.find({
          interviewId: interview._id,
          sessionId: candidateSession._id,
        })
          .sort({ createdAt: 1 })
          .lean(),
        AIUsageLog.find({
          interviewId: interview._id,
          sessionId: candidateSession._id,
        }).lean(),
      ]);

    const answerMap = new Map(
      answers.map((item) => [item.questionId.toString(), item]),
    );
    const latestCodingSubmission = new Map();
    codeSubmissions.forEach((item) => {
      const key = item.questionId.toString();
      if (!latestCodingSubmission.has(key)) {
        latestCodingSubmission.set(key, item);
      }
    });

    res.json({
      session_id: candidateSession._id.toString(),
      title: interview.title,
      job_role: interview.jobRole,
      interview_format: interview.interviewFormat,
      candidate_name: candidateSession.candidateName,
      status: candidateSession.status,
      score: candidateSession.score ?? null,
      authenticity_rating: candidateSession.authenticityRating ?? null,
      cheating_probability_score:
        candidateSession.cheatingProbabilityScore ?? null,
      detailed_feedback:
        candidateSession.detailedFeedback ||
        candidateSession.finalEvaluation ||
        {},
      final_evaluation: candidateSession.finalEvaluation || {},
      skill_progress: candidateSession.skillProgress || {},
      ai_usage_count: aiUsageLogs.length,
      violations: violations.map((log) => ({
        id: log._id.toString(),
        event_type: log.eventType,
        detail: log.detail,
        created_at: log.createdAt,
        metadata: log.metadata,
      })),
      questions: [
        ...questions.map((question) => {
          const answer = answerMap.get(question._id.toString());
          return {
            ...toQuestion(question),
            answer_text: answer?.answerText || "",
            evaluation: answer?.evaluation || {},
            confidence: answer?.confidence || {},
            authenticity: answer?.authenticity || {},
          };
        }),
        ...codingQuestions.map((question) => {
          const submission = latestCodingSubmission.get(question._id.toString());
          return {
            ...toCodingQuestion(question, submission),
            answer_text: submission?.code || "",
            evaluation: submission?.evaluation || {},
            confidence: submission?.confidence || {},
            authenticity: submission?.authenticity || {},
          };
        }),
      ].sort((left, right) => left.sequence - right.sequence),
      ended_early: candidateSession.status === "terminated",
      timed_out: candidateSession.status === "timed_out",
      completed_at: candidateSession.endTime || null,
    });
  } catch (error) {
    next(error);
  }
}
