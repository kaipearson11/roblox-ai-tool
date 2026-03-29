const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "user.json");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "gamedevai-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (error) {
    console.error("Failed to read user.json:", error);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You must be logged in." });
  }
  next();
}

function getSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
  };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* AUTH */

app.get("/api/me", (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.session.userId);

  if (!user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: getSafeUser(user),
  });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required." });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = readUsers();

    const existing = users.find((u) => u.username === cleanUsername);
    if (existing) {
      return res.status(400).json({ error: "That username is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: makeId("user"),
      username: cleanUsername,
      passwordHash,
      projects: [],
    };

    users.push(newUser);
    writeUsers(users);

    req.session.userId = newUser.id;

    res.json({
      success: true,
      user: getSafeUser(newUser),
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to sign up." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = readUsers();

    const user = users.find((u) => u.username === cleanUsername);
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    req.session.userId = user.id;

    res.json({
      success: true,
      user: getSafeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to log in." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* PROJECTS */

app.get("/api/projects", requireAuth, (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.session.userId);

  if (!user) {
    return res.status(401).json({ error: "User not found." });
  }

  res.json({
    projects: user.projects || [],
  });
});

app.post("/api/projects", requireAuth, (req, res) => {
  const { projects } = req.body;

  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: "Projects must be an array." });
  }

  const users = readUsers();
  const userIndex = users.findIndex((u) => u.id === req.session.userId);

  if (userIndex === -1) {
    return res.status(401).json({ error: "User not found." });
  }

  users[userIndex].projects = projects;
  writeUsers(users);

  res.json({ success: true });
});

/* AI */

app.post("/generate", requireAuth, async (req, res) => {
  try {
    const { prompt, history = [] } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const systemPrompt = `
You are GameDev AI, a helpful AI for Roblox developers and game creators.

Your job:
- Help users make Roblox games
- Generate Roblox Lua scripts
- Explain code clearly
- Fix broken code
- Brainstorm ideas
- Help with UI, mechanics, progression, balancing, polish, monetization, and systems
- Also act like a normal helpful chatbot for game development

Rules:
- If the user asks for code, give complete usable code
- Prefer Roblox Lua when they ask for Roblox scripting
- Keep responses clean and easy to read
- When giving code, wrap it in triple backticks and label the language
- If they ask for fixes, explain briefly, then give the fixed version
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.8,
    });

    const responseText = completion.choices?.[0]?.message?.content || "No response.";

    res.json({ response: responseText });
  } catch (error) {
    console.error("OpenAI error:", error?.response?.data || error.message || error);

    if (error.status === 401) {
      return res.status(401).json({ error: "Invalid API key." });
    }

    res.status(500).json({
      error: "Something went wrong talking to the AI.",
    });
  }
});

app.listen(PORT, () => {
  ensureUsersFile();
  console.log(`Server running on http://localhost:${PORT}`);
});