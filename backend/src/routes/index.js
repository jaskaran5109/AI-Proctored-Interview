const express = require("express");

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const authController = require("../controllers/auth.controller");
const aiController = require("../controllers/ai.controller");
const sessionController = require("../controllers/session.controller");

const apiRouter = express.Router();

apiRouter.post("/auth/signup", authController.signup);
apiRouter.post("/auth/login", authController.login);
apiRouter.get("/auth/me", requireAuth, authController.me);

apiRouter.post("/sessions", requireAuth, requireRole("admin", "recruiter"), sessionController.createSession);
apiRouter.get("/sessions", requireAuth, sessionController.listSessions);
apiRouter.get("/sessions/dashboard", requireAuth, sessionController.dashboard);
apiRouter.get("/sessions/:sessionId", requireAuth, sessionController.sessionDetail);
apiRouter.delete("/sessions/:sessionId", requireAuth, sessionController.deleteSession);

apiRouter.post("/interviews/validate", sessionController.validateInterview);
apiRouter.post("/interviews/start", sessionController.startInterview);
apiRouter.post("/interviews/answer", sessionController.submitAnswer);
apiRouter.post("/interviews/end", sessionController.endInterview);
apiRouter.get("/interviews/result/:accessToken", sessionController.interviewResult);

apiRouter.post("/assist/chat", aiController.assistant);
apiRouter.post("/proctoring/events", sessionController.createProctoringEvent);

apiRouter.post("/admin/roles", requireAuth, requireRole("admin"), sessionController.createRoleTemplate);
apiRouter.get("/admin/analytics", requireAuth, requireRole("admin"), sessionController.adminAnalytics);

apiRouter.post("/ai/generate-question", aiController.generateQuestion);
apiRouter.post("/ai/analyze-answer", aiController.analyzeAnswer);
apiRouter.post("/ai/assistant", aiController.assistant);
apiRouter.post("/ai/final-evaluation", aiController.finalEvaluation);

module.exports = { apiRouter };
