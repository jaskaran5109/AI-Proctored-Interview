const { Ollama } = require("ollama");
const { Groq } = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROK_API_KEY,
});

const configuredBaseUrl =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const aiClient = new Ollama({
  host: configuredBaseUrl,
});

const aiModel = process.env.GROK_MODEL || "llama-3.1-8b-instant";

module.exports = { aiClient, aiModel, groq };
