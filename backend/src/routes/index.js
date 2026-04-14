const express = require("express");

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { createRateLimiter } = require("../middleware/rateLimit.middleware");
const authController = require("../controllers/auth.controller");
const aiController = require("../controllers/ai.controller");
const codeController = require("../controllers/code.controller");
const sessionController = require("../controllers/session.controller");

const apiRouter = express.Router();
const aiLimiter = createRateLimiter({
  keyPrefix: "ai",
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many AI requests. Please wait a minute and try again.",
});
const interviewLimiter = createRateLimiter({
  keyPrefix: "interview",
  windowMs: 60 * 1000,
  max: 45,
  message: "Too many interview actions. Please wait a minute and try again.",
});

apiRouter.post("/auth/signup", authController.signup);
apiRouter.post("/auth/login", authController.login);
apiRouter.get("/auth/me", requireAuth, authController.me);

apiRouter.post("/sessions", requireAuth, requireRole("admin", "recruiter"), sessionController.createSession);
apiRouter.get("/sessions", requireAuth, sessionController.listSessions);
apiRouter.get("/sessions/dashboard", requireAuth, sessionController.dashboard);
apiRouter.get("/sessions/:sessionId", requireAuth, sessionController.sessionDetail);
apiRouter.delete("/sessions/:sessionId", requireAuth, sessionController.deleteSession);

apiRouter.post("/interviews/validate", sessionController.validateInterview);
apiRouter.post("/interviews/session", interviewLimiter, sessionController.createInterviewCandidateSession);
apiRouter.post("/interviews/join", interviewLimiter, sessionController.joinInterview);
apiRouter.post("/interviews/start", interviewLimiter, sessionController.startInterview);
apiRouter.post("/interviews/answer", interviewLimiter, sessionController.submitAnswer);
apiRouter.post("/interviews/end", interviewLimiter, sessionController.endInterview);
apiRouter.post("/interviews/terminate", interviewLimiter, sessionController.terminateSession);
apiRouter.post("/interviews/timeout", interviewLimiter, sessionController.handleTimeout);
apiRouter.post("/interviews/heartbeat", interviewLimiter, sessionController.heartbeat);
apiRouter.get("/interviews/result/:accessToken", sessionController.interviewResult);
apiRouter.get("/interviews/:interviewId/sessions", requireAuth, sessionController.listInterviewCandidateSessions);
apiRouter.get("/interviews/:interviewId/candidates", requireAuth, sessionController.getInterviewCandidates);
apiRouter.get("/interviews/:interviewId/candidates/:sessionId", requireAuth, sessionController.getInterviewCandidateDetail);

apiRouter.post("/assist/chat", aiLimiter, aiController.assistant);
apiRouter.post("/proctoring/events", interviewLimiter, sessionController.createProctoringEvent);
apiRouter.post("/code/run", codeController.run);
apiRouter.post("/code/run-question", interviewLimiter, codeController.runAgainstQuestion);
apiRouter.post("/code/autosave", codeController.autosave);
apiRouter.post("/code/submit", interviewLimiter, codeController.submit);
apiRouter.get("/code/runtime-support", codeController.runtimeSupport);

apiRouter.post("/interview/create", requireAuth, requireRole("admin", "recruiter"), sessionController.createSession);
apiRouter.post("/interview/join", interviewLimiter, sessionController.joinInterview);
apiRouter.post("/interview/start", interviewLimiter, sessionController.startInterview);
apiRouter.post("/interview/submit-answer", interviewLimiter, sessionController.submitAnswer);
apiRouter.post("/interview/terminate", interviewLimiter, sessionController.terminateSession);
apiRouter.post("/interview/timeout", interviewLimiter, sessionController.handleTimeout);
apiRouter.post("/interview/run-code", interviewLimiter, codeController.runAgainstQuestion);
apiRouter.post("/interview/generate-starter-code", interviewLimiter, sessionController.generateStarterCode);
apiRouter.post("/interview/submit-code", interviewLimiter, codeController.submit);
apiRouter.get("/interview/:interviewId/candidates", requireAuth, sessionController.getInterviewCandidates);
apiRouter.get("/interview/:interviewId/candidates/:sessionId", requireAuth, sessionController.getInterviewCandidateDetail);

apiRouter.post("/admin/roles", requireAuth, requireRole("admin"), sessionController.createRoleTemplate);
apiRouter.get("/admin/analytics", requireAuth, requireRole("admin"), sessionController.adminAnalytics);
apiRouter.get("/roles/templates", requireAuth, sessionController.listRoleTemplates);

apiRouter.post("/ai/generate-question", aiLimiter, aiController.generateQuestion);
apiRouter.post("/ai/analyze-answer", aiLimiter, aiController.analyzeAnswer);
apiRouter.post("/ai/analyze-code", aiLimiter, aiController.analyzeCode);
apiRouter.post("/ai/assistant", aiLimiter, aiController.assistant);
apiRouter.post("/ai/final-evaluation", aiLimiter, aiController.finalEvaluation);

module.exports = { apiRouter };
