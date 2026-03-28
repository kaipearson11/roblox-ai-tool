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

// Chat route
app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are GameDev AI, a helpful assistant for game development. Help with Lua, scripts, mechanics, ideas, UI, and systems."
      },
      ...(Array.isArray(history)
        ? history.map((msg) => ({
            role: msg.role === "ai" ? "assistant" : msg.role,
            content: msg.content
          }))
        : []),
      {
        role: "user",
        content: message
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const reply =
      completion.choices?.[0]?.message?.content || "No response.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error." });
  }
});

// ✅ FIXED ROOT ROUTE (this is the important part)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});