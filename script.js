const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("toggleSidebar");

const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

const projectList = document.getElementById("projectList");

let projects = [];
let current = null;

/* SIDEBAR TOGGLE */
toggle.onclick = () => {
  sidebar.classList.toggle("collapsed");
};

/* PROJECTS */
function createProject() {
  const project = {
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

    btn.onclick = () => {
      current = p;
      renderChat();
    };

    projectList.appendChild(btn);
  });
}

function renderChat() {
  chat.innerHTML = "";

  current.messages.forEach(m => {
    const div = document.createElement("div");
    div.textContent = m.text;
    chat.appendChild(div);
  });
}

/* CHAT */
form.onsubmit = async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  current.messages.push({ text });

  input.value = "";
  renderChat();

  const res = await fetch("/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt: text })
  });

  const data = await res.json();

  current.messages.push({ text: data.reply });
  renderChat();
};

/* INIT */
createProject();