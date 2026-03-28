const sidebar = document.getElementById("sidebar");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");

const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const typing = document.getElementById("typing");

const projectList = document.getElementById("projectList");
const newProjectBtn = document.getElementById("newProject");
const renameBtn = document.getElementById("renameBtn");
const deleteBtn = document.getElementById("deleteBtn");

const projectTitle = document.getElementById("projectTitle");
const projectSubtitle = document.getElementById("projectSubtitle");

let projects = [];
let current = null;

/* SIDEBAR */
closeSidebar.onclick = () => {
  sidebar.classList.add("collapsed");
  openSidebar.classList.remove("hidden");
};

openSidebar.onclick = () => {
  sidebar.classList.remove("collapsed");
  openSidebar.classList.add("hidden");
};

/* PROJECTS */
function createProject() {
  const id = Date.now();
  const project = {
    id,
    name: "New Project",
    messages: []
  };

  projects.unshift(project);
  current = project;
  renderProjects();
  renderChat();
}

function renderProjects() {
  projectList.innerHTML = "";

  projects.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p.name;

    if (p === current) btn.classList.add("active");

    btn.onclick = () => {
      current = p;
      renderProjects();
      renderChat();
    };

    projectList.appendChild(btn);
  });
}

function renderChat() {
  chat.innerHTML = "";
  projectTitle.textContent = current.name;

  current.messages.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg " + m.role;
    div.textContent = m.text;
    chat.appendChild(div);
  });
}

/* CHAT */
form.onsubmit = async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  current.messages.push({ role: "user", text });
  input.value = "";
  renderChat();

  typing.classList.remove("hidden");

  const res = await fetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: text })
  });

  const data = await res.json();

  typing.classList.add("hidden");

  current.messages.push({ role: "ai", text: data.reply });
  renderChat();
};

/* RENAME */
renameBtn.onclick = () => {
  const name = prompt("New name:");
  if (!name) return;
  current.name = name;
  renderProjects();
  renderChat();
};

/* DELETE */
deleteBtn.onclick = () => {
  if (projects.length <= 1) return alert("Need at least 1 project");

  projects = projects.filter(p => p !== current);
  current = projects[0];
  renderProjects();
  renderChat();
};

/* INIT */
createProject();