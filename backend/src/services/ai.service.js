const { aiClient, aiModel, groq } = require("../ai/ollama.client");
const { logger } = require("../utils/logger");

// Configurable settings for Ollama
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000); // 60 seconds for Ollama
const AI_MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 3);
const AI_RETRY_DELAY_MS = Number(process.env.AI_RETRY_DELAY_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff for Ollama
async function withRetry(operation, fallback, retries = AI_MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error("AI request timed out"));
    }, Math.max(60000, AI_TIMEOUT_MS));

    try {
      if (attempt > 0) {
        logger.warn("Retrying Ollama request", {
          attempt: attempt + 1,
          total_attempts: retries + 1,
          backoff_ms: AI_RETRY_DELAY_MS * attempt,
        });
        await sleep(AI_RETRY_DELAY_MS * attempt);
      }

      return await operation(controller.signal);
    } catch (err) {
      logger.error("Ollama attempt failed", {
        attempt: attempt + 1,
        total_attempts: retries + 1,
        error: err.message,
      });

      if (attempt >= retries) {
        logger.error("Ollama retries exhausted, using fallback");
        return fallback;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return fallback;
}

function normalizeDifficulty(value = "medium") {
  const ordered = ["easy", "medium", "hard"];
  return ordered.includes(value) ? value : "medium";
}

function extractJSON(raw) {
  if (!raw) {
    return null;
  }

  const stripped = raw.replace(/```json|```/gi, "").trim();
  let start = -1;
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < stripped.length; index++) {
    const char = stripped[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      if (start === -1) {
        start = index;
      }
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      if (!stack.length) {
        continue;
      }

      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] !== expected) {
        return null;
      }

      stack.pop();
      if (!stack.length && start !== -1) {
        return stripped.slice(start, index + 1);
      }
    }
  }

  return null;
}

function nextDifficultyFromAccuracy(currentDifficulty, accuracy) {
  const ordered = ["easy", "medium", "hard"];
  const currentIndex = ordered.indexOf(normalizeDifficulty(currentDifficulty));
  if (accuracy < 50) {
    return ordered[Math.max(0, currentIndex - 1)];
  }
  if (accuracy <= 75) {
    return ordered[
      Math.min(
        ordered.length - 1,
        currentIndex + (currentDifficulty === "easy" ? 1 : 0),
      )
    ];
  }
  return ordered[Math.min(ordered.length - 1, currentIndex + 1)];
}

function isNonCodingRole(role = "") {
  return /designer|design|product manager|pm|hr|recruit|behavioral/i.test(role);
}

function isGenericStarterCode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const genericPatterns = [
    /^class main \{ public static void main\(string\[] args\) \{\} \}$/i,
    /^int main\(\)\s*\{\s*return 0;\s*\}$/i,
    /^function solve\(input\)/i,
    /^def solve\(raw/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(normalized));
}

function scenarioFallback(role, skill, difficulty, experienceLevel) {
  if (/designer|design/i.test(role)) {
    return `You are a ${experienceLevel} ${role}. Walk through how you would improve ${skill} for a product with low engagement, including user research, design trade-offs, and success metrics.`;
  }
  if (/product manager|pm/i.test(role)) {
    return `As a ${experienceLevel} ${role}, describe how you would approach ${skill} for a new product initiative, including prioritization, stakeholder alignment, and measurement.`;
  }
  if (/hr|recruit/i.test(role)) {
    return `As a ${experienceLevel} ${role}, describe how you would handle a ${skill} scenario with empathy, fairness, and measurable follow-through.`;
  }
  return `For a ${experienceLevel} ${role}, explain how you would handle ${skill} in production, including trade-offs, validation steps, and rollout planning.`;
}

