const tg = window.Telegram && window.Telegram.WebApp;
const API = window.STUDIO_API || "";
const choice = { music: "phonk", effect: "none", part: "full" };

function initData() {
  return (tg && tg.initData) || "";
}

async function api(path, options = {}) {
  const headers = Object.assign({
    "X-Telegram-Init-Data": initData(),
  }, options.headers || {});
  const response = await fetch(`${API}${path}`, Object.assign({}, options, { headers }));
  const kind = response.headers.get("content-type") || "";
  if (kind.includes("application/json")) {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Студия не ответила.");
    return payload;
  }
  if (!response.ok) throw new Error("Студия не ответила.");
  return response;
}

function showPanel(name) {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("on", panel.id === `panel-${name}`);
  });
  document.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle("on", button.dataset.panel === name);
  });
  const titles = { home: "Главная", chat: "Чат", build: "Сборка", profile: "Профиль" };
  document.getElementById("title").textContent = titles[name] || "Студия";
}

document.querySelector("nav").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) showPanel(button.dataset.panel);
});

function stamp(unix) {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadHome() {
  const data = await api("/api/home");
  const usage = data.usage || {};
  document.getElementById("token-name").textContent = usage.connected
    ? `Ключ подключён: ${usage.key_name || "Cursor"}`
    : "Ключ Cursor не ответил.";
  document.getElementById("token-note").textContent = usage.note || "";
  document.getElementById("token-count").textContent = `Задач студии: ${usage.requests || 0}`;
  const history = document.getElementById("history");
  history.replaceChildren();
  (data.history || []).forEach((item) => {
    const line = document.createElement("li");
    line.textContent = `${stamp(item.at)} · ${item.title}`;
    history.appendChild(line);
  });
  if (!history.children.length) {
    const line = document.createElement("li");
    line.textContent = "Пока пусто.";
    history.appendChild(line);
  }
}

async function loadChat() {
  const data = await api("/api/chat");
  const box = document.getElementById("messages");
  box.replaceChildren();
  (data.messages || []).forEach((item) => {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${item.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = item.text;
    box.appendChild(bubble);
  });
  box.scrollTop = box.scrollHeight;
}

async function loadProfile() {
  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  const data = await api("/api/profile");
  const profile = data.profile || {};
  const name = [profile.first_name || (user && user.first_name) || "", profile.last_name || ""].join(" ").trim();
  document.getElementById("profile-name").textContent = name || "Без имени";
  const username = profile.username ? `@${profile.username}` : "";
  document.getElementById("profile-id").textContent = `ID ${profile.id || (user && user.id) || "—"} ${username}`;
  const avatar = document.getElementById("avatar");
  try {
    const response = await api("/api/photo");
    avatar.src = URL.createObjectURL(await response.blob());
  } catch (error) {
    if (profile.photo_url) avatar.src = profile.photo_url;
  }
  const devices = document.getElementById("devices");
  devices.replaceChildren();
  (data.devices || []).forEach((item) => {
    const line = document.createElement("li");
    line.textContent = `${item.label} · ${stamp(item.last_seen)}`;
    devices.appendChild(line);
  });
  if (!devices.children.length) {
    const line = document.createElement("li");
    line.textContent = "Пока только это открытие.";
    devices.appendChild(line);
  }
}

function setProgress(payload) {
  const percent = Math.max(0, Math.min(100, Number(payload.percent) || 0));
  document.getElementById("percent").textContent = `${percent}%`;
  document.getElementById("bar").style.width = `${percent}%`;
  document.getElementById("detail").textContent = payload.detail || payload.error || "Жду.";
}

async function watchJob() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await api("/api/status");
    setProgress(status);
    if (status.done) {
      if (status.ready) await showVideo();
      await loadHome();
      await loadChat();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function showVideo() {
  const response = await api("/api/result");
  const video = document.getElementById("preview");
  video.src = URL.createObjectURL(await response.blob());
  video.hidden = false;
}

async function loadMusic() {
  const data = await api("/api/music");
  const box = document.getElementById("music");
  box.replaceChildren();
  (data.tracks || []).forEach((track) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = track.id;
    button.textContent = track.title;
    if (track.id === choice.music) button.classList.add("on");
    box.appendChild(button);
  });
}

function choose(group, value) {
  choice[group] = value;
  document.querySelectorAll(`#${group} button`).forEach((button) => {
    button.classList.toggle("on", button.dataset.value === value);
  });
}

document.getElementById("music").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) choose("music", button.dataset.value);
});
document.getElementById("part").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) choose("part", button.dataset.value);
});
document.getElementById("effect").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) choose("effect", button.dataset.value);
});

document.getElementById("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = document.getElementById("chat-text").value.trim();
  if (!text) return;
  document.getElementById("chat-text").value = "";
  try {
    await api("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    await loadChat();
    await loadHome();
  } catch (error) {
    document.getElementById("detail").textContent = error.message;
  }
});

async function findTrends(mode) {
  document.getElementById("detail").textContent = "Ищу варианты...";
  const data = await api("/api/trends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const box = document.getElementById("trends");
  box.replaceChildren();
  (data.trends || []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "trend";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.title;
    button.addEventListener("click", () => takeTrend(item, mode));
    row.appendChild(button);
    box.appendChild(row);
  });
  if (!box.children.length) {
    document.getElementById("detail").textContent = data.error || "Ничего не нашлось.";
  } else {
    document.getElementById("detail").textContent = `Нашёл ${box.children.length} из 5.`;
  }
}

async function takeTrend(item, mode) {
  document.getElementById("detail").textContent = "Пишу сценарий...";
  const data = await api("/api/work", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: item.id, title: item.title, mode }),
  });
  document.getElementById("detail").textContent = "Сценарий готов. Напиши в чате, что поправить.";
  document.getElementById("request").value = "";
  await loadChat();
  await loadHome();
  if (data.script) showPanel("chat");
}

document.getElementById("find-shorts").addEventListener("click", () => findTrends("shorts"));
document.getElementById("find-videos").addEventListener("click", () => findTrends("video"));

document.getElementById("file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  setProgress({ percent: 5, detail: "Загружаю файл..." });
  try {
    await api("/api/upload", {
      method: "POST",
      headers: { "X-Filename": encodeURIComponent(file.name || "clip.mp4") },
      body: file,
    });
    await watchJob();
  } catch (error) {
    document.getElementById("detail").textContent = error.message;
  }
});

document.getElementById("render").addEventListener("click", async () => {
  try {
    await api("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        music: choice.music,
        effect: choice.effect,
        part: choice.part,
        request: document.getElementById("request").value.trim(),
      }),
    });
    await watchJob();
  } catch (error) {
    document.getElementById("detail").textContent = error.message;
  }
});

async function boot() {
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#17160f");
    tg.setBackgroundColor("#17160f");
  }
  if (!initData()) {
    document.getElementById("token-note").textContent = "Открой студию кнопкой в Telegram, иначе задачи не запустятся.";
    return;
  }
  const platform = tg.platform || "web";
  try {
    await api("/api/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        version: tg.version || "",
        label: `${platform} · студия`,
      }),
    });
    await Promise.all([loadHome(), loadChat(), loadProfile(), loadMusic()]);
  } catch (error) {
    document.getElementById("token-note").textContent = error.message;
  }
}

boot();
