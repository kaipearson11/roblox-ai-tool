const authOverlay = document.getElementById("authOverlay");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authError = document.getElementById("authError");
const loginTabBtn = document.getElementById("loginTabBtn");
const signupTabBtn = document.getElementById("signupTabBtn");

const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const projectList = document.getElementById("projectList");
const newProjectBtn = document.getElementById("newProjectBtn");
const projectTitle = document.getElementById("projectTitle");
const clearChatBtn = document.getElementById("clearChatBtn");
const renameProjectBtn = document.getElementById("renameProjectBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");
const userBadge = document.getElementById("userBadge");
const planBadge = document.getElementById("planBadge");
const dailyLimitWrap = document.getElementById("dailyLimitWrap");
const dailyLimitCount = document.getElementById("dailyLimitCount");
const pricingBtn = document.getElementById("pricingBtn");

const deleteModal = document.getElementById("deleteModal");
const deleteModalText = document.getElementById("deleteModalText");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const renameModal = document.getElementById("renameModal");
const renameProjectInput = document.getElementById("renameProjectInput");
const confirmRenameBtn = document.getElementById("confirmRenameBtn");
const cancelRenameBtn = document.getElementById("cancelRenameBtn");

const upgradeModal = document.getElementById("upgradeModal");
const upgradeModalText = document.getElementById("upgradeModalText");
const closeUpgradeBtn = document.getElementById("closeUpgradeBtn");
const upgradeSoonBtn = document.getElementById("upgradeSoonBtn");
const proFeatureButtons = document.querySelectorAll(".pro-feature-btn");

const limitModal = document.getElementById("limitModal");
const limitStatValue = document.getElementById("limitStatValue");
const limitGoPricingBtn = document.getElementById("limitGoPricingBtn");
const limitCloseBtn = document.getElementById("limitCloseBtn");

const fixBtn = document.getElementById("fixBtn");
const explainBtn = document.getElementById("explainBtn");
const optimizeBtn = document.getElementById("optimizeBtn");

let authMode = "login";
let currentUser = null;
let isProUser = false;
let dailyRemaining = 10;
let dailyMax = 10;
let projects = [];
let activeProjectId = null;
let isThinking = false;
let openMenuProjectId = null;
let projectToDeleteId = null;
let projectToRenameId = null;

function makeId() {
  return "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripCodeBlocks(text) {
  return String(text).replace(/```[\s\S]*?```/g, "[code]");
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + "px";
}

function scrollChatToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function getActiveProject() {
  return projects.find((p) => p.id === activeProjectId) || null;
}

function nowTs() {
  return Date.now();
}

function touchProject(project) {
  project.updatedAt = nowTs();
  if (!project.createdAt) project.createdAt = project.updatedAt;
}

function getProjectTitleFromMessage(message) {
  const clean = String(message).replace(/\s+/g, " ").trim();
  if (!clean) return "New Project";
  return clean.length > 32 ? clean.slice(0, 32).trim() + "..." : clean;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";

  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return diffSec + "s ago";
  if (diffMin < 60) return diffMin + "m ago";
  if (diffHr < 24) return diffHr + "h ago";
  if (diffDay < 7) return diffDay + "d ago";

  return new Date(timestamp).toLocaleDateString();
}

function sortProjects() {
  projects.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

async function saveProjectsToServer() {
  if (!currentUser) return;

  sortProjects();

  await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ projects })
  });
}

function setAuthMode(mode) {
  authMode = mode;
  authError.textContent = "";

  if (mode === "login") {
    loginTabBtn.classList.add("active");
    signupTabBtn.classList.remove("active");
    authSubmitBtn.textContent = "Log In";
    authPassword.autocomplete = "current-password";
  } else {
    signupTabBtn.classList.add("active");
    loginTabBtn.classList.remove("active");
    authSubmitBtn.textContent = "Sign Up";
    authPassword.autocomplete = "new-password";
  }
}

function updateDailyLimitUI() {
  if (isProUser) {
    dailyLimitCount.textContent = "Unlimited";
    dailyLimitWrap.classList.add("pro");
    limitStatValue.textContent = "Unlimited";
  } else {
    dailyLimitCount.textContent = `${dailyRemaining}/${dailyMax}`;
    dailyLimitWrap.classList.remove("pro");
    limitStatValue.textContent = `${dailyRemaining}/${dailyMax} left`;
  }
}

