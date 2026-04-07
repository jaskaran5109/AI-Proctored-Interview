const { AIUsageLog, Answer, ProctoringLog, Question } = require("../models");
const aiService = require("../services/ai.service");
const { assistSchema } = require("../validators/interview.validator");

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
    const question = await Question.findById(payload.question_id).lean();
    const result = await aiService.assistantHint({
      question: question?.questionText || "",
      message: payload.message,
    });

    await AIUsageLog.create({
      interviewId: question.interviewId,
      questionId: question._id,
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
    const answers = await Answer.find({ interviewId }).lean();
    const aiUsageLogs = await AIUsageLog.find({ interviewId }).lean();
    const proctoringLogs = await ProctoringLog.find({ interviewId }).lean();
    const result = await aiService.finalEvaluation({ answers, aiUsageLogs, proctoringLogs });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { analyzeAnswer, assistant, finalEvaluation, generateQuestion };