async function jsonCompletion(prompt, fallback, temperature = 0.3) {
  try {
    const response = await withRetry(
      async (signal) =>
        await groq.chat.completions.create({
          model: aiModel,
          messages: [
            {
              role: "system",
              content: `You are a senior technical interviewer. Always respond in valid JSON only. No explanation, no markdown.`,
            },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: 1,
          response_format: { type: "json_object" },
        }),
      fallback,
    );  
    
    if (!response || typeof response !== "object") {
      logger.warn("AI returned invalid response, using fallback");
      return fallback;
    }
    const raw = response.choices[0]?.message?.content;

    const jsonString = extractJSON(raw); // ✅ extract first

    if (!jsonString) {
      logger.warn("No JSON found in AI response, using fallback", {
        preview: raw?.substring?.(0, 200),
      });
      return fallback;
    }

    try {
      const parsed = JSON.parse(jsonString); // ✅ parse jsonString, not raw
      return parsed;
    } catch (err) {
      logger.warn("JSON parse failed for AI response", {
        error: err.message,
        preview: jsonString?.substring?.(0, 200),
      });
      return fallback;
    }
  } catch (err) {
    logger.error("AI completion failed", { error: err.message });
    return fallback;
  }
}

async function generateQuestions({
  role,
  difficulty,
  previousAnswers = [],
  topics = [],
  count = 1,
  experienceLevel = "mid",
  interviewType = "non_coding",
}) {
  const fallback = Array.from({ length: count }, (_, index) => {
    const skill = topics[index % Math.max(1, topics.length)] || "system design";
    return {
      sequence: index + 1,
      skill,
      topic: skill,
      difficulty,
      questionText: scenarioFallback(role, skill, difficulty, experienceLevel),
      expectedTimeSeconds: interviewType === "non_coding" ? 300 : 240,
      hints: [
        "Start with goals and constraints.",
        "Explain trade-offs and how you would validate the outcome.",
      ],
    };
  });

  const prompt = `Generate ${count} interview questions as a JSON array.
Role: ${role}
Interview type: ${interviewType}
Difficulty: ${difficulty}
Experience level: ${experienceLevel}
Skills/topics: ${topics.join(", ")}
Previous answers summary: ${JSON.stringify(previousAnswers).slice(0, 1200)}

Rules:
- For non-coding roles, prefer scenario-based, behavioral, product, or design questions.
- For technical roles, prefer architecture, debugging, delivery, and trade-off questions.
- Each item must include: sequence, skill, topic, difficulty, questionText, expectedTimeSeconds, hints.
- Keep hints short and non-revealing.`;

  const parsed = await jsonCompletion(prompt, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

async function generateAdaptiveQuestion({
  role,
  interviewType = "non_coding",
  experienceLevel = "mid",
  skill,
  targetDifficulty = "medium",
  previousAnswers = [],
  currentPerformance = {},
}) {
  const fallback = {
    skill,
    topic: skill,
    difficulty: targetDifficulty,
    questionText: scenarioFallback(
      role,
      skill,
      targetDifficulty,
      experienceLevel,
    ),
    expectedTimeSeconds: interviewType === "non_coding" ? 300 : 240,
    hints: [
      "Anchor the answer in practical decision-making.",
      "Show trade-offs, risks, and how you would validate success.",
    ],
  };

  const prompt = `Generate one adaptive interview question as JSON.
Role: ${role}
Interview type: ${interviewType}
Experience level: ${experienceLevel}
Skill to test now: ${skill}
Target difficulty: ${targetDifficulty}
Candidate performance snapshot: ${JSON.stringify(currentPerformance)}
Recent answers: ${JSON.stringify(previousAnswers).slice(0, 1400)}

Return JSON with:
skill, topic, difficulty, questionText, expectedTimeSeconds, hints

Rules:
- Keep it on the requested skill.
- Make the question easier if accuracy is low, slightly deeper if medium, and more advanced if high.
- For Product Designer/Product Manager/HR roles, use non-coding scenario, case-study, or behavioral prompts.
- Do not include answers.`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    ...fallback,
    ...(parsed || {}),
    skill: parsed?.skill || fallback.skill,
    topic: parsed?.topic || fallback.topic,
    difficulty: normalizeDifficulty(parsed?.difficulty || fallback.difficulty),
    hints:
      Array.isArray(parsed?.hints) && parsed.hints.length
        ? parsed.hints
        : fallback.hints,
  };
}

async function generateCodingQuestion({
  role,
  difficulty,
  topics = [],
  experienceLevel = "mid",
}) {
  const topic = topics[0] || "arrays";

  const fallback = {
    title: `${role} live coding challenge`,
    description:
      "Build a function that reads a list of integers and returns the maximum sum of any contiguous subarray.",
    difficulty,
    constraints: [
      "Handle negative values correctly.",
      "Optimize for O(n) time complexity.",
      "Read from standard input and print the answer.",
    ],
    starterCode: {
      javascript: `function maxSubarraySum(nums) {\n  // TODO: implement\n  return 0;\n}`,
      python: `def max_subarray_sum(nums: list[int]) -> int:\n    # TODO: implement\n    pass`,
      java: `public int maxSubarraySum(int[] nums) {\n    // TODO: implement\n    return 0;\n}`,
      cpp: `int maxSubarraySum(vector<int>& nums) {\n    // TODO: implement\n    return 0;\n}`,
    },
    supportedLanguages: ["javascript", "python", "java", "cpp"],
    testCases: [
      {
        input: "8\n-2 1 -3 4 -1 2 1 -5 4\n",
        expectedOutput: "6",
        hidden: false,
        explanation: "Classic Kadane example",
      },
    ],
    topic,
  };

  // 🔥 MUCH STRONGER PROMPT
  const prompt = `
You are a senior technical interviewer.

Generate EXACTLY ONE high-quality coding interview problem.

STRICT RULES:
- Return ONLY valid JSON (no explanation, no markdown, no text outside JSON)
- Follow schema EXACTLY
- Problem must be solvable in 30–40 minutes
- Avoid vague descriptions
- Ensure test cases are correct

SCHEMA:
{
  "title": string,
  "description": string,
  "difficulty": "${difficulty}",
  "constraints": string[],
  "starterCode": {
    "javascript": string,
    "python": string,
    "java": string,
    "cpp": string
  },
  "supportedLanguages": ["javascript","python","java","cpp"],
  "testCases": [
    {
      "input": string,
      "expectedOutput": string,
      "hidden": boolean,
      "explanation": string
    }
  ],
  "topic": "${topic}"
}

CONTEXT:
- Role: ${role}
- Experience: ${experienceLevel}
- Topic: ${topic}

QUALITY REQUIREMENTS:
- Problem must be realistic (like LeetCode / interviews)
- Include edge cases
- No trivial problems
- Ensure expectedOutput is correct
- For each language, generate a relevant starter code that includes:
  - Correct function/method signature matching the problem
  - Input parameter names that match the problem description
  - Return type hint where applicable (Python, Java, C++)
  - A TODO comment inside the function body
  - Do NOT include any solution logic
- Example for "Reverse a Linked List":
  - javascript: "function reverseList(head) {\\n  // TODO: implement\\n  return null;\\n}"
  - python: "def reverse_list(head):\\n    # TODO: implement\\n    pass"
  - java: "public ListNode reverseList(ListNode head) {\\n    // TODO: implement\\n    return null;\\n}"
  - cpp: "ListNode* reverseList(ListNode* head) {\\n    // TODO: implement\\n    return nullptr;\\n}"
- Return starterCode as:
  {
    "starterCode": {
      "javascript": "...",
      "python": "...",
      "java": "...",
      "cpp": "..."
    }
  }

RETURN JSON ONLY.
`;

  const parsed = await jsonCompletion(prompt, fallback, 0.2);

  // ✅ VALIDATION LAYER (VERY IMPORTANT)
  const isValid = (data) => {
    return (
      data &&
      typeof data.title === "string" &&
      typeof data.description === "string" &&
      Array.isArray(data.constraints) &&
      typeof data.starterCode === "object" &&
      Array.isArray(data.testCases) &&
      data.testCases.length > 0
    );
  };

  if (!isValid(parsed)) {
    logger.warn("Invalid coding question response, using fallback");
    return fallback;
  }

  // ✅ SAFE MERGE (deep merge critical fields)
  const merged = {
    title: parsed.title || fallback.title,
    description: parsed.description || fallback.description,
    difficulty,
    constraints:
      parsed.constraints?.length > 0
        ? parsed.constraints
        : fallback.constraints,
    starterCode: {
      javascript:
        parsed.starterCode?.javascript || fallback.starterCode.javascript,
      python: parsed.starterCode?.python || fallback.starterCode.python,
      java: parsed.starterCode?.java || fallback.starterCode.java,
      cpp: parsed.starterCode?.cpp || fallback.starterCode.cpp,
    },
    supportedLanguages:
      parsed.supportedLanguages?.length === 4
        ? parsed.supportedLanguages
        : fallback.supportedLanguages,
    testCases:
      parsed.testCases?.length > 0 ? parsed.testCases : fallback.testCases,
    topic: parsed.topic || topic,
  };

  const missingLanguages = merged.supportedLanguages.filter(
    (language) => isGenericStarterCode(merged.starterCode?.[language]),
  );

  if (missingLanguages.length) {
    const repairedStarterCode = await generateStarterCodeSet({
      title: merged.title,
      description: merged.description,
      languages: missingLanguages,
      fallbackStarterCode: merged.starterCode,
    });
    merged.starterCode = {
      ...merged.starterCode,
      ...repairedStarterCode,
    };
  }

  return merged;
}

async function generateStarterCodeSet({
  title,
  description,
  languages = ["javascript", "python", "java", "cpp"],
  fallbackStarterCode = {},
}) {
  const requestedLanguages = Array.from(
    new Set((languages || []).filter(Boolean)),
  );

  const fallback = requestedLanguages.reduce((acc, language) => {
    acc[language] =
      fallbackStarterCode[language] ||
      {
        javascript: `function solve(input) {\n  // TODO: implement\n  return \"\";\n}`,
        python: `def solve(input_data: str) -> str:\n    # TODO: implement\n    pass`,
        java: `public String solve(String input) {\n    // TODO: implement\n    return \"\";\n}`,
        cpp: `std::string solve(const std::string& input) {\n    // TODO: implement\n    return \"\";\n}`,
      }[language] ||
      "";
    return acc;
  }, {});

  const prompt = `Generate starter code only as valid JSON.
Problem title: ${title}
Problem description: ${description}
Languages: ${requestedLanguages.join(", ")}

For each language, generate a relevant starter code that includes:
- Correct function/method signature matching the problem
- Input parameter names that match the problem description
- Return type hint where applicable (Python, Java, C++)
- A TODO comment inside the function body
- Do NOT include any solution logic

Example for "Reverse a Linked List":
javascript: "function reverseList(head) {\\n  // TODO: implement\\n  return null;\\n}"
python: "def reverse_list(head):\\n    # TODO: implement\\n    pass"
java: "public ListNode reverseList(ListNode head) {\\n    // TODO: implement\\n    return null;\\n}"
cpp: "ListNode* reverseList(ListNode* head) {\\n    // TODO: implement\\n    return nullptr;\\n}"

Return exactly:
{
  "starterCode": {
    ${requestedLanguages.map((language) => `"${language}": "..."`).join(",\n    ")}
  }
}`;

  const parsed = await jsonCompletion(
    prompt,
    { starterCode: fallback },
    0.2,
  );

  return requestedLanguages.reduce((acc, language) => {
    acc[language] =
      parsed?.starterCode?.[language] &&
      !isGenericStarterCode(parsed.starterCode[language])
        ? parsed.starterCode[language]
        : fallback[language];
    return acc;
  }, {});
}

async function generateStarterCodeForLanguage({
  language,
  title,
  description,
  fallbackStarterCode = "",
}) {
  const generated = await generateStarterCodeSet({
    title,
    description,
    languages: [language],
    fallbackStarterCode: { [language]: fallbackStarterCode },
  });

  return (
    generated[language] ||
    fallbackStarterCode ||
    ""
  );
}

async function generateCustomInputHarness({
  language,
  title,
  description,
  constraints = [],
  visibleTestCases = [],
  starterCode = "",
  candidateCode = "",
  customInput = "",
}) {
  const fallback = {
    wrappedCode: "",
    strategy: "unavailable",
  };

  function parseLooseHarnessResponse(raw = "") {
    const text = String(raw || "").trim();
    if (!text) {
      return fallback;
    }

    const strategyMatch =
      text.match(/"strategy"\s*:\s*"([^"]+)"/) ||
      text.match(/strategy\s*[:=]\s*([^\n]+)/i);
    const wrappedCodeMatch = text.match(
      /"wrappedCode"\s*:\s*"([\s\S]*?)"\s*,\s*"strategy"/,
    );

    if (wrappedCodeMatch) {
      const unescaped = wrappedCodeMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\r/g, "\r");
      return {
        wrappedCode: unescaped,
        strategy: strategyMatch?.[1]?.trim() || "loose_json",
      };
    }

    const fencedCodeMatch = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    if (fencedCodeMatch) {
      return {
        wrappedCode: fencedCodeMatch[1].trim(),
        strategy: strategyMatch?.[1]?.trim() || "fenced_code",
      };
    }

    return fallback;
  }

  const prompt = `You are generating a custom-input execution harness for a live coding interview.

Return valid JSON only:
{
  "wrappedCode": string,
  "strategy": string
}

Goal:
- The candidate submitted function-style code that produced no stdout when executed directly.
- Generate COMPLETE runnable ${language} code that embeds the candidate code unchanged and adds only the minimum wrapper needed to:
  1. parse stdin for this specific problem
  2. call the candidate's function or method
  3. print the final output exactly once

Hard rules:
- Preserve the candidate's original algorithm logic unchanged
- Do not solve the problem yourself beyond input parsing / output serialization / object construction
- Do not use markdown
- wrappedCode must be directly executable in ${language}
- If helper structures are needed, define them
- Prefer using the function/class names already present in the candidate code
- Output format must match the problem's expected style

Problem title: ${title}
Problem description: ${description}
Constraints: ${JSON.stringify(constraints)}
Visible test cases: ${JSON.stringify(visibleTestCases)}
Starter code for ${language}: ${starterCode}
Candidate code:
${candidateCode}

Custom stdin to support:
${customInput}`;

  let parsed = await jsonCompletion(prompt, fallback, 0.2);
  if (parsed?.wrappedCode) {
    return {
      wrappedCode:
        typeof parsed?.wrappedCode === "string" ? parsed.wrappedCode : "",
      strategy:
        typeof parsed?.strategy === "string" ? parsed.strategy : "unavailable",
    };
  }

  const rawResponse = await withRetry(
    async (signal) =>
      await aiClient.chat({
        model: aiModel,
        messages: [
          {
            role: "system",
            content:
              "Return only wrappedCode and strategy. Prefer valid JSON, but if that fails, include the full code in one fenced block.",
          },
          { role: "user", content: prompt },
        ],
        options: { temperature: 0.2 },
        signal,
        stream: false,
      }),
    null,
  );
  parsed = parseLooseHarnessResponse(rawResponse?.message?.content || "");

  return {
    wrappedCode:
      typeof parsed?.wrappedCode === "string" ? parsed.wrappedCode : "",
    strategy:
      typeof parsed?.strategy === "string" ? parsed.strategy : "unavailable",
  };
}

