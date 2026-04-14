const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const EXECUTION_TIMEOUT_MS = Number(process.env.CODE_RUN_TIMEOUT_MS || 5000);
const COMPILE_TIMEOUT_MS = Number(process.env.CODE_COMPILE_TIMEOUT_MS || 5000);
const MAX_OUTPUT_CHARS = 12000;
const RUNNER_MODE = process.env.CODE_RUNNER_MODE || "auto";
const DOCKER_MEMORY_LIMIT = process.env.CODE_DOCKER_MEMORY || "256m";
const DOCKER_CPU_LIMIT = process.env.CODE_DOCKER_CPUS || "0.5";

const dockerImages = {
  javascript: process.env.CODE_IMAGE_JAVASCRIPT || "node:20-alpine",
  python: process.env.CODE_IMAGE_PYTHON || "python:3.12-alpine",
  java: process.env.CODE_IMAGE_JAVA || "eclipse-temurin:21-jdk",
  cpp: process.env.CODE_IMAGE_CPP || "gcc:13",
};

const dangerousPatterns = {
  javascript: [
    /\brequire\s*\(\s*["'](?:fs|child_process|cluster|worker_threads|net|tls|http|https|dgram|vm)["']\s*\)/i,
    /\bimport\s+.*\bfrom\s+["'](?:fs|child_process|cluster|worker_threads|net|tls|http|https|dgram|vm)["']/i,
    /\bprocess\.(?:exit|kill|abort)\b/i,
  ],
  python: [
    /^\s*import\s+(?:os|subprocess|socket|pathlib|shutil|ctypes)/im,
    /^\s*from\s+(?:os|subprocess|socket|pathlib|shutil|ctypes)\s+import/im,
    /\b__import__\s*\(/i,
    /\beval\s*\(/i,
    /\bexec\s*\(/i,
  ],
  java: [/\bProcessBuilder\b/i, /\bRuntime\.getRuntime\s*\(/i, /\bjava\.io\.File\b/i],
  cpp: [/#include\s*<filesystem>/i, /system\s*\(/i, /popen\s*\(/i, /fork\s*\(/i],
};

let dockerAvailabilityPromise;

function normalizeOutput(value) {
  return String(value || "").slice(0, MAX_OUTPUT_CHARS);
}

function trimComparableOutput(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function assertSafeCode(language, code) {
  const blocked = dangerousPatterns[language]?.find((pattern) => pattern.test(code));
  if (blocked) {
    const error = new Error("Blocked unsafe code pattern");
    error.statusCode = 400;
    throw error;
  }
}

async function commandExists(command, args = ["--version"]) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function dockerAvailable() {
  if (RUNNER_MODE === "local") {
    return false;
  }
  if (RUNNER_MODE === "docker") {
    return true;
  }
  if (!dockerAvailabilityPromise) {
    dockerAvailabilityPromise = commandExists("docker", ["version", "--format", "{{.Server.Version}}"]);
  }
  return dockerAvailabilityPromise;
}

function runProcess(command, args, options = {}) {
  const { cwd, input = "", timeoutMs = EXECUTION_TIMEOUT_MS, env } = options;
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: env || {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ComSpec: process.env.ComSpec,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
      },
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const finish = (result) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      resolve({
        ...result,
        stdout: normalizeOutput(stdout),
        stderr: normalizeOutput(stderr),
        executionTime: Date.now() - startedAt,
      });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ success: false, stdout, stderr: "Execution timed out" });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finish({ success: false, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      finish({ success: code === 0, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function withTempDir(task) {
  const dir = path.join(os.tmpdir(), `ai-proctor-code-${crypto.randomBytes(8).toString("hex")}`);
  await fs.mkdir(dir, { recursive: true });
  try {
    return await task(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function toDockerVolumePath(dir) {
  const resolved = path.resolve(dir);
  if (process.platform !== "win32") {
    return resolved;
  }
  return resolved;
}

async function runDockerContainer({ language, dir, input = "" }) {
  const volumePath = toDockerVolumePath(dir);
  const config = {
    javascript: {
      image: dockerImages.javascript,
      command: ["node", "main.js"],
      timeoutMs: EXECUTION_TIMEOUT_MS,
    },
    python: {
      image: dockerImages.python,
      command: ["python", "main.py"],
      timeoutMs: EXECUTION_TIMEOUT_MS,
    },
    java: {
      image: dockerImages.java,
      command: ["sh", "-lc", "javac Main.java && java -cp /workspace Main"],
      timeoutMs: COMPILE_TIMEOUT_MS + EXECUTION_TIMEOUT_MS,
    },
    cpp: {
      image: dockerImages.cpp,
      command: ["sh", "-lc", "g++ main.cpp -std=c++17 -O2 -o main && ./main"],
      timeoutMs: COMPILE_TIMEOUT_MS + EXECUTION_TIMEOUT_MS,
    },
  }[language];

  if (!config) {
    return { success: false, stdout: "", stderr: "Unsupported language", executionTime: 0 };
  }

  const args = [
    "run",
    "--rm",
    "--interactive",
    "--network",
    "none",
    "--memory",
    DOCKER_MEMORY_LIMIT,
    "--cpus",
    DOCKER_CPU_LIMIT,
    "--pids-limit",
    "64",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "-v",
    `${volumePath}:/workspace`,
    "-w",
    "/workspace",
    config.image,
    ...config.command,
  ];

  return runProcess("docker", args, {
    input,
    timeoutMs: config.timeoutMs,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      DOCKER_CLI_HINTS: "false",
    },
  });
}

async function executeJavaScriptLocal(code, input) {
  return withTempDir(async (dir) => {
    const filePath = path.join(dir, "main.js");
    await fs.writeFile(filePath, code, "utf8");
    return runProcess("node", [filePath], { cwd: dir, input });
  });
}

async function executePythonLocal(code, input) {
  return withTempDir(async (dir) => {
    const filePath = path.join(dir, "main.py");
    await fs.writeFile(filePath, code, "utf8");
    const command = (await commandExists("python")) ? "python" : "py";
    const args = command === "py" ? ["-3", filePath] : [filePath];
    return runProcess(command, args, { cwd: dir, input });
  });
}

async function executeJavaLocal(code, input) {
  if (!(await commandExists("javac")) || !(await commandExists("java"))) {
    return { success: false, stdout: "", stderr: "Java runtime is not available on this server.", executionTime: 0 };
  }

  return withTempDir(async (dir) => {
    const className = "Main";
    const source = /\bclass\s+Main\b/.test(code) ? code : code.replace(/\bclass\s+\w+\b/, "class Main");
    const filePath = path.join(dir, `${className}.java`);
    await fs.writeFile(filePath, source, "utf8");
    const compile = await runProcess("javac", [filePath], { cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS });
    if (!compile.success) {
      return compile;
    }
    return runProcess("java", ["-cp", dir, className], { cwd: dir, input });
  });
}

async function executeCppLocal(code, input) {
  if (!(await commandExists("g++"))) {
    return { success: false, stdout: "", stderr: "C++ compiler is not available on this server.", executionTime: 0 };
  }

  return withTempDir(async (dir) => {
    const filePath = path.join(dir, "main.cpp");
    const outputPath = path.join(dir, process.platform === "win32" ? "main.exe" : "main");
    await fs.writeFile(filePath, code, "utf8");
    const compile = await runProcess("g++", [filePath, "-std=c++17", "-O2", "-o", outputPath], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (!compile.success) {
      return compile;
    }
    return runProcess(outputPath, [], { cwd: dir, input });
  });
}

async function executeWithDocker(language, code, input) {
  return withTempDir(async (dir) => {
    const sourceMap = {
      javascript: { filename: "main.js", content: code },
      python: { filename: "main.py", content: code },
      java: {
        filename: "Main.java",
        content: /\bclass\s+Main\b/.test(code) ? code : code.replace(/\bclass\s+\w+\b/, "class Main"),
      },
      cpp: { filename: "main.cpp", content: code },
    };
    const source = sourceMap[language];
    await fs.writeFile(path.join(dir, source.filename), source.content, "utf8");
    return runDockerContainer({ language, dir, input });
  });
}

async function executeLocal(language, code, input) {
  const localRunners = {
    javascript: executeJavaScriptLocal,
    python: executePythonLocal,
    java: executeJavaLocal,
    cpp: executeCppLocal,
  };
  const runner = localRunners[language];
  if (!runner) {
    return { success: false, stdout: "", stderr: "Unsupported language", executionTime: 0 };
  }
  return runner(code, input);
}

async function getRuntimeAvailability() {
  if (await dockerAvailable()) {
    return {
      javascript: true,
      python: true,
      java: true,
      cpp: true,
      runner_mode: "docker",
    };
  }

  const [nodeAvailable, pythonAvailable, javacAvailable, javaAvailable, cppAvailable] = await Promise.all([
    commandExists("node"),
    Promise.all([commandExists("python"), commandExists("py")]).then(([python, py]) => python || py),
    commandExists("javac"),
    commandExists("java"),
    commandExists("g++"),
  ]);

  return {
    javascript: nodeAvailable,
    python: pythonAvailable,
    java: javacAvailable && javaAvailable,
    cpp: cppAvailable,
    runner_mode: "local",
  };
}

async function runCode({ language, code, input = "" }) {
  assertSafeCode(language, code);

  if (await dockerAvailable()) {
    return executeWithDocker(language, code, input);
  }

  return executeLocal(language, code, input);
}

async function evaluateTestCases({ language, code, testCases = [] }) {
  const results = [];
  for (const testCase of testCases) {
    const execution = await runCode({ language, code, input: testCase.input || "" });
    const actual = trimComparableOutput(execution.stdout);
    const expected = trimComparableOutput(testCase.expectedOutput);
    const passed = execution.success && actual === expected;
    results.push({
      input: testCase.hidden ? undefined : testCase.input,
      expectedOutput: testCase.hidden ? undefined : testCase.expectedOutput,
      actualOutput: testCase.hidden ? undefined : actual,
      hidden: Boolean(testCase.hidden),
      passed,
      executionTime: execution.executionTime,
      stderr: execution.stderr,
    });
  }

  return {
    passedCount: results.filter((item) => item.passed).length,
    totalCount: results.length,
    results,
  };
}

module.exports = {
  evaluateTestCases,
  getRuntimeAvailability,
  runCode,
};
