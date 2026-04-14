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
} = require("../models");
const aiService = require("./ai.service");
const { AppError } = require("../utils/appError");

const SUPPORTED_LANGUAGES = ["javascript", "python", "java", "cpp"];

function buildSkillGraph(role, topics = []) {
  const uniqueTopics = Array.from(new Set((topics || []).filter(Boolean)));
  if (uniqueTopics.length) {
    return uniqueTopics;
  }
  if (/designer|design/i.test(role)) {
    return [
      "user research",
      "interaction design",
      "design systems",
      "experimentation",
    ];
  }
  if (/product manager|pm/i.test(role)) {
    return ["prioritization", "execution", "stakeholder management", "metrics"];
  }
  if (/hr|recruit/i.test(role)) {
    return [
      "candidate experience",
      "conflict handling",
      "policy judgment",
      "communication",
    ];
  }
  return ["fundamentals", "delivery", "scalability", "system design"];
}

function mapSession(interview) {
  return {
    id: interview._id.toString(),
    title: interview.title,
    job_role: interview.jobRole,
    experience_level: interview.experienceLevel,
    difficulty: interview.difficulty,
    interview_format: interview.interviewFormat || "mixed",
    question_count: interview.questionCount,
    time_limit: interview.timeLimit,
    access_token: interview.accessToken,
    created_at: interview.createdAt,
  };
}

function mapInterviewCandidateSession(session) {
  return {
    id: session._id.toString(),
    candidate_name: session.candidateName,
    candidate_email: session.candidateEmail,
    status: session.status,
    session_token: session.sessionToken,
    created_at: session.createdAt,
    score: session.score ?? null,
    authenticity_rating: session.authenticityRating ?? null,
    cheating_probability_score: session.cheatingProbabilityScore ?? null,
    violation_count: session.violationCount ?? 0,
    skill_progress: session.skillProgress || {},
    end_time: session.endTime || null,
  };
}

function toQuestion(question) {
  return {
    id: question._id.toString(),
    question_type: "text",
    sequence: question.sequence,
    question_text: question.questionText,
    topic: question.topic,
    skill: question.skill || question.topic,
    difficulty: question.difficulty,
    expected_time_seconds: question.expectedTimeSeconds,
    hints: question.hints || [],
    adaptive_metadata: question.adaptiveMetadata || {},
  };
}

function toCodingQuestion(question, submission) {
  const visibleCases = (question.testCases || [])
    .filter((item) => !item.hidden)
    .map((item) => ({
      input: item.input,
      expected_output: item.expectedOutput,
      explanation: item.explanation,
    }));

  return {
    id: question._id.toString(),
    question_type: "coding",
    sequence: question.sequence,
    title: question.title,
    question_text: question.title,
    description: question.description,
    topic: question.topic || "algorithms",
    skill: question.topic || "algorithms",
    difficulty: question.difficulty,
    constraints: question.constraints || [],
    starter_code: question.starterCode || {},
    supported_languages: question.supportedLanguages || SUPPORTED_LANGUAGES,
    sample_test_cases: visibleCases,
    hidden_test_case_count: (question.testCases || []).filter((item) => item.hidden)
      .length,
    draft_code: submission?.code || "",
    language: submission?.language || "javascript",
    execution_result: submission?.result || null,
    ai_analysis: submission?.aiAnalysis || null,
    evaluation: submission?.evaluation || null,
    confidence: submission?.confidence || null,
    authenticity: submission?.authenticity || null,
  };
}

function getQuestionTypeForSequence(interviewFormat, sequence) {
  if (interviewFormat === "theoretical") {
    return "text";
  }
  if (interviewFormat === "coding") {
    return "coding";
  }
  return sequence % 2 === 1 ? "text" : "coding";
}

function countTextQuestions(interview) {
  if (interview.interviewFormat === "theoretical") {
    return interview.questionCount;
  }
  if (interview.interviewFormat === "coding") {
    return 0;
  }
  return Math.ceil(interview.questionCount / 2);
}

