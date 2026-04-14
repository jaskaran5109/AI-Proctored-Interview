const {
  AIUsageLog,
  CodeSubmission,
  CodingQuestion,
  ProctoringLog,
} = require("../models");
const aiService = require("../services/ai.service");
const {
  evaluateTestCases,
  getRuntimeAvailability,
  runCode,
} = require("../services/code-execution.service");
const {
  ensureSessionActive,
  finalizeInterview,
  generateNextQuestionForSession,
  loadSessionByToken,
  mapQuestionForResponse,
} = require("../services/interview-flow.service");
const {
  analyzeCodeSchema,
  codeAutosaveSchema,
  codeRunSchema,
  codeSubmitSchema,
  interviewCodeRunSchema,
} = require("../validators/code.validator");
const { AppError } = require("../utils/appError");

async function loadInterviewCodingQuestion(sessionToken, questionId) {
  const { interview, candidateSession } = await loadSessionByToken(sessionToken);
  ensureSessionActive(candidateSession);

  const codingQuestion = await CodingQuestion.findById(questionId);
  if (!codingQuestion) {
    throw new AppError(404, "Coding question not found");
  }

  if (
    codingQuestion.interviewId.toString() !== interview._id.toString() ||
    (codingQuestion.sessionId &&
      codingQuestion.sessionId.toString() !== candidateSession._id.toString())
  ) {
    throw new AppError(400, "Coding question does not belong to this interview session");
  }

  return { interview, codingQuestion, candidateSession };
}

function looksLikeLinkedListQuestion(codingQuestion) {
  const haystack = `${codingQuestion?.title || ""}\n${codingQuestion?.description || ""}`.toLowerCase();
  return /linked list|listnode|reverse.?list|node\*/i.test(haystack);
}

function extractPythonFunctionName(code = "") {
  return code.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)?.[1] || null;
}

