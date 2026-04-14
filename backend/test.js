const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { app } = require("./src/app");
const aiService = require("./src/services/ai.service");
const { Interview, Question, CodingQuestion, User } = require("./src/models");
const { signAccessToken } = require("./src/utils/jwt");

let mongoServer;
let recruiterToken;
let textQuestionCounter = 0;
let codingQuestionCounter = 0;

function makeCodingQuestion(topic = "algorithms", difficulty = "medium") {
  codingQuestionCounter += 1;
  return {
    title: `Coding Question ${codingQuestionCounter}`,
    description: "Read integers from stdin and print their sum.",
    difficulty,
    constraints: ["Support whitespace-delimited integers.", "Print a single number."],
    starterCode: {
      javascript:
        "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const nums=input.trim().split(/\\s+/).filter(Boolean).map(Number);console.log(nums.reduce((a,b)=>a+b,0));});",
      python:
        "import sys\nnums=list(map(int,sys.stdin.read().strip().split()))\nprint(sum(nums))",
      java:
        "import java.util.*; class Main { public static void main(String[] args){ Scanner sc=new Scanner(System.in); long sum=0; while(sc.hasNextLong()) sum+=sc.nextLong(); System.out.print(sum); }}",
      cpp:
        "#include <bits/stdc++.h>\nusing namespace std; int main(){ long long x,sum=0; while(cin>>x) sum+=x; cout<<sum; }",
    },
    supportedLanguages: ["javascript", "python", "java", "cpp"],
    testCases: [
      {
        input: "1 2 3\n",
        expectedOutput: "6",
        hidden: false,
        explanation: "Visible sample",
      },
      {
        input: "10 20 30\n",
        expectedOutput: "60",
        hidden: true,
        explanation: "Hidden sample",
      },
    ],
    topic,
  };
}

function mockAi() {
  aiService.generateQuestions = async ({
    count = 1,
    topics = [],
    difficulty = "medium",
  }) =>
    Array.from({ length: count }, (_, index) => {
      textQuestionCounter += 1;
      const topic = topics[index % Math.max(1, topics.length)] || "fundamentals";
      return {
        sequence: index + 1,
        skill: topic,
        topic,
        difficulty,
        questionText: `Text Question ${textQuestionCounter} on ${topic}`,
        expectedTimeSeconds: 180,
        hints: ["Keep it practical."],
      };
    });

  aiService.generateAdaptiveQuestion = async ({
    skill,
    targetDifficulty = "medium",
  }) => {
    textQuestionCounter += 1;
    return {
      skill,
      topic: skill,
      difficulty: targetDifficulty,
      questionText: `Adaptive Question ${textQuestionCounter} on ${skill}`,
      expectedTimeSeconds: 180,
      hints: ["Use examples."],
    };
  };

  aiService.generateCodingQuestion = async ({
    topics = [],
    difficulty = "medium",
  }) => makeCodingQuestion(topics[0] || "algorithms", difficulty);

  aiService.analyzeAnswer = async ({ difficulty = "medium" }) => ({
    score: 7.5,
    strengths: ["Structured response"],
    weaknesses: ["Could use more detail"],
    improvements: ["Mention trade-offs"],
    confidenceScore: 82,
    feedback: "Solid answer.",
    suggestedDifficulty: difficulty === "easy" ? "medium" : difficulty,
  });

  aiService.analyzeCode = async () => ({
    codeQualityScore: 8.2,
    timeComplexityEstimate: "O(n)",
    mistakes: [],
    improvements: ["Add one more guard clause."],
    suggestions: ["Explain how input parsing works."],
  });

  aiService.generateCustomInputHarness = async ({
    language,
    candidateCode,
  }) => {
    if (language === "python") {
      const functionName =
        candidateCode.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)?.[1] ||
        "solve";
      return {
        wrappedCode: `${candidateCode}

def __parse_numbers(raw):
    return [int(item) for item in raw.strip().split() if item.strip()]

if __name__ == "__main__":
    import sys
    values = __parse_numbers(sys.stdin.read())
    result = ${functionName}(values)
    print(result)
`,
        strategy: "test_python_numbers",
      };
    }

    if (language === "javascript") {
      const functionName =
        candidateCode.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)?.[1] ||
        "solve";
      return {
        wrappedCode: `${candidateCode}
let __input = "";
process.stdin.on("data", chunk => __input += chunk);
process.stdin.on("end", () => {
  const values = __input.trim().split(/\\s+/).filter(Boolean).map(Number);
  const result = ${functionName}(values);
  console.log(result);
});
`,
        strategy: "test_javascript_numbers",
      };
    }

    return { wrappedCode: "", strategy: "unsupported" };
  };

  aiService.finalEvaluation = async ({ answers = [], codeSubmissions = [] }) => ({
    finalScore: Number(
      (
        [...answers, ...codeSubmissions].reduce(
          (sum, item) => sum + Number(item.evaluation?.score || 0),
          0,
        ) / Math.max(1, answers.length + codeSubmissions.length)
      ).toFixed(2),
    ),
    authenticityScore: 91,
    cheatingProbability: 12,
    recommendation: "Hire",
    summary: "Candidate performed well across the interview.",
    skillScores: { fundamentals: 75, algorithms: 82 },
    topicScores: { fundamentals: 75, algorithms: 82 },
    strengths: ["Good structure", "Strong implementation"],
    improvements: ["Add more edge-case discussion"],
    performanceTrend: "steady",
  });
}

