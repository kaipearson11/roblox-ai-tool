const express = require("express");
const path = require("path");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "No message provided." });
    }

    const safeHistory = Array.isArray(history) ? history : [];

    const messages = [
      {
        role: "system",
        content:
          "You are GameDev AI, a helpful assistant for game development. You help with Lua scripting, mechanics, balancing, UI, progression systems, monetization ideas, debugging, and creative brainstorming. Be clear, practical, and helpful."
      },
      ...safeHistory.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : msg.role === "ai" ? "assistant" : "user",
        content: String(msg.content || "")
      })),
      {
        role: "user",
        content: message
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "I couldn't generate a response.";

    res.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      reply: "There was a server error while generating a response."
    });
  }
});

app.listen(PORT, () => {
  console.log(`GameDev AI running on port ${PORT}`);
});