function normalizeCodingTestCases(testCases = []) {
  const normalized = (testCases || []).map((item) => ({
    input: String(item.input || ""),
    expectedOutput: String(item.expectedOutput || item.expected_output || ""),
    hidden: Boolean(item.hidden),
    explanation: String(item.explanation || ""),
  }));

  if (!normalized.length) {
    normalized.push({
      input: "5\n1 2 3 4 5\n",
      expectedOutput: "15",
      hidden: false,
      explanation: "Basic sample",
    });
  }

  if (!normalized.some((item) => item.hidden)) {
    normalized.push({
      ...normalized[normalized.length - 1],
      hidden: true,
      explanation:
        normalized[normalized.length - 1].explanation || "Hidden validation",
    });
  }

  return normalized;
}

async function getNextSequence(interviewId) {
  const [textCount, codingCount] = await Promise.all([
    Question.countDocuments({ interviewId }),
    CodingQuestion.countDocuments({ interviewId }),
  ]);

  return textCount + codingCount + 1;
}

async function loadInterviewByAccessToken(accessToken) {
  const interview = await Interview.findOne({ accessToken });
  if (!interview) {
    throw new AppError(404, "Invalid access token");
  }
  return interview;
}

async function loadSessionByToken(sessionToken) {
  const candidateSession = await InterviewSession.findOne({ sessionToken });
  if (!candidateSession) {
    throw new AppError(404, "Interview session not found");
  }
  const interview = await Interview.findById(candidateSession.interviewId);
  if (!interview) {
    throw new AppError(404, "Interview not found");
  }
  return { interview, candidateSession };
}

async function createTextQuestion({
  interview,
  sessionId = null,
  sequence,
  generatedQuestion,
  adaptiveMetadata = {},
  generationSource = "ai",
}) {
  const created = await Question.create({
    interviewId: interview._id,
    sessionId,
    sequence,
    questionType: "text",
    topic: generatedQuestion.topic || generatedQuestion.skill,
    skill: generatedQuestion.skill || generatedQuestion.topic,
    difficulty: generatedQuestion.difficulty || interview.difficulty,
    questionText:
      generatedQuestion.questionText || generatedQuestion.question_text,
    expectedTimeSeconds:
      generatedQuestion.expectedTimeSeconds ||
      generatedQuestion.expected_time_seconds ||
      240,
    hints: generatedQuestion.hints || [],
    adaptiveMetadata,
    generationSource,
  });

  return created;
}

async function createCodingQuestion({
  interview,
  sessionId = null,
  sequence,
  generatedQuestion,
  generationSource = "ai",
}) {
  const created = await CodingQuestion.create({
    interviewId: interview._id,
    sessionId,
    sequence,
    title: generatedQuestion.title,
    description: generatedQuestion.description,
    difficulty: generatedQuestion.difficulty || interview.difficulty,
    constraints: generatedQuestion.constraints || [],
    starterCode: generatedQuestion.starterCode || {},
    testCases: normalizeCodingTestCases(generatedQuestion.testCases || []),
    supportedLanguages:
      generatedQuestion.supportedLanguages || SUPPORTED_LANGUAGES,
    topic:
      generatedQuestion.topic ||
      interview.topics?.[0] ||
      interview.skillGraph?.[0] ||
      "algorithms",
    generationSource,
  });

  return created;
}

