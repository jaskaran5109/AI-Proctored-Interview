const { Ollama } = require("ollama");

const configuredBaseUrl =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const aiClient = new Ollama({
  host: configuredBaseUrl,
});

const aiModel = process.env.OLLAMA_MODEL || "llama3.2:3b";

module.exports = { aiClient, aiModel };
