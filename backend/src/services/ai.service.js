const { aiClient, aiModel } = require("../ai/ollama.client");

function parseJson(content) {
  if (!content) return null;
  const trimmed = content.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function jsonCompletion(prompt, fallback) {
  try {
    const response = await aiClient.chat.completions.create({
      model: aiModel,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You are a precise AI interview engine. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
    });
    return parseJson(response.choices?.[0]?.message?.content) || fallback;
  } catch {
    return fallback;
  }
}

async function generateQuestions({ role, difficulty, previousAnswers = [], topics = [], count = 1, experienceLevel = "mid" }) {
  const fallback = Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    topic: topics[index % Math.max(1, topics.length)] || "system design",
    difficulty,
    questionText: `For a ${experienceLevel} ${role}, explain how you would handle ${topics[index % Math.max(1, topics.length)] || "system design"} in production, including trade-offs and validation steps.`,
    expectedTimeSeconds: 240,
    hints: ["Cover architecture, trade-offs, and rollout.", "Keep the answer grounded in production decisions."],
  }));

  const prompt = `Generate ${count} interview questions as JSON array for role ${role}, difficulty ${difficulty}, experience level ${experienceLevel}, topics ${topics.join(", ")}. Previous answers summary: ${JSON.stringify(previousAnswers).slice(0, 600)}.
Each item needs: sequence, topic, difficulty, questionText, expectedTimeSeconds, hints.`;

  const parsed = await jsonCompletion(prompt, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

async function analyzeAnswer({ question, answer, timeTaken, aiAssisted }) {
  const fallback = {
    score: 7.1,
    strengths: ["Clear structure", "Reasonable system thinking"],
    weaknesses: ["Could go deeper on edge cases", "More metrics would help"],
    improvements: ["Add rollback strategy", "Mention monitoring and alerting"],
    confidenceScore: 73,
    feedback: "A solid answer that would benefit from sharper production depth.",
  };

  const prompt = `Analyze this interview answer and return JSON.
Question: ${question}
Answer: ${answer}
Time taken: ${timeTaken}
AI assisted: ${aiAssisted}
Return { score, strengths, weaknesses, improvements, confidenceScore, feedback }.`;

  return jsonCompletion(prompt, fallback);
}

async function assistantHint({ question, message }) {
  const fallback = {
    intent: /answer|solve|write/i.test(message) ? "full_answer_request" : "hint_request",
    reply: "I can guide your thinking, but not write the answer. Focus on requirements, architecture, trade-offs, and observability.",
  };

  const prompt = `You are an interview assistant. Give hints only, never direct answers.
Question: ${question}
Candidate message: ${message}
Return JSON { intent, reply }.`;

  const parsed = await jsonCompletion(prompt, fallback);
  return {
    intent: parsed.intent || fallback.intent,
    reply: parsed.reply || fallback.reply,
  };
}

async function finalEvaluation({ answers, aiUsageLogs, proctoringLogs }) {
  const fallback = {
    finalScore: 7.4,
    authenticityScore: "medium",
    cheatingProbability: Math.min(95, aiUsageLogs.length * 6 + proctoringLogs.length * 14),
    recommendation: "Review",
    summary: "Candidate showed solid technical fundamentals with some authenticity concerns worth review.",
  };

  const prompt = `Perform final interview evaluation and return JSON.
Answers: ${JSON.stringify(answers).slice(0, 1500)}
AI logs: ${JSON.stringify(aiUsageLogs).slice(0, 1200)}
Proctoring logs: ${JSON.stringify(proctoringLogs).slice(0, 1200)}
Return { finalScore, authenticityScore, cheatingProbability, recommendation, summary }.`;

  return jsonCompletion(prompt, fallback);
}

module.exports = {
  analyzeAnswer,
  assistantHint,
  finalEvaluation,
  generateQuestions,
};