function extractJavaScriptFunctionName(code = "") {
  return (
    code.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)?.[1] ||
    code.match(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(/)?.[1] ||
    code.match(/let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(/)?.[1] ||
    code.match(/var\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(/)?.[1]
  );
}

function buildLinkedListPythonRunner(code, functionName) {
  return `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

${code}

def __parse_linked_list(raw):
    raw = raw.strip()
    if not raw:
        return None
    values = [item.strip() for item in raw.split("->") if item.strip()]
    dummy = ListNode(0)
    tail = dummy
    for value in values:
        tail.next = ListNode(int(value))
        tail = tail.next
    return dummy.next

def __serialize_linked_list(head):
    values = []
    current = head
    seen = 0
    while current is not None and seen < 10000:
        values.append(str(current.val))
        current = current.next
        seen += 1
    return " -> ".join(values)

if __name__ == "__main__":
    import sys
    raw = sys.stdin.read()
    head = __parse_linked_list(raw)
    result = ${functionName}(head)
    print(__serialize_linked_list(result))
`;
}

function buildLinkedListJavaScriptRunner(code, functionName) {
  return `class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

${code}

function __parseLinkedList(raw) {
  const values = String(raw || "")
    .trim()
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number);
  const dummy = new ListNode(0);
  let tail = dummy;
  for (const value of values) {
    tail.next = new ListNode(value);
    tail = tail.next;
  }
  return dummy.next;
}

function __serializeLinkedList(head) {
  const values = [];
  let current = head;
  let seen = 0;
  while (current && seen < 10000) {
    values.push(String(current.val));
    current = current.next;
    seen += 1;
  }
  return values.join(" -> ");
}

const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const head = __parseLinkedList(raw);
const result = ${functionName}(head);
console.log(__serializeLinkedList(result));
`;
}

async function executeCustomInputWithQuestionHarness({
  codingQuestion,
  language,
  code,
  customInput,
}) {
  const directExecution = await runCode({
    language,
    code,
    input: customInput,
  });

  if (directExecution.stdout || directExecution.stderr) {
    return directExecution;
  }

  const visibleTestCases = (codingQuestion.testCases || [])
    .filter((item) => !item.hidden)
    .map((item) => ({
      input: item.input,
      expectedOutput: item.expectedOutput,
      explanation: item.explanation,
    }));

  const harness = await aiService.generateCustomInputHarness({
    language,
    title: codingQuestion.title,
    description: codingQuestion.description,
    constraints: codingQuestion.constraints || [],
    visibleTestCases,
    starterCode: codingQuestion.starterCode?.[language] || "",
    candidateCode: code,
    customInput,
  });

  if (harness.wrappedCode) {
    console.log("🔄 Retrying custom input with AI harness", {
      questionId: codingQuestion._id.toString(),
      language,
      strategy: harness.strategy,
    });
    const aiExecution = await runCode({
      language,
      code: harness.wrappedCode,
      input: customInput,
    });
    if (aiExecution.stdout || aiExecution.stderr) {
      return aiExecution;
    }
  }

  if (looksLikeLinkedListQuestion(codingQuestion) && language === "python") {
    const functionName = extractPythonFunctionName(code);
    if (!functionName) {
      return directExecution;
    }
    console.log("🔄 Retrying custom input with linked-list harness", {
      questionId: codingQuestion._id.toString(),
      language,
      functionName,
    });
    return runCode({
      language,
      code: buildLinkedListPythonRunner(code, functionName),
      input: customInput,
    });
  }

  if (looksLikeLinkedListQuestion(codingQuestion) && language === "javascript") {
    const functionName = extractJavaScriptFunctionName(code);
    if (!functionName) {
      return directExecution;
    }
    console.log("🔄 Retrying custom input with linked-list harness", {
      questionId: codingQuestion._id.toString(),
      language,
      functionName,
    });
    return runCode({
      language,
      code: buildLinkedListJavaScriptRunner(code, functionName),
      input: customInput,
    });
  }

  return {
    ...directExecution,
    stderr:
      "No output produced. This solution appears to define callable logic without printing a result for the provided custom input, and the system could not infer a safe execution wrapper.",
  };
}

function buildCodingEvaluation(codingQuestion, testEvaluation, aiAnalysis) {
  const passRate = testEvaluation.totalCount
    ? testEvaluation.passedCount / testEvaluation.totalCount
    : 0;
  const aiQuality = Math.max(
    0,
    Math.min(10, Number(aiAnalysis?.codeQualityScore || 0)),
  );
  const score = Number(
    Math.max(0, Math.min(10, passRate * 7 + aiQuality * 0.3)).toFixed(2),
  );

  return {
    score,
    strengths: [
      passRate === 1 ? "Passed all evaluated test cases" : null,
      aiQuality >= 7 ? "Code quality is solid for the chosen approach" : null,
    ].filter(Boolean),
    weaknesses:
      aiAnalysis?.mistakes?.length
        ? aiAnalysis.mistakes
        : passRate === 1
          ? []
          : ["Some test cases failed and need debugging"],
    improvements:
      aiAnalysis?.suggestions?.length
        ? aiAnalysis.suggestions
        : ["Review failing edge cases and simplify the implementation."],
    confidenceScore: Math.round(passRate * 100),
    feedback:
      passRate === 1
        ? "Solution passed all test cases and the implementation is review-ready."
        : `Solution passed ${testEvaluation.passedCount} of ${testEvaluation.totalCount} test cases.`,
    suggestedDifficulty: aiService.nextDifficultyFromAccuracy(
      codingQuestion.difficulty,
      Math.round(score * 10),
    ),
  };
}

function buildSubmissionSignals({
  testEvaluation,
  aiUsageCount,
  proctoringCount,
}) {
  const passRate = testEvaluation.totalCount
    ? testEvaluation.passedCount / testEvaluation.totalCount
    : 0;
  const authenticityScore = Math.max(
    5,
    92 - aiUsageCount * 8 - proctoringCount * 6,
  );

  return {
    authenticity: {
      authenticity_score: authenticityScore,
      rating:
        authenticityScore >= 75
          ? "high"
          : authenticityScore >= 45
            ? "medium"
            : "low",
      used_ai_help: aiUsageCount > 0,
    },
    confidence: {
      score: Math.round(passRate * 100),
      signal:
        passRate >= 0.8 ? "steady" : passRate >= 0.5 ? "hesitant" : "erratic",
    },
  };
}

async function run(req, res, next) {
  try {
    const payload = codeRunSchema.parse(req.body);
    const execution = await runCode(payload);
    res.json({
      stdout: execution.stdout,
      stderr: execution.stderr,
      executionTime: execution.executionTime,
      success: execution.success,
    });
  } catch (error) {
    next(error);
  }
}

async function runAgainstQuestion(req, res, next) {
  try {
    const payload = interviewCodeRunSchema.parse(req.body);
    const sessionToken = payload.session_token || payload.sessionToken;
    const questionId = payload.question_id || payload.questionId;
    const customInput = payload.custom_input ?? payload.customInput ?? "";
    const useCustomInput =
      payload.use_custom_input ?? payload.useCustomInput ?? Boolean(customInput);
    const { codingQuestion } = await loadInterviewCodingQuestion(
      sessionToken,
      questionId,
    );

    if (useCustomInput && customInput) {
      const execution = await executeCustomInputWithQuestionHarness({
        codingQuestion,
        language: payload.language,
        code: payload.code,
        customInput,
      });

      console.log("✅ Executed custom stdin run", {
        questionId: codingQuestion._id.toString(),
        language: payload.language,
      });

      res.json({
        output: execution.stdout,
        error: execution.stderr,
        executionTime: execution.executionTime,
        memoryUsed: null,
        testResults: [],
        customInputResult: {
          input: customInput,
          output: execution.stdout,
          error: execution.stderr,
        },
      });
      return;
    }

    const visibleTestCases = (codingQuestion.testCases || []).filter(
      (item) => !item.hidden,
    );
    const testEvaluation = await evaluateTestCases({
      language: payload.language,
      code: payload.code,
      testCases: visibleTestCases,
    });

    const latestExecutionTime = Math.max(
      0,
      ...testEvaluation.results.map((item) => item.executionTime || 0),
    );

    console.log("✅ Executed visible test cases", {
      questionId: codingQuestion._id.toString(),
      language: payload.language,
      visibleCount: visibleTestCases.length,
    });

    res.json({
      output: "",
      passed: testEvaluation.passedCount,
      failed: testEvaluation.totalCount - testEvaluation.passedCount,
      results: testEvaluation.results,
      testResults: testEvaluation.results,
      executionTime: latestExecutionTime,
      error: testEvaluation.results.find((item) => item.stderr)?.stderr || "",
      memoryUsed: null,
    });
  } catch (error) {
    console.error("❌ Code execution failed", { error: error.message });
    next(error);
  }
}

async function runtimeSupport(_req, res, next) {
  try {
    const availability = await getRuntimeAvailability();
    res.json({ runtimes: availability });
  } catch (error) {
    next(error);
  }
}

async function autosave(req, res, next) {
  try {
    const payload = codeAutosaveSchema.parse(req.body);
    const { interview, codingQuestion, candidateSession } =
      await loadInterviewCodingQuestion(payload.session_token, payload.question_id);

    const draft = await CodeSubmission.findOneAndUpdate(
      {
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
        status: "draft",
      },
      {
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
        language: payload.language,
        code: payload.code,
        status: "draft",
      },
      { new: true, upsert: true },
    );

    res.json({
      id: draft._id.toString(),
      savedAt: draft.updatedAt,
      status: "draft",
    });
  } catch (error) {
    next(error);
  }
}

async function submit(req, res, next) {
  try {
    const payload = codeSubmitSchema.parse(req.body);
    const { interview, codingQuestion, candidateSession } =
      await loadInterviewCodingQuestion(payload.session_token, payload.question_id);

    const existingSubmission = await CodeSubmission.findOne({
      interviewId: interview._id,
      sessionId: candidateSession._id,
      questionId: codingQuestion._id,
      status: "submitted",
    }).lean();
    if (existingSubmission) {
      throw new AppError(409, "Coding question has already been submitted in this session");
    }

    const [testEvaluation, aiUsageLogs, proctoringLogs] = await Promise.all([
      evaluateTestCases({
        language: payload.language,
        code: payload.code,
        testCases: codingQuestion.testCases || [],
      }),
      AIUsageLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
      }).lean(),
      ProctoringLog.find({
        interviewId: interview._id,
        sessionId: candidateSession._id,
      }).lean(),
    ]);

    const visiblePrompt = `${codingQuestion.title}\n${codingQuestion.description}\nConstraints:\n${(codingQuestion.constraints || []).join("\n")}`;
    const aiAnalysis = await aiService.analyzeCode({
      code: payload.code,
      question: visiblePrompt,
      testResults: testEvaluation,
    });
    const evaluation = buildCodingEvaluation(
      codingQuestion,
      testEvaluation,
      aiAnalysis,
    );
    const { authenticity, confidence } = buildSubmissionSignals({
      testEvaluation,
      aiUsageCount: aiUsageLogs.length,
      proctoringCount: proctoringLogs.length,
    });

    const latestExecutionTime = Math.max(
      0,
      ...testEvaluation.results.map((item) => item.executionTime || 0),
    );

    const submission = await CodeSubmission.findOneAndUpdate(
      {
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
        status: "submitted",
      },
      {
        interviewId: interview._id,
        sessionId: candidateSession._id,
        questionId: codingQuestion._id,
        language: payload.language,
        code: payload.code,
        status: "submitted",
        output: "",
        stderr: testEvaluation.results.find((item) => item.stderr)?.stderr || "",
        executionTime: latestExecutionTime,
        result: testEvaluation,
        aiAnalysis,
        evaluation,
        authenticity,
        confidence,
        timeTakenSeconds: payload.time_taken_seconds,
      },
      { new: true, upsert: true },
    );

    const nextStep = await generateNextQuestionForSession({
      interview,
      candidateSession,
      lastResponse: {
        type: "coding",
        skill: codingQuestion.topic || "coding",
        difficulty: codingQuestion.difficulty,
        evaluation,
      },
    });

    if (nextStep) {
      candidateSession.skillProgress = {
        ...(candidateSession.skillProgress || {}),
        current_skill:
          nextStep.type === "coding"
            ? nextStep.question.topic || "coding"
            : nextStep.question.skill || nextStep.question.topic,
        ordered_skills: interview.skillGraph || [],
      };
      await candidateSession.save();
    }

    const finalEvaluation = nextStep
      ? null
      : await finalizeInterview(interview, candidateSession);

    res.json({
      submission_id: submission._id.toString(),
      passedCount: testEvaluation.passedCount,
      totalCount: testEvaluation.totalCount,
      results: testEvaluation.results,
      executionTime: latestExecutionTime,
      aiAnalysis,
      evaluation,
      authenticity,
      confidence,
      skill_progress: candidateSession.skillProgress || {},
      next_question: mapQuestionForResponse(nextStep),
      final_evaluation: finalEvaluation,
      status: nextStep ? "in_progress" : "completed",
    });
  } catch (error) {
    next(error);
  }
}

async function analyzeCode(req, res, next) {
  try {
    const payload = analyzeCodeSchema.parse(req.body);
    const analysis = await aiService.analyzeCode(payload);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyzeCode,
  autosave,
  run,
  runAgainstQuestion,
  runtimeSupport,
  submit,
};