test.before(async () => {
  mockAi();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const recruiter = await User.create({
    name: "Recruiter",
    email: "recruiter@example.com",
    passwordHash: "hashed",
    role: "recruiter",
  });
  recruiterToken = signAccessToken(recruiter);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  textQuestionCounter = 0;
  codingQuestionCounter = 0;
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );

  const recruiter = await User.create({
    name: "Recruiter",
    email: "recruiter@example.com",
    passwordHash: "hashed",
    role: "recruiter",
  });
  recruiterToken = signAccessToken(recruiter);
});

test("mixed interview flow creates fresh session questions and completes end-to-end", async () => {
  const createResponse = await request(app)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${recruiterToken}`)
    .send({
      title: "Full Stack Loop",
      job_role: "Full Stack Engineer",
      experience_level: "mid",
      difficulty: "medium",
      interview_format: "mixed",
      question_count: 4,
      time_limit: 30,
      topics: ["javascript", "algorithms"],
    })
    .expect(201);

  const accessToken = createResponse.body.access_token;
  assert.ok(accessToken);

  const blueprintQuestions = await Question.find({ sessionId: null }).lean();
  const blueprintCoding = await CodingQuestion.find({ sessionId: null }).lean();
  assert.equal(blueprintQuestions.length, 1);
  assert.equal(blueprintCoding.length, 1);

  const joinResponse = await request(app)
    .post("/api/interviews/join")
    .send({
      access_token: accessToken,
      candidate_name: "Candidate One",
      candidate_email: "candidate1@example.com",
    })
    .expect(200);

  assert.equal(joinResponse.body.status, "in_progress");
  assert.equal(joinResponse.body.question.question_type, "text");
  assert.equal(joinResponse.body.question.sequence, 1);

  const textQuestionId = joinResponse.body.question.id;
  const sessionToken = joinResponse.body.session_token;

  const afterJoinQuestions = await Question.find({ sessionId: { $ne: null } }).lean();
  const afterJoinCoding = await CodingQuestion.find({ sessionId: { $ne: null } }).lean();
  assert.equal(afterJoinQuestions.length, 0);
  assert.equal(afterJoinCoding.length, 0);

  const answerResponse = await request(app)
    .post("/api/interviews/answer")
    .send({
      session_token: sessionToken,
      question_id: textQuestionId,
      answer_text: "I would use clear API boundaries and monitoring.",
      time_taken_seconds: 120,
      typing_metrics: { typingSpeed: 20, pauseCount: 1, editCount: 2 },
    })
    .expect(200);

  assert.equal(answerResponse.body.status, "in_progress");
  assert.equal(answerResponse.body.next_question.question_type, "coding");
  assert.equal(answerResponse.body.next_question.sequence, 2);

  const codingQuestionId = answerResponse.body.next_question.id;
  const passingCode =
    "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const nums=input.trim().split(/\\s+/).filter(Boolean).map(Number);console.log(nums.reduce((a,b)=>a+b,0));});";

  const runResponse = await request(app)
    .post("/api/code/run-question")
    .send({
      session_token: sessionToken,
      question_id: codingQuestionId,
      language: "javascript",
      code: passingCode,
    })
    .expect(200);

  assert.equal(runResponse.body.failed, 0);
  assert.ok(runResponse.body.results.length >= 1);

  const codeSubmitResponse = await request(app)
    .post("/api/code/submit")
    .send({
      session_token: sessionToken,
      question_id: codingQuestionId,
      language: "javascript",
      code: passingCode,
      time_taken_seconds: 180,
    })
    .expect(200);

  assert.equal(codeSubmitResponse.body.status, "in_progress");
  assert.equal(codeSubmitResponse.body.next_question.question_type, "text");
  assert.equal(codeSubmitResponse.body.next_question.sequence, 3);

  const answerTwo = await request(app)
    .post("/api/interviews/answer")
    .send({
      session_token: sessionToken,
      question_id: codeSubmitResponse.body.next_question.id,
      answer_text: "I would scale reads, add metrics, and plan rollback.",
      time_taken_seconds: 95,
      typing_metrics: { typingSpeed: 18, pauseCount: 0, editCount: 1 },
    })
    .expect(200);

  assert.equal(answerTwo.body.next_question.question_type, "coding");
  assert.equal(answerTwo.body.next_question.sequence, 4);

  const finalCodeSubmit = await request(app)
    .post("/api/code/submit")
    .send({
      session_token: sessionToken,
      question_id: answerTwo.body.next_question.id,
      language: "javascript",
      code: passingCode,
      time_taken_seconds: 160,
    })
    .expect(200);

  assert.equal(finalCodeSubmit.body.status, "completed");
  assert.ok(finalCodeSubmit.body.final_evaluation);

  const resultResponse = await request(app)
    .get(`/api/interviews/result/${accessToken}`)
    .query({ session: sessionToken })
    .expect(200);

  assert.equal(resultResponse.body.status, "completed");
  assert.equal(resultResponse.body.questions.length, 4);
  assert.ok(resultResponse.body.final_evaluation);

  const secondJoin = await request(app)
    .post("/api/interviews/join")
    .send({
      access_token: accessToken,
      candidate_name: "Candidate Two",
      candidate_email: "candidate2@example.com",
    })
    .expect(200);

  assert.notEqual(secondJoin.body.session_token, sessionToken);
  assert.equal(secondJoin.body.question.id, textQuestionId);
});

test("timeout finalizes the session and preserves the current typed answer", async () => {
  const createResponse = await request(app)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${recruiterToken}`)
    .send({
      title: "Timeout Loop",
      job_role: "Backend Engineer",
      experience_level: "mid",
      difficulty: "medium",
      interview_format: "theoretical",
      question_count: 2,
      time_limit: 15,
      topics: ["nodejs"],
    })
    .expect(201);

  const joinResponse = await request(app)
    .post("/api/interviews/join")
    .send({
      access_token: createResponse.body.access_token,
      candidate_name: "Timeout Candidate",
      candidate_email: "timeout@example.com",
    })
    .expect(200);

  const timeoutResponse = await request(app)
    .post("/api/interviews/timeout")
    .send({
      session_token: joinResponse.body.session_token,
      question_id: joinResponse.body.question.id,
      current_answer: "This answer should be captured during timeout.",
      time_taken_seconds: 900,
      typing_metrics: { typingSpeed: 12, pauseCount: 2, editCount: 3 },
    })
    .expect(200);

  assert.equal(timeoutResponse.body.status, "timed_out");
  assert.ok(timeoutResponse.body.final_evaluation);

  const resultResponse = await request(app)
    .get(`/api/interviews/result/${createResponse.body.access_token}`)
    .query({ session: joinResponse.body.session_token })
    .expect(200);

  assert.equal(resultResponse.body.status, "timed_out");
  assert.equal(resultResponse.body.questions[0].answer_text, "This answer should be captured during timeout.");
});

test("custom input runner wraps function-style submissions for generic coding questions", async () => {
  const createResponse = await request(app)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${recruiterToken}`)
    .send({
      title: "Custom Runner Loop",
      job_role: "Backend Engineer",
      experience_level: "mid",
      difficulty: "medium",
      interview_format: "coding",
      question_count: 2,
      time_limit: 20,
      topics: ["python"],
    })
    .expect(201);

  const joinResponse = await request(app)
    .post("/api/interviews/join")
    .send({
      access_token: createResponse.body.access_token,
      candidate_name: "Runner Candidate",
      candidate_email: "runner@example.com",
    })
    .expect(200);

  const runResponse = await request(app)
    .post("/api/interview/run-code")
    .send({
      session_token: joinResponse.body.session_token,
      question_id: joinResponse.body.question.id,
      language: "python",
      code: "def sum_numbers(nums):\n    return sum(nums)",
      custom_input: "1 2 3 4 5",
      use_custom_input: true,
    })
    .expect(200);

  assert.equal(runResponse.body.output.trim(), "15");
  assert.equal(runResponse.body.error, "");
});
