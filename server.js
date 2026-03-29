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
const DAILY_FREE_LIMIT = 10;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
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

function isSameDay(ts1, ts2) {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getRemainingToday(user) {
  if (!user || user.isPro) return null;

  const count = Number(user.messageCount || 0);
  const remaining = DAILY_FREE_LIMIT - count;
  return remaining < 0 ? 0 : remaining;
}

function normalizeDailyUsage(user) {
  if (!user) return;

  if (!Number.isFinite(user.messageCount)) {
    user.messageCount = 0;
  }

  if (!user.lastMessageDate) {
    user.lastMessageDate = Date.now();
  }

  if (!isSameDay(user.lastMessageDate, Date.now())) {
    user.messageCount = 0;
    user.lastMessageDate = Date.now();
  }
}

function getSafeUser(user) {
  normalizeDailyUsage(user);

  return {
    id: user.id,
    username: user.username,
    isPro: !!user.isPro,
    dailyMax: DAILY_FREE_LIMIT,
    remainingToday: user.isPro ? null : getRemainingToday(user),
  };
}

function sanitizeMessage(message) {
  if (!message || typeof message !== "object") return null;

  const role = message.role === "user" || message.role === "ai" ? message.role : null;
  const content = typeof message.content === "string" ? message.content.slice(0, 50000) : "";

  if (!role || !content.trim()) return null;

  return {
    role,
    content,
  };
}

function sanitizeProject(project) {
  if (!project || typeof project !== "object") return null;

  const messages = Array.isArray(project.messages)
    ? project.messages.map(sanitizeMessage).filter(Boolean)
    : [];

  return {
    id: typeof project.id === "string" && project.id.trim() ? project.id.trim() : makeId("p"),
    title:
      typeof project.title === "string" && project.title.trim()
        ? project.title.trim().slice(0, 80)
        : "New Project",
    messages:
      messages.length > 0
        ? messages
        : [
            {
              role: "ai",
              content:
                "Hey — I’m GameDev AI. I can help you make Roblox scripts, fix bugs, brainstorm ideas, build systems, and plan your game.",
            },
          ],
    createdAt: Number.isFinite(project.createdAt) ? project.createdAt : Date.now(),
    updatedAt: Number.isFinite(project.updatedAt) ? project.updatedAt : Date.now(),
  };
}

function getCurrentUser(req) {
  const users = readUsers();
  const user = users.find((u) => u.id === req.session.userId) || null;
  if (user) {
    normalizeDailyUsage(user);
  }
  return user;
}

async function createAiResponse({ req, userPrompt, history = [], mode = "chat", code = "" }) {
  const user = getCurrentUser(req);
  const isPro = !!user?.isPro;

  if (mode !== "chat" && !isPro) {
    const error = new Error("This is a Pro feature.");
    error.statusCode = 403;
    throw error;
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: typeof item.content === "string" ? item.content.slice(0, 12000) : "",
        }))
        .filter((item) => item.content.trim())
        .slice(-12)
    : [];

  let systemPrompt = `
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

  if (!isPro) {
    systemPrompt += `
- Keep answers shorter
- Do NOT over-explain
- Give simpler code
`;
  }

  if (mode === "fix") {
    systemPrompt = `
You are GameDev AI Pro.

Fix the user's Roblox Lua or game development code.
Rules:
- Return the corrected full code
- Briefly explain what was wrong
- Use triple backticks for code
- Be practical and specific
`;
  }

  if (mode === "explain") {
    systemPrompt = `
You are GameDev AI Pro.

Explain the user's code simply.
Rules:
- Explain it in clear beginner-friendly language
- Break down what each part does
- Keep it helpful and easy to follow
`;
  }

  if (mode === "optimize") {
    systemPrompt = `
You are GameDev AI Pro.