async function ensureInterviewBlueprintQuestions(interview) {
  const [textCount, codingCount] = await Promise.all([
    Question.countDocuments({ interviewId: interview._id, sessionId: null }),
    CodingQuestion.countDocuments({ interviewId: interview._id, sessionId: null }),
  ]);

  if (textCount || codingCount) {
    return;
  }

  const primarySkill =
    interview.skillGraph?.[0] || interview.topics?.[0] || "fundamentals";

  if (interview.interviewFormat !== "coding") {
    const nextSequence = await getNextSequence(interview._id);
    const [generatedText] = await aiService.generateQuestions({
      role: interview.jobRole,
      difficulty: interview.difficulty,
      topics: [primarySkill],
      count: 1,
      experienceLevel: interview.experienceLevel,
      interviewType: "non_coding",
      previousAnswers: [],
    });
    await createTextQuestion({
      interview,
      sequence: nextSequence,
      generatedQuestion: generatedText,
      adaptiveMetadata: { adaptiveStage: "initial_blueprint" },
      generationSource: "interview_create",
    });
  }

  if (interview.interviewFormat !== "theoretical") {
    const nextSequence = await getNextSequence(interview._id);
    const codingQuestion = await aiService.generateCodingQuestion({
      role: interview.jobRole,
      difficulty: interview.difficulty,
      topics: interview.topics,
      experienceLevel: interview.experienceLevel,
    });
    await createCodingQuestion({
      interview,
      sequence: nextSequence,
      generatedQuestion: codingQuestion,
      generationSource: "interview_create",
    });
  }
}

async function ensureSessionBootstrapQuestions(interview, candidateSession) {
  await ensureInterviewBlueprintQuestions(interview);
}

async function getSessionResponseCounts(interviewId, sessionId) {
  const [answers, submissions] = await Promise.all([
    Answer.countDocuments({ interviewId, sessionId }),
    CodeSubmission.countDocuments({
      interviewId,
      sessionId,
      status: "submitted",
    }),
  ]);

  return {
    answers,
    submissions,
    totalResponses: answers + submissions,
  };
}

async function getLatestCodingDraftMap(interviewId, sessionId) {
  const submissions = await CodeSubmission.find({
    interviewId,
    sessionId,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const latestDrafts = new Map();
  submissions.forEach((item) => {
    const key = item.questionId.toString();
    if (!latestDrafts.has(key)) {
      latestDrafts.set(key, item);
    }
  });

  return latestDrafts;
}

async function findNextInterviewQuestion(interview, candidateSession) {
  const [textQuestions, codingQuestions, answers, codeSubmissions, latestDrafts] =
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
        status: "submitted",
      }).lean(),
      getLatestCodingDraftMap(interview._id, candidateSession._id),
    ]);

  const answeredTextIds = new Set(
    answers.map((item) => item.questionId.toString()),
  );
  const answeredCodingIds = new Set(
    codeSubmissions.map((item) => item.questionId.toString()),
  );

  const queue = [
    ...textQuestions.map((question) => ({
      type: "text",
      sequence: question.sequence,
      question,
    })),
    ...codingQuestions.map((question) => ({
      type: "coding",
      sequence: question.sequence,
      question,
    })),
  ].sort((left, right) => left.sequence - right.sequence);

  for (const item of queue) {
    if (
      item.type === "text" &&
      !answeredTextIds.has(item.question._id.toString())
    ) {
      return { type: "text", question: item.question };
    }

    if (
      item.type === "coding" &&
      !answeredCodingIds.has(item.question._id.toString())
    ) {
      return {
        type: "coding",
        question: item.question,
        submission: latestDrafts.get(item.question._id.toString()) || null,
      };
    }
  }

  return null;
}

async function buildRecentPerformanceSnapshot(interview, candidateSession) {
  const [answers, submissions] = await Promise.all([
    Answer.find({
      interviewId: interview._id,
      sessionId: candidateSession._id,
    })
      .sort({ createdAt: 1 })
      .lean(),
    CodeSubmission.find({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      status: "submitted",
    })
      .sort({ updatedAt: 1 })
      .lean(),
  ]);

  return [
    ...answers.map((item) => ({
      type: "text",
      skill: item.skill,
      score: item.evaluation?.score,
      answerText: String(item.answerText || "").slice(0, 280),
      difficulty: item.difficulty,
      createdAt: item.createdAt,
    })),
    ...submissions.map((item) => ({
      type: "coding",
      skill: item.topic || "coding",
      score: item.evaluation?.score,
      answerText: String(item.code || "").slice(0, 280),
      difficulty: item.evaluation?.suggestedDifficulty || interview.difficulty,
      createdAt: item.updatedAt,
    })),
  ]
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-3);
}