async function analyzeAnswer({
  question,
  answer,
  timeTaken,
  aiAssisted,
  skill = "",
  difficulty = "medium",
}) {
  const fallback = {
    score: 7.1,
    strengths: ["Clear structure", "Reasonable system thinking"],
    weaknesses: ["Could go deeper on edge cases", "More metrics would help"],
    improvements: ["Add rollback strategy", "Mention monitoring and alerting"],
    confidenceScore: 73,
    suggestedDifficulty: normalizeDifficulty(difficulty),
    feedback:
      "A solid answer that would benefit from sharper production depth.",
  };

  const prompt = `Analyze this interview answer and return JSON.
Question: ${question}
Skill tested: ${skill}
Difficulty: ${difficulty}
Answer: ${answer}
Time taken: ${timeTaken}
AI assisted: ${aiAssisted}

Return:
{ score, strengths, weaknesses, improvements, confidenceScore, feedback, suggestedDifficulty }

Rules:
- score must be 0 to 10
- confidenceScore must be 0 to 100
- strengths/weaknesses/improvements must be short arrays
- suggestedDifficulty must be easy, medium, or hard`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    ...fallback,
    ...(parsed || {}),
    score: Math.max(0, Math.min(10, Number(parsed?.score ?? fallback.score))),
    confidenceScore: Math.max(
      0,
      Math.min(
        100,
        Number(parsed?.confidenceScore ?? fallback.confidenceScore),
      ),
    ),
    suggestedDifficulty: normalizeDifficulty(
      parsed?.suggestedDifficulty || fallback.suggestedDifficulty,
    ),
  };
}

