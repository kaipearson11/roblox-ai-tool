const chatForm = document.getElementById("chatForm");
const promptInput = document.getElementById("promptInput");
const chatMessages = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");

const sidebar = document.getElementById("sidebar");
const collapseSidebarBtn = document.getElementById("collapseSidebarBtn");
const expandSidebarBtn = document.getElementById("expandSidebarBtn");

const newProjectBtn = document.getElementById("newProjectBtn");
const renameProjectBtn = document.getElementById("renameProjectBtn");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");
const clearBtn = document.getElementById("clearBtn");

const projectList = document.getElementById("projectList");
const projectTitle = document.getElementById("projectTitle");
const projectSubtitle = document.getElementById("projectSubtitle");

const quickActionButtons = document.querySelectorAll(".quick-action-btn");

const STORAGE_KEY = "gamedevai_projects_v5";
const SIDEBAR_KEY = "gamedevai_sidebar_collapsed_v5";

let projects = [];
let currentProjectId = null;

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function loadProjects() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    projects = [];
    return;
  }

  try {
    projects = JSON.parse(raw);
    if (!Array.isArray(projects)) projects = [];
  } catch (error) {
    projects = [];
  }
}

function createProject(name = "New Project") {
  const id = Date.now().toString() + Math.random().toString(16).slice(2);

  return {
    id,
    name,
    subtitle: "Start chatting to build your next Roblox idea.",
    messages: [
      {
        role: "ai",
        text: "Tell me what you want to build and I’ll help with scripts, ideas, mechanics, UI, balancing, bugs, and progression."
      }
    ],
    createdAt: Date.now()
  };
}

function ensureAtLeastOneProject() {
  if (projects.length === 0) {
    const firstProject = createProject();
    projects.unshift(firstProject);
    currentProjectId = firstProject.id;
    saveProjects();
  } else if (!projects.find(project => project.id === currentProjectId)) {
    currentProjectId = projects[0].id;
  }
}

function getCurrentProject() {
  return projects.find(project => project.id === currentProjectId);
}

function renderProjectList() {
  projectList.innerHTML = "";

  projects.forEach(project => {
    const button = document.createElement("button");
    button.className = "project-card" + (project.id === currentProjectId ? " active" : "");
    button.type = "button";

    const count = project.messages.filter(message => message.role === "user").length;
    const subText = count === 1 ? "1 message" : `${count} messages`;

    button.innerHTML = `
      <div class="project-card-title">${escapeHtml(project.name)}</div>
      <div class="project-card-sub">${subText}</div>
    `;

    button.addEventListener("click", () => {
      currentProjectId = project.id;
      saveProjects();
      renderAll();
    });

    projectList.appendChild(button);
  });
}

function renderMessages() {
  const project = getCurrentProject();
  chatMessages.innerHTML = "";

  if (!project) return;

  project.messages.forEach(message => {
    const row = document.createElement("div");
    row.className = `message-row ${message.role === "user" ? "user-row" : "ai-row"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${message.role === "user" ? "user-avatar" : "ai-avatar"}`;
    avatar.textContent = message.role === "user" ? "You" : "AI";

    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${message.role === "user" ? "user-bubble" : "ai-bubble"}`;
    bubble.textContent = message.text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatMessages.appendChild(row);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderHeader() {
  const project = getCurrentProject();

  if (!project) return;

  projectTitle.textContent = project.name;
  projectSubtitle.textContent = project.subtitle || "Start chatting to build your next Roblox idea.";
}

function renderAll() {
  renderProjectList();
  renderHeader();
  renderMessages();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function autoResizeTextarea() {
  promptInput.style.height = "auto";
  promptInput.style.height = Math.min(promptInput.scrollHeight, 220) + "px";
}

function collapseSidebar() {
  sidebar.classList.add("collapsed");
  expandSidebarBtn.classList.remove("hidden");
  localStorage.setItem(SIDEBAR_KEY, "true");
}

function expandSidebar() {
  sidebar.classList.remove("collapsed");
  expandSidebarBtn.classList.add("hidden");
  localStorage.setItem(SIDEBAR_KEY, "false");
}

function loadSidebarState() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";

  if (collapsed) {
    collapseSidebar();
  } else {
    expandSidebar();
  }
}

function addUserMessage(text) {
  const project = getCurrentProject();
  if (!project) return;

  project.messages.push({
    role: "user",
    text
  });

  if (project.name === "New Project" && text.trim()) {
    project.name = text.trim().slice(0, 32);
  }

  project.subtitle = "Working on scripts, ideas, mechanics, and systems.";
  saveProjects();
  renderAll();
}

function addAiMessage(text) {
  const project = getCurrentProject();
  if (!project) return;

  project.messages.push({
    role: "ai",
    text
  });

  saveProjects();
  renderAll();
}

async function sendPrompt(promptText) {
  addUserMessage(promptText);

  typingIndicator.classList.remove("hidden");
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: promptText })
    });

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error("The server did not return valid JSON.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    addAiMessage(data.reply || "I didn’t get a response.");
  } catch (error) {
    addAiMessage("Error: " + error.message);
  } finally {
    typingIndicator.classList.add("hidden");
  }
}

function makeNewProject() {
  const project = createProject();
  projects.unshift(project);
  currentProjectId = project.id;
  saveProjects();
  renderAll();
}

function renameCurrentProject() {
  const project = getCurrentProject();
  if (!project) return;

  const newName = window.prompt("Rename project:", project.name);

  if (!newName) return;

  project.name = newName.trim() || project.name;
  saveProjects();
  renderAll();
}

function deleteCurrentProject() {
  if (projects.length <= 1) {
    alert("You need to keep at least one project.");
    return;
  }

  const project = getCurrentProject();
  if (!project) return;

  const confirmed = window.confirm(`Delete "${project.name}"?`);

  if (!confirmed) return;

  projects = projects.filter(projectItem => projectItem.id !== project.id);
  currentProjectId = projects[0].id;
  saveProjects();
  renderAll();
}

function clearInput() {
  promptInput.value = "";
  autoResizeTextarea();
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const promptText = promptInput.value.trim();
  if (!promptText) return;

  promptInput.value = "";
  autoResizeTextarea();

  await sendPrompt(promptText);
});

promptInput.addEventListener("input", autoResizeTextarea);

promptInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

collapseSidebarBtn.addEventListener("click", collapseSidebar);
expandSidebarBtn.addEventListener("click", expandSidebar);
newProjectBtn.addEventListener("click", makeNewProject);
renameProjectBtn.addEventListener("click", renameCurrentProject);
deleteProjectBtn.addEventListener("click", deleteCurrentProject);
clearBtn.addEventListener("click", clearInput);

quickActionButtons.forEach(button => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.fill || "";
    autoResizeTextarea();
    promptInput.focus();
  });
});

loadProjects();
ensureAtLeastOneProject();
loadSidebarState();
renderAll();
autoResizeTextarea();