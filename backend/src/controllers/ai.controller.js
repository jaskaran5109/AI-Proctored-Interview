const { AIUsageLog, Answer, CodeSubmission, CodingQuestion, InterviewSession, ProctoringLog, Question } = require("../models");
const aiService = require("../services/ai.service");
const { assistSchema } = require("../validators/interview.validator");
const { analyzeCodeSchema } = require("../validators/code.validator");
const { AppError } = require("../utils/appError");
const { logger } = require("../utils/logger");

async function generateQuestion(req, res, next) {
  try {
    const questions = await aiService.generateQuestions({
      role: req.body.role,
      difficulty: req.body.difficulty || "medium",
      previousAnswers: req.body.previousAnswers || [],
      topics: req.body.topics || ["system design"],
      count: 1,
      experienceLevel: req.body.experienceLevel || "mid",
    });
    res.json({ question: questions[0]?.questionText || questions[0]?.question_text, raw: questions[0] });
  } catch (error) {
    next(error);
  }
}

async function analyzeAnswer(req, res, next) {
  try {
    const result = await aiService.analyzeAnswer({
      question: req.body.question,
      answer: req.body.answer,
      timeTaken: req.body.timeTaken,
      aiAssisted: req.body.aiAssisted,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function assistant(req, res, next) {
  try {
    const payload = assistSchema.parse(req.body);
    const candidateSession = await InterviewSession.findOne({ sessionToken: payload.session_token });
    if (!candidateSession) throw new AppError(404, "Interview session not found");
    const question = await Question.findById(payload.question_id).lean();
    const codingQuestion = question ? null : await CodingQuestion.findById(payload.question_id).lean();
    if (!question && !codingQuestion) {
      throw new AppError(404, "Question not found");
    }

    let result;
    if (codingQuestion) {
      const latestDraft = await CodeSubmission.findOne({
        interviewId: codingQuestion.interviewId,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
      })
        .sort({ updatedAt: -1 })
        .lean();
      result = await aiService.codingAssistantHint({
        question: `${codingQuestion.title}\n${codingQuestion.description}`,
        message: payload.message,
        code: latestDraft?.code || codingQuestion.starterCode?.javascript || "",
        language: latestDraft?.language || "javascript",
      });
    } else {
      const latestAnswer = await Answer.findOne({
        interviewId: question.interviewId,
        sessionId: candidateSession._id,
        questionId: question._id,
      })
        .sort({ updatedAt: -1 })
        .lean();
      result = await aiService.assistantHint({
        question: question?.questionText || "",
        message: payload.message,
        currentAnswer: payload.current_answer || latestAnswer?.answerText || "",
      });
      if (!result || typeof result !== "object") {
        logger.warn("AI assistant returned invalid text hint payload");
        result = {
          reply:
            "Try breaking the problem into smaller steps. What would be your first approach?",
          intent: "hint_request",
        };
      }
    }

    await AIUsageLog.create({
      interviewId: question?.interviewId || codingQuestion?.interviewId,
      sessionId: candidateSession._id,
      questionId: question?._id || codingQuestion?._id,
      userMessage: payload.message,
      assistantMessage: result.reply,
      intent: result.intent,
    });

    res.json({ reply: result.reply, intent: result.intent });
  } catch (error) {
    next(error);
  }
}

async function finalEvaluation(req, res, next) {
  try {
    const interviewId = req.body.interviewId;
    const sessionId = req.body.sessionId;
    const sessionFilter = sessionId ? { sessionId } : {};
    const answers = await Answer.find({ interviewId, ...sessionFilter }).lean();
    const codeSubmissions = await CodeSubmission.find({ interviewId, ...sessionFilter, status: "submitted" }).lean();
    const aiUsageLogs = await AIUsageLog.find({ interviewId, ...sessionFilter }).lean();
    const proctoringLogs = await ProctoringLog.find({ interviewId, ...sessionFilter }).lean();
    const result = await aiService.finalEvaluation({ answers, aiUsageLogs, proctoringLogs, codeSubmissions });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function analyzeCode(req, res, next) {
  try {
    const payload = analyzeCodeSchema.parse(req.body);
    const result = await aiService.analyzeCode(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { analyzeAnswer, analyzeCode, assistant, finalEvaluation, generateQuestion };