async function assistantHint({ question, message, currentAnswer = "" }) {
  const fallback = {
    intent: /answer|solve|write/i.test(message)
      ? "full_answer_request"
      : "hint_request",
    reply:
      "Try again by breaking the problem into requirements, trade-offs, and a clear first step. I can give hints, but not the direct answer.",
  };

  const prompt = `You are an interview assistant.

STRICT RULES:
- You MUST NOT provide the final answer, full solution, or full code.
- Only provide hints, guidance, or questions to guide thinking.
- If user asks for full answer → politely refuse and give hint instead.

Current question:
${question}

Candidate draft answer:
${String(currentAnswer || "").slice(0, 2000)}

Candidate message:
${message}

Return ONLY valid JSON in this exact format:
{
  "intent": "hint_request" OR "full_answer_request",
  "reply": "your hint here"
}

Rules:
- reply must be concise (2–4 lines max)
- reply must guide thinking, not solve
- NEVER include markdown or extra text
`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    intent: parsed?.intent || fallback.intent,
    reply: parsed?.reply || fallback.reply,
  };
}

async function analyzeCode({ code, question, testResults }) {
  const fallback = {
    codeQualityScore: 7.2,
    timeComplexityEstimate: "O(n)",
    mistakes: ["Edge cases could be made more explicit."],
    improvements: [
      "Add clearer variable names.",
      "Document the chosen approach briefly.",
    ],
    suggestions: [
      "Validate empty input early.",
      "Consider how the implementation handles all-negative arrays.",
    ],
  };

  const prompt = `Act as a senior engineer reviewing a live coding interview. Return JSON only.
Question: ${question}
Code: ${code}
Test results: ${JSON.stringify(testResults).slice(0, 2000)}
Return { codeQualityScore, timeComplexityEstimate, mistakes, improvements, suggestions }.`;

  return jsonCompletion(prompt, fallback);
}