Optimize the user's Roblox Lua or game development code.
Rules:
- Improve structure, readability, and performance where reasonable
- Return the full improved code
- Briefly explain what you improved
- Use triple backticks for code
`;
  }

  const messages = [{ role: "system", content: systemPrompt }];

  if (mode === "chat") {
    messages.push(...safeHistory);
    messages.push({ role: "user", content: userPrompt.trim() });
  } else {
    messages.push({
      role: "user",
      content: code.trim(),
    });
  }

  const completion = await client.chat.completions.create({
    model: isPro ? "gpt-4.1" : "gpt-4.1-mini",
    messages,
    temperature: isPro ? 0.85 : 0.6,
    max_tokens: isPro ? 2200 : 500,
  });

  return completion.choices?.[0]?.message?.content || "No response.";
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* AUTH */

app.get("/api/me", (req, res) => {
  const users = readUsers();
  const userIndex = users.findIndex((u) => u.id === req.session.userId);

  if (userIndex === -1) {
    return res.json({ loggedIn: false });
  }

  normalizeDailyUsage(users[userIndex]);
  writeUsers(users);

  res.json({
    loggedIn: true,
    user: getSafeUser(users[userIndex]),
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
      isPro: false,
      messageCount: 0,
      lastMessageDate: Date.now(),
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

    const userIndex = users.findIndex((u) => u.username === cleanUsername);
    if (userIndex === -1) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    normalizeDailyUsage(users[userIndex]);
    const user = users[userIndex];

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: "Invalid username or password." });
    }

    writeUsers(users);
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

app.post("/api/upgrade", requireAuth, (req, res) => {
  try {
    const users = readUsers();
    const userIndex = users.findIndex((u) => u.id === req.session.userId);

    if (userIndex === -1) {
      return res.status(401).json({ error: "User not found." });
    }

    users[userIndex].isPro = true;
    writeUsers(users);

    res.json({ success: true, isPro: true });
  } catch (error) {
    console.error("Upgrade error:", error);
    res.status(500).json({ error: "Failed to upgrade user." });
  }
});

/* PROJECTS */

app.get("/api/projects", requireAuth, (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.session.userId);

  if (!user) {
    return res.status(401).json({ error: "User not found." });
  }

  const safeProjects = Array.isArray(user.projects)
    ? user.projects.map(sanitizeProject).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  res.json({
    projects: safeProjects,
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

  const safeProjects = projects
    .map(sanitizeProject)
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  users[userIndex].projects = safeProjects;
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

    const users = readUsers();
    const userIndex = users.findIndex((u) => u.id === req.session.userId);

    if (userIndex === -1) {
      return res.status(401).json({ error: "User not found." });
    }

    normalizeDailyUsage(users[userIndex]);
    const user = users[userIndex];

    if (!user.isPro && user.messageCount >= DAILY_FREE_LIMIT) {
      writeUsers(users);
      return res.status(403).json({
        error: "You ran out of free messages for today. Upgrade to Pro or use chat credits.",
        remainingToday: getRemainingToday(user),
        limitReached: true,
      });
    }

    if (!user.isPro) {
      user.messageCount += 1;
      user.lastMessageDate = Date.now();
      writeUsers(users);
    }

    const responseText = await createAiResponse({
      req,
      userPrompt: prompt,
      history,
      mode: "chat",
    });

    res.json({
      response: responseText,
      remainingToday: user.isPro ? null : getRemainingToday(user),
      limitReached: false,
    });
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

app.post("/fix", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Code is required." });
    }

    const responseText = await createAiResponse({
      req,
      mode: "fix",
      code,
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error("Fix route error:", error?.message || error);

    if (error.statusCode === 403) {
      return res.status(403).json({ error: "Fix is a Pro feature." });
    }

    res.status(500).json({ error: "Could not fix the code." });
  }
});

app.post("/explain", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Code is required." });
    }

    const responseText = await createAiResponse({
      req,
      mode: "explain",
      code,
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error("Explain route error:", error?.message || error);

    if (error.statusCode === 403) {
      return res.status(403).json({ error: "Explain is a Pro feature." });
    }

    res.status(500).json({ error: "Could not explain the code." });
  }
});

app.post("/optimize", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Code is required." });
    }

    const responseText = await createAiResponse({
      req,
      mode: "optimize",
      code,
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error("Optimize route error:", error?.message || error);

    if (error.statusCode === 403) {
      return res.status(403).json({ error: "Optimize is a Pro feature." });
    }

    res.status(500).json({ error: "Could not optimize the code." });
  }
});

app.listen(PORT, () => {
  ensureUsersFile();
  console.log(`Server running on http://localhost:${PORT}`);
});