async function generateAdaptiveTextQuestion({
  interview,
  candidateSession,
  sequence,
  lastResponse,
}) {
  const skillGraph = interview.skillGraph || buildSkillGraph(interview.jobRole, interview.topics);
  const accuracy = Math.round(Number(lastResponse?.evaluation?.score || 0) * 10);
  const currentSkill =
    lastResponse.skill ||
    skillGraph[0] ||
    interview.topics?.[0] ||
    "fundamentals";
  const currentIndex = Math.max(0, skillGraph.indexOf(currentSkill));
  const nextSkill =
    accuracy >= 75 ? skillGraph[currentIndex + 1] || currentSkill : currentSkill;
  const nextDifficulty = aiService.nextDifficultyFromAccuracy(
    lastResponse.difficulty || interview.difficulty,
    accuracy,
  );
  const history = await buildRecentPerformanceSnapshot(interview, candidateSession);
  const counts = await getSessionResponseCounts(interview._id, candidateSession._id);
  const generatedQuestion = await aiService.generateAdaptiveQuestion({
    role: interview.jobRole,
    interviewType: "non_coding",
    experienceLevel: interview.experienceLevel,
    skill: nextSkill,
    targetDifficulty: nextDifficulty,
    previousAnswers: history,
    currentPerformance: {
      currentSkill,
      accuracy,
      currentDifficulty: lastResponse.difficulty || interview.difficulty,
      totalAnswered: counts.totalResponses,
      remaining: Math.max(0, countTextQuestions(interview) - counts.answers),
    },
  });

  candidateSession.skillProgress = {
    ...(candidateSession.skillProgress || {}),
    [currentSkill]: accuracy,
    current_skill: nextSkill,
    current_accuracy: accuracy,
    last_difficulty: nextDifficulty,
  };
  await candidateSession.save();

  return createTextQuestion({
    interview,
    sessionId: candidateSession._id,
    sequence,
    generatedQuestion,
    adaptiveMetadata: {
      adaptiveStage: "generated",
      derivedFromSkill: currentSkill,
      accuracyBand: accuracy < 50 ? "low" : accuracy <= 75 ? "medium" : "high",
    },
  });
}

async function generateAdaptiveCodingQuestion({
  interview,
  candidateSession,
  sequence,
  lastResponse,
}) {
  const nextDifficulty =
    lastResponse.evaluation?.suggestedDifficulty ||
    aiService.nextDifficultyFromAccuracy(
      lastResponse.difficulty || interview.difficulty,
      Math.round(Number(lastResponse.evaluation?.score || 0) * 10),
    );

  const codingQuestion = await aiService.generateCodingQuestion({
    role: interview.jobRole,
    difficulty: nextDifficulty,
    topics: [
      lastResponse.skill ||
        interview.skillGraph?.[0] ||
        interview.topics?.[0] ||
        "algorithms",
    ],
    experienceLevel: interview.experienceLevel,
  });

  return createCodingQuestion({
    interview,
    sessionId: candidateSession._id,
    sequence,
    generatedQuestion: codingQuestion,
  });
}

async function generateNextQuestionForSession({
  interview,
  candidateSession,
  lastResponse,
}) {
  const queued = await findNextInterviewQuestion(interview, candidateSession);
  if (queued) {
    return queued;
  }

  const counts = await getSessionResponseCounts(interview._id, candidateSession._id);
  if (counts.totalResponses >= interview.questionCount) {
    return null;
  }

  const nextSequence = await getNextSequence(interview._id);
  const nextType = getQuestionTypeForSequence(interview.interviewFormat, nextSequence);

  if (nextType === "text") {
    const question = await generateAdaptiveTextQuestion({
      interview,
      candidateSession,
      sequence: nextSequence,
      lastResponse,
    });
    return { type: "text", question };
  }

  const question = await generateAdaptiveCodingQuestion({
    interview,
    candidateSession,
    sequence: nextSequence,
    lastResponse,
  });
  return { type: "coding", question, submission: null };
}