function updateProUI() {
  if (isProUser) {
    planBadge.textContent = "PRO";
    planBadge.classList.remove("free");
    planBadge.classList.add("pro");
    upgradeSoonBtn.textContent = "See Plans";
    upgradeSoonBtn.disabled = false;
    document.body.classList.add("pro-enabled");
  } else {
    planBadge.textContent = "FREE";
    planBadge.classList.remove("pro");
    planBadge.classList.add("free");
    upgradeSoonBtn.textContent = "See Plans";
    upgradeSoonBtn.disabled = false;
    document.body.classList.remove("pro-enabled");
  }

  proFeatureButtons.forEach((btn) => {
    const pill = btn.querySelector(".locked-pill");

    if (isProUser) {
      btn.classList.remove("locked");
      btn.classList.add("unlocked");
      if (pill) pill.textContent = "Unlocked";
    } else {
      btn.classList.remove("unlocked");
      btn.classList.add("locked");
      if (pill) pill.textContent = "Locked";
    }
  });

  updateDailyLimitUI();
}

function showAuth() {
  authOverlay.classList.remove("hidden");
}

function hideAuth() {
  authOverlay.classList.add("hidden");
}

function openDeleteModal(projectId, title) {
  projectToDeleteId = projectId;
  deleteModalText.textContent = `Delete "${title}"?`;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  deleteModal.classList.add("hidden");
  projectToDeleteId = null;
}

function openRenameModal(projectId, currentTitle) {
  projectToRenameId = projectId;
  renameProjectInput.value = currentTitle || "";
  renameModal.classList.remove("hidden");
  setTimeout(() => {
    renameProjectInput.focus();
    renameProjectInput.select();
  }, 0);
}

function closeRenameModal() {
  renameModal.classList.add("hidden");
  projectToRenameId = null;
  renameProjectInput.value = "";
}

function openPricingModal(message = "Unlock more power with Pro or buy message credits.") {
  upgradeModalText.textContent = message;
  upgradeModal.classList.remove("hidden");
}

function closePricingModal() {
  upgradeModal.classList.add("hidden");
}

function openLimitModal() {
  updateDailyLimitUI();
  limitModal.classList.remove("hidden");
}

function closeLimitModal() {
  limitModal.classList.add("hidden");
}

function createWelcomeMessage(text) {
  return {
    role: "ai",
    content:
      text ||
      "Hey — I’m GameDev AI. I can help you make Roblox scripts, fix bugs, brainstorm ideas, build systems, and plan your game."
  };
}

function createProject(title = "New Project") {
  const project = {
    id: makeId(),
    title,
    messages: [createWelcomeMessage()],
    createdAt: nowTs(),
    updatedAt: nowTs()
  };

  projects.unshift(project);
  activeProjectId = project.id;
  openMenuProjectId = null;
  sortProjects();
  renderProjects();
  renderActiveProject();
  saveProjectsToServer();
}

async function deleteProject(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  projects = projects.filter((p) => p.id !== projectId);
  openMenuProjectId = null;

  if (!projects.length) {
    const newProject = {
      id: makeId(),
      title: "New Project",
      messages: [createWelcomeMessage()],
      createdAt: nowTs(),
      updatedAt: nowTs()
    };

    projects.unshift(newProject);
    activeProjectId = newProject.id;
  } else if (activeProjectId === projectId) {
    sortProjects();
    activeProjectId = projects[0].id;
  }

  sortProjects();
  renderProjects();
  renderActiveProject();
  await saveProjectsToServer();
}

async function renameProject(projectId, newTitle) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  const cleanTitle = String(newTitle || "").trim();
  if (!cleanTitle) return;

  project.title = cleanTitle;
  touchProject(project);
  openMenuProjectId = null;
  sortProjects();
  renderProjects();
  renderActiveProject();
  await saveProjectsToServer();
}

