const { OpenAI } = require("openai");

const aiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "ollama",
  baseURL: `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/v1`,
});

const aiModel = process.env.OPENAI_MODEL || "minimax-m2.7:cloud";

module.exports = { aiClient, aiModel };