async function codingAssistantHint({ question, message, code, language }) {
  const fallback = {
    intent: /solve|full solution|complete code/i.test(message)
      ? "full_solution_request"
      : "coding_hint_request",
    reply:
      "Try again by focusing on the algorithm, key edge cases, and input parsing. I can guide with hints, but I won't provide the full solution.",
  };

  const prompt = `You are a live coding interview assistant.
Give hints only. Never provide the full solution.

Problem:
${question}

Language: ${language}
Current code:
${String(code || "").slice(0, 3000)}

Candidate request:
${message}

Return JSON { intent, reply }.`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    intent: parsed?.intent || fallback.intent,
    reply: parsed?.reply || fallback.reply,
  };
}

function computeSkillScores(answers = []) {
  const bucket = {};
  answers.forEach((item) => {
    const skill = item.skill || item.topic || item.questionSkill || "general";
    const score = Number(item.evaluation?.score || 0) * 10;
    if (!bucket[skill]) {
      bucket[skill] = { total: 0, count: 0 };
    }
    bucket[skill].total += score;
    bucket[skill].count += 1;
  });
  return Object.entries(bucket).reduce((acc, [skill, value]) => {
    acc[skill] = Math.round(value.total / Math.max(1, value.count));
    return acc;
  }, {});
}