function ensureSessionActive(candidateSession) {
  if (candidateSession.status === "completed") {
    throw new AppError(409, "Interview already completed");
  }
  if (candidateSession.status === "terminated") {
    throw new AppError(409, "Interview already ended");
  }
  if (candidateSession.status === "timed_out") {
    throw new AppError(409, "Interview already timed out");
  }
}

function mapQuestionForResponse(step) {
  if (!step) {
    return null;
  }
  return step.type === "coding"
    ? toCodingQuestion(step.question, step.submission)
    : toQuestion(step.question);
}

function buildProctoringSummary(proctoringLogs, aiUsageLogs) {
  const eventCounts = proctoringLogs.reduce((acc, item) => {
    acc[item.eventType] = (acc[item.eventType] || 0) + 1;
    return acc;
  }, {});

  return {
    total_events: proctoringLogs.length,
    event_counts: eventCounts,
    ai_usage_count: aiUsageLogs.length,
    suspicious: Object.values(eventCounts).some((count) => count >= 2),
  };
}

async function finalizeInterview(interview, candidateSession, options = {}) {
  const status = options.status || "completed";
  const terminationReason = options.terminationReason || null;
  const [answers, codeSubmissions, aiUsageLogs, proctoringLogs, textQuestions, codingQuestions] =
    await Promise.all([
      Answer.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      })
        .sort({ createdAt: 1 })
        .lean(),
      CodeSubmission.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
        status: "submitted",
      })
        .sort({ updatedAt: 1 })
        .lean(),
      AIUsageLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      })
        .sort({ createdAt: 1 })
        .lean(),
      ProctoringLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      })
        .sort({ createdAt: 1 })
        .lean(),
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
    ]);

  const computed = await aiService.finalEvaluation({
    answers,
    aiUsageLogs,
    proctoringLogs,
    codeSubmissions,
  });

  const textMap = new Map(textQuestions.map((item) => [item._id.toString(), item]));
  const codingMap = new Map(codingQuestions.map((item) => [item._id.toString(), item]));
  const questionReviews = [
    ...answers.map((item) => {
      const question = textMap.get(item.questionId.toString());
      return {
        question_id: item.questionId.toString(),
        question_type: "text",
        sequence: question?.sequence || 0,
        question_text: question?.questionText || "",
        topic: question?.topic || item.skill,
        skill: item.skill,
        answer_text: item.answerText,
        evaluation: item.evaluation || {},
        confidence: item.confidence || {},
        authenticity: item.authenticity || {},
      };
    }),
    ...codeSubmissions.map((item) => {
      const question = codingMap.get(item.questionId.toString());
      return {
        question_id: item.questionId.toString(),
        question_type: "coding",
        sequence: question?.sequence || 0,
        question_text: question?.title || "",
        title: question?.title || "",
        description: question?.description || "",
        topic: question?.topic || "coding",
        skill: question?.topic || "coding",
        answer_text: item.code,
        evaluation: item.evaluation || {},
        confidence: item.confidence || {},
        authenticity: item.authenticity || {},
        execution_result: item.result || {},
        ai_analysis: item.aiAnalysis || {},
      };
    }),
  ].sort((left, right) => left.sequence - right.sequence);

  const detailedFeedback = {
    summary: computed.summary,
    strengths:
      computed.strengths?.length
        ? computed.strengths
        : questionReviews.flatMap((item) => item.evaluation?.strengths || []).slice(0, 4),
    weaknesses: questionReviews
      .flatMap((item) => item.evaluation?.weaknesses || item.ai_analysis?.mistakes || [])
      .slice(0, 5),
    suggestions:
      computed.improvements?.length
        ? computed.improvements
        : questionReviews
            .flatMap(
              (item) =>
                item.evaluation?.improvements ||
                item.ai_analysis?.suggestions ||
                [],
            )
            .slice(0, 5),
    recommendation: computed.recommendation,
    topic_scores: computed.topicScores || computed.skillScores || {},
    skill_scores: computed.skillScores || {},
    performance_trend: computed.performanceTrend || "steady",
    question_reviews: questionReviews,
    proctoring_summary: buildProctoringSummary(proctoringLogs, aiUsageLogs),
  };

  const finalEvaluation = {
    overallScore: computed.finalScore,
    recommendation: computed.recommendation,
    summary: computed.summary,
    strengths: detailedFeedback.strengths,
    improvements: detailedFeedback.suggestions,
    topicScores: computed.topicScores || computed.skillScores || {},
    performanceTrend: computed.performanceTrend || "steady",
    questionReviews,
    proctoringSummary: detailedFeedback.proctoring_summary,
    status,
    endedEarly: status === "terminated",
    timedOut: status === "timed_out",
    terminationReason,
  };

  candidateSession.status = status;
  candidateSession.endTime = new Date();
  candidateSession.terminationReason = terminationReason;
  candidateSession.score = computed.finalScore;
  candidateSession.authenticityRating = computed.authenticityScore;
  candidateSession.cheatingProbabilityScore = computed.cheatingProbability;
  candidateSession.detailedFeedback = detailedFeedback;
  candidateSession.finalEvaluation = finalEvaluation;
  candidateSession.skillProgress = {
    ...(candidateSession.skillProgress || {}),
    skill_scores: computed.skillScores || {},
  };
  await candidateSession.save();

  await Result.findOneAndUpdate(
    { interviewId: interview._id, sessionId: candidateSession._id },
    {
      interviewId: interview._id,
      sessionId: candidateSession._id,
      finalScore: computed.finalScore,
      authenticityScore: computed.authenticityScore,
      cheatingProbability: computed.cheatingProbability,
      recommendation: computed.recommendation,
      payload: finalEvaluation,
    },
    { upsert: true, new: true },
  );

  return {
    score: computed.finalScore,
    authenticity_rating: computed.authenticityScore,
    cheating_probability_score: computed.cheatingProbability,
    detailed_feedback: detailedFeedback,
    final_evaluation: finalEvaluation,
  };
}