function renderProjects() {
  sortProjects();
  projectList.innerHTML = "";

  projects.forEach((project) => {
    const card = document.createElement("div");
    card.className = "project-card" + (project.id === activeProjectId ? " active" : "");
    card.dataset.id = project.id;

    const lastRealMessage = [...project.messages].reverse().find((m) => m.role === "user" || m.role === "ai");
    const previewText = lastRealMessage
      ? stripCodeBlocks(lastRealMessage.content).slice(0, 60)
      : "No messages yet";

    card.innerHTML = `
      <div class="project-card-top">
        <div class="project-text-wrap">
          <div class="project-name">${escapeHtml(project.title)}</div>
          <div class="project-preview">${escapeHtml(previewText)}</div>
          <div class="project-meta">Edited ${escapeHtml(formatRelativeTime(project.updatedAt || project.createdAt))}</div>
        </div>

        <div class="project-menu-wrap">
          <button class="project-menu-btn" type="button" data-menu-btn="${project.id}">⋯</button>
          <div class="project-menu${openMenuProjectId === project.id ? " show" : ""}">
            <button class="project-menu-item" type="button" data-rename-id="${project.id}">
              Rename
            </button>
            <button class="project-menu-item delete" type="button" data-delete-id="${project.id}">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-menu-wrap")) return;

      activeProjectId = project.id;
      openMenuProjectId = null;
      renderProjects();
      renderActiveProject();
    });

    projectList.appendChild(card);
  });

  document.querySelectorAll("[data-menu-btn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-menu-btn");
      openMenuProjectId = openMenuProjectId === id ? null : id;
      renderProjects();
    });
  });

  document.querySelectorAll("[data-rename-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-rename-id");
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      openRenameModal(id, project.title);
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-delete-id");
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      openDeleteModal(id, project.title);
    });
  });
}

function createTextPart(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div;
}

function createCodeBlock(code, language = "code") {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  const top = document.createElement("div");
  top.className = "code-top";

  const label = document.createElement("span");
  label.textContent = language || "code";

  const actions = document.createElement("div");
  actions.className = "code-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy";

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    } catch {
      copyBtn.textContent = "Failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    }
  });

  actions.appendChild(copyBtn);

  if (isProUser) {
    const explainCodeBtn = document.createElement("button");
    explainCodeBtn.className = "copy-btn";
    explainCodeBtn.textContent = "Explain";
    explainCodeBtn.addEventListener("click", async () => {
      await runProTool("/explain", code, "explain");
    });

    const fixCodeBtn = document.createElement("button");
    fixCodeBtn.className = "copy-btn";
    fixCodeBtn.textContent = "Fix";
    fixCodeBtn.addEventListener("click", async () => {
      await runProTool("/fix", code, "fix");
    });

    const optimizeCodeBtn = document.createElement("button");
    optimizeCodeBtn.className = "copy-btn";
    optimizeCodeBtn.textContent = "Optimize";
    optimizeCodeBtn.addEventListener("click", async () => {
      await runProTool("/optimize", code, "optimize");
    });

    actions.appendChild(explainCodeBtn);
    actions.appendChild(fixCodeBtn);
    actions.appendChild(optimizeCodeBtn);
  }

  top.appendChild(label);
  top.appendChild(actions);

  const pre = document.createElement("pre");
  pre.className = "code-content";

  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  wrapper.appendChild(top);
  wrapper.appendChild(pre);

  return wrapper;
}

function renderMessageContent(container, content) {
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      container.appendChild(createTextPart(before));
    }

    const language = match[1] || "code";
    const code = match[2].trim();
    container.appendChild(createCodeBlock(code, language));

    lastIndex = regex.lastIndex;
  }

  const after = content.slice(lastIndex);
  if (after.trim()) {
    container.appendChild(createTextPart(after));
  }
}

function addMessageToUI(role, content) {
  const row = document.createElement("div");
  row.className = "row " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  renderMessageContent(bubble, content);

  row.appendChild(bubble);
  chat.appendChild(row);
}

function renderActiveProject() {
  const project = getActiveProject();
  if (!project) {
    chat.innerHTML = "";
    projectTitle.textContent = "No Project";
    return;
  }

  projectTitle.textContent = project.title;
  chat.innerHTML = "";

  project.messages.forEach((message) => {
    addMessageToUI(message.role, message.content);
  });

  scrollChatToBottom();
}

async function addMessage(role, content) {
  const project = getActiveProject();
  if (!project) return;

  project.messages.push({ role, content });

  if (role === "user" && project.title === "New Project") {
    project.title = getProjectTitleFromMessage(content);
  }

  touchProject(project);

  addMessageToUI(role, content);
  sortProjects();
  renderProjects();
  renderActiveProject();
  scrollChatToBottom();
  await saveProjectsToServer();
}

function showTyping() {
  if (isThinking) return;
  isThinking = true;

  const row = document.createElement("div");
  row.className = "row ai";
  row.id = "typingRow";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  bubble.appendChild(typing);
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollChatToBottom();
}

function removeTyping() {
  const typingRow = document.getElementById("typingRow");
  if (typingRow) typingRow.remove();
  isThinking = false;
}

function buildHistoryForAPI(messages) {
  return messages
    .filter((m) => m.role === "user" || m.role === "ai")
    .slice(-12)
    .map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.content
    }));
}

function getLastAssistantCodeBlock() {
  const project = getActiveProject();
  if (!project) return null;

  for (let i = project.messages.length - 1; i >= 0; i--) {
    const msg = project.messages[i];
    if (msg.role !== "ai") continue;

    const matches = [...msg.content.matchAll(/```(?:\w+)?\n?([\s\S]*?)```/g)];
    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
  }

  return null;
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || isThinking) return;

  await addMessage("user", message);
  messageInput.value = "";
  autoResizeTextarea();

  showTyping();

  try {
    const project = getActiveProject();
    const history = buildHistoryForAPI(project.messages.slice(0, -1));

    const res = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: message,
        history
      })
    });

    const data = await res.json();
    removeTyping();

    if (!res.ok) {
      if (typeof data.remainingToday === "number") {
        dailyRemaining = data.remainingToday;
        updateDailyLimitUI();
      }

      if (res.status === 403 && data.limitReached) {
        openLimitModal();
      }

      await addMessage("ai", data.error || "Something went wrong.");
      return;
    }

    if (typeof data.remainingToday === "number") {
      dailyRemaining = data.remainingToday;
      updateDailyLimitUI();
    }

    await addMessage("ai", data.response || "No response.");
  } catch (error) {
    removeTyping();
    await addMessage("ai", "Error talking to AI.");
    console.error(error);
  }
}

async function runProTool(endpoint, code, toolName) {
  if (!isProUser) {
    openPricingModal(`${toolName.charAt(0).toUpperCase() + toolName.slice(1)} is part of GameDev AI Pro.`);
    return;
  }

  if (!code || !code.trim()) {
    await addMessage("ai", "There is no code to " + toolName + " yet.");
    return;
  }

  if (isThinking) return;

  showTyping();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    removeTyping();

    if (!res.ok) {
      await addMessage("ai", data.error || `Failed to ${toolName}.`);
      return;
    }

    await addMessage("ai", data.response || `No ${toolName} response.`);
  } catch (error) {
    removeTyping();
    await addMessage("ai", `Error trying to ${toolName} the code.`);
    console.error(error);
  }
}

function normalizeProject(project) {
  const safeMessages = Array.isArray(project.messages) && project.messages.length
    ? project.messages
    : [createWelcomeMessage()];

  return {
    id: project.id || makeId(),
    title: project.title || "New Project",
    messages: safeMessages,
    createdAt: project.createdAt || nowTs(),
    updatedAt: project.updatedAt || project.createdAt || nowTs()
  };
}

async function loadProjects() {
  const res = await fetch("/api/projects");
  const data = await res.json();

  if (!res.ok) {
    projects = [];
    activeProjectId = null;
    return;
  }

  projects = (data.projects || []).map(normalizeProject);
  openMenuProjectId = null;

  if (!projects.length) {
    createProject("New Project");
  } else {
    sortProjects();
    activeProjectId = projects[0].id;
    renderProjects();
    renderActiveProject();
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();

    if (data.loggedIn) {
      currentUser = data.user;
      isProUser = !!data.user.isPro;
      userBadge.textContent = currentUser.username;
      dailyRemaining = typeof data.user.remainingToday === "number" ? data.user.remainingToday : 10;
      dailyMax = typeof data.user.dailyMax === "number" ? data.user.dailyMax : 10;
      updateProUI();
      hideAuth();
      await loadProjects();
    } else {
      currentUser = null;
      isProUser = false;
      dailyRemaining = 10;
      dailyMax = 10;
      userBadge.textContent = "Guest";
      updateProUI();
      showAuth();
    }
  } catch (error) {
    console.error(error);
    showAuth();
  }
}

loginTabBtn.addEventListener("click", () => setAuthMode("login"));
signupTabBtn.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  const username = authUsername.value.trim();
  const password = authPassword.value;

  if (!username || !password) {
    authError.textContent = "Enter a username and password.";
    return;
  }

  const endpoint = authMode === "login" ? "/api/login" : "/api/signup";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Something went wrong.";
      return;
    }

    currentUser = data.user;
    isProUser = !!data.user.isPro;
    userBadge.textContent = currentUser.username;
    dailyRemaining = typeof data.user.remainingToday === "number" ? data.user.remainingToday : 10;
    dailyMax = typeof data.user.dailyMax === "number" ? data.user.dailyMax : 10;
    updateProUI();
    authUsername.value = "";
    authPassword.value = "";
    hideAuth();
    await loadProjects();
  } catch (error) {
    console.error(error);
    authError.textContent = "Could not connect to server.";
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (error) {
    console.error(error);
  }

  currentUser = null;
  isProUser = false;
  dailyRemaining = 10;
  dailyMax = 10;
  projects = [];
  activeProjectId = null;
  openMenuProjectId = null;
  userBadge.textContent = "Guest";
  updateProUI();
  chat.innerHTML = "";
  projectList.innerHTML = "";
  projectTitle.textContent = "New Project";
  showAuth();
});

newProjectBtn.addEventListener("click", () => {
  createProject("New Project");
});

clearChatBtn.addEventListener("click", async () => {
  const project = getActiveProject();
  if (!project) return;

  project.messages = [
    {
      role: "ai",
      content: "Chat cleared. Ask me for a new script, idea, or fix."
    }
  ];
  touchProject(project);

  sortProjects();
  renderProjects();
  renderActiveProject();
  await saveProjectsToServer();
});

renameProjectBtn.addEventListener("click", () => {
  const project = getActiveProject();
  if (!project) return;
  openRenameModal(project.id, project.title);
});

confirmRenameBtn.addEventListener("click", async () => {
  if (!projectToRenameId) return;
  await renameProject(projectToRenameId, renameProjectInput.value);
  closeRenameModal();
});

cancelRenameBtn.addEventListener("click", () => {
  closeRenameModal();
});

renameProjectInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!projectToRenameId) return;
    await renameProject(projectToRenameId, renameProjectInput.value);
    closeRenameModal();
  }
});

toggleSidebarBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

pricingBtn.addEventListener("click", () => {
  openPricingModal();
});

upgradeSoonBtn.addEventListener("click", () => {
  openPricingModal();
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await sendMessage();
});

messageInput.addEventListener("input", autoResizeTextarea);

messageInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    await sendMessage();
  }
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!projectToDeleteId) return;
  await deleteProject(projectToDeleteId);
  closeDeleteModal();
});

cancelDeleteBtn.addEventListener("click", () => {
  closeDeleteModal();
});

closeUpgradeBtn.addEventListener("click", () => {
  closePricingModal();
});

limitGoPricingBtn.addEventListener("click", () => {
  closeLimitModal();
  openPricingModal("You ran out of free messages. Upgrade to Pro or use chat credits.");
});

limitCloseBtn.addEventListener("click", () => {
  closeLimitModal();
});

proFeatureButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const featureName = btn.getAttribute("data-pro-feature") || "This feature";

    if (!isProUser) {
      openPricingModal(`${featureName} is part of GameDev AI Pro.`);
      return;
    }

    if (featureName === "Advanced AI") {
      messageInput.value = "Build me a better Roblox system using the Pro model.";
    } else if (featureName === "System Builder") {
      messageInput.value = "Make me a full Roblox game system with scripts, folder setup, remotes, UI, and explanations.";
    } else if (featureName === "Fast Fix") {
      messageInput.value = "Fix my Roblox Lua code and explain what was broken.";
    }

    autoResizeTextarea();
    messageInput.focus();
  });
});

fixBtn.addEventListener("click", async () => {
  const code = getLastAssistantCodeBlock() || messageInput.value.trim();
  await runProTool("/fix", code, "fix");
});

explainBtn.addEventListener("click", async () => {
  const code = getLastAssistantCodeBlock() || messageInput.value.trim();
  await runProTool("/explain", code, "explain");
});

optimizeBtn.addEventListener("click", async () => {
  const code = getLastAssistantCodeBlock() || messageInput.value.trim();
  await runProTool("/optimize", code, "optimize");
});

deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    closeDeleteModal();
  }
});

renameModal.addEventListener("click", (e) => {
  if (e.target === renameModal) {
    closeRenameModal();
  }
});

upgradeModal.addEventListener("click", (e) => {
  if (e.target === upgradeModal) {
    closePricingModal();
  }
});

limitModal.addEventListener("click", (e) => {
  if (e.target === limitModal) {
    closeLimitModal();
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".project-menu-wrap")) {
    if (openMenuProjectId !== null) {
      openMenuProjectId = null;
      renderProjects();
    }
  }
});

async function init() {
  setAuthMode("login");
  autoResizeTextarea();
  updateProUI();
  await checkAuth();
}

init();