function averageNumeric(values = []) {
  if (!values.length) {
    return 0;
  }

  return Number(
    (
      values.reduce((sum, current) => sum + Number(current || 0), 0) /
      values.length
    ).toFixed(2),
  );
}

async function finalEvaluation({
  answers,
  aiUsageLogs,
  proctoringLogs,
  codeSubmissions = [],
}) {
  const scoredAnswers = answers.map((item) => Number(item.evaluation?.score || 0));
  const scoredCoding = codeSubmissions.map((item) => Number(item.evaluation?.score || 0));
  const combinedScores = [...scoredAnswers, ...scoredCoding];
  const skillScores = computeSkillScores([
    ...answers,
    ...codeSubmissions.map((item) => ({
      skill: item.topic || item.questionTopic || "coding",
      evaluation: item.evaluation || {},
    })),
  ]);
  const fallbackAuthenticity = Math.max(
    5,
    100 - aiUsageLogs.length * 7 - proctoringLogs.length * 10,
  );
  const fallback = {
    finalScore: averageNumeric(combinedScores) || 7.4,
    authenticityScore: fallbackAuthenticity,
    cheatingProbability: Math.min(
      95,
      aiUsageLogs.length * 6 + proctoringLogs.length * 14,
    ),
    recommendation:
      averageNumeric(combinedScores) >= 8
        ? "Hire"
        : averageNumeric(combinedScores) >= 6
          ? "Consider"
          : "Reject",
    summary:
      "Candidate showed solid technical fundamentals with some authenticity concerns worth review.",
    skillScores,
    strengths: [],
    improvements: [],
    topicScores: skillScores,
    performanceTrend:
      combinedScores.length >= 2 &&
      combinedScores[combinedScores.length - 1] > combinedScores[0]
        ? "improving"
        : combinedScores.length >= 2 &&
            combinedScores[combinedScores.length - 1] < combinedScores[0]
          ? "declining"
          : "steady",
  };

  const prompt = `Perform final interview evaluation and return JSON.
Answers: ${JSON.stringify(answers).slice(0, 1800)}
Code submissions: ${JSON.stringify(codeSubmissions).slice(0, 1500)}
AI logs: ${JSON.stringify(aiUsageLogs).slice(0, 1200)}
Proctoring logs: ${JSON.stringify(proctoringLogs).slice(0, 1200)}
Skill scores so far: ${JSON.stringify(skillScores)}

Return:
{ finalScore, authenticityScore, cheatingProbability, recommendation, summary, skillScores, strengths, improvements, topicScores, performanceTrend }`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    ...fallback,
    ...(parsed || {}),
    finalScore: Math.max(
      0,
      Math.min(10, Number(parsed?.finalScore ?? fallback.finalScore)),
    ),
    authenticityScore: Math.max(
      0,
      Math.min(
        100,
        Number(parsed?.authenticityScore ?? fallback.authenticityScore),
      ),
    ),
    cheatingProbability: Math.max(
      0,
      Math.min(
        100,
        Number(parsed?.cheatingProbability ?? fallback.cheatingProbability),
      ),
    ),
    skillScores:
      parsed?.skillScores && typeof parsed.skillScores === "object"
        ? parsed.skillScores
        : skillScores,
    topicScores:
      parsed?.topicScores && typeof parsed.topicScores === "object"
        ? parsed.topicScores
        : skillScores,
  };
}

module.exports = {
  analyzeAnswer,
  analyzeCode,
  assistantHint,
  codingAssistantHint,
  finalEvaluation,
  generateAdaptiveQuestion,
  generateCodingQuestion,
  generateStarterCodeForLanguage,
  generateCustomInputHarness,
  generateQuestions,
  generateStarterCodeSet,
  isNonCodingRole,
  isGenericStarterCode,
  nextDifficultyFromAccuracy,
  normalizeDifficulty,
};