async function upsertCandidateSession(interview, payload) {
  const email = payload.candidate_email.toLowerCase();
  let candidateSession = await InterviewSession.findOne({
    interviewId: interview._id,
    candidateEmail: email,
  });

  if (!candidateSession) {
    candidateSession = await InterviewSession.create({
      interviewId: interview._id,
      candidateName: payload.candidate_name,
      candidateEmail: email,
      sessionToken: crypto.randomBytes(24).toString("hex"),
      skillProgress: {
        current_skill:
          interview.skillGraph?.[0] ||
          interview.topics?.[0] ||
          "fundamentals",
        ordered_skills: interview.skillGraph || [],
      },
      lastHeartbeatAt: new Date(),
    });
  } else {
    candidateSession.candidateName = payload.candidate_name;
    candidateSession.lastHeartbeatAt = new Date();
    await candidateSession.save();
  }

  return candidateSession;
}

module.exports = {
  buildSkillGraph,
  countTextQuestions,
  createCodingQuestion,
  createTextQuestion,
  ensureInterviewBlueprintQuestions,
  ensureSessionActive,
  ensureSessionBootstrapQuestions,
  finalizeInterview,
  findNextInterviewQuestion,
  generateNextQuestionForSession,
  getQuestionTypeForSequence,
  getNextSequence,
  getSessionResponseCounts,
  loadInterviewByAccessToken,
  loadSessionByToken,
  mapInterviewCandidateSession,
  mapQuestionForResponse,
  mapSession,
  normalizeCodingTestCases,
  toCodingQuestion,
  toQuestion,
  upsertCandidateSession,
};
