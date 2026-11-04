const tg = window.Telegram && window.Telegram.WebApp;
const repoStatus = "https://raw.githubusercontent.com/VMRcompany/minecraft-shorts-studio/main/status";
const choice = { music: "phonk", effect: "none", part: "full" };

function selected(group, value) {
  choice[group] = value;
  document.querySelectorAll(`#${group} button`).forEach((button) => {
    button.classList.toggle("on", button.dataset.value === value);
  });
}

document.querySelectorAll(".choices").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    selected(group.id, button.dataset.value);
  });
});

function showStatus(payload) {
  const percent = Math.max(0, Math.min(100, Number(payload.percent) || 0));
  document.getElementById("percent").textContent = `${percent}%`;
  document.getElementById("bar").style.width = `${percent}%`;
  document.getElementById("detail").textContent = payload.detail || "Жду задачу.";
  const log = document.getElementById("log");
  log.replaceChildren();
  (payload.log || []).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    log.appendChild(item);
  });
}

async function poll(userId) {
  if (!userId) return;
  try {
    const response = await fetch(`${repoStatus}/${userId}.json?t=${Date.now()}`, { cache: "no-store" });
    if (response.ok) showStatus(await response.json());
  } catch (error) {
    document.getElementById("detail").textContent = "Статус пока не прочитался. Готовый ролик всё равно придёт в чат.";
  }
}

function boot() {
  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#17160f");
    tg.setBackgroundColor("#17160f");
  }
  document.getElementById("who").textContent = user
    ? `${user.first_name}, сборка видна здесь, а файл приходит в чат.`
    : "Открой эту страницу кнопкой «Студия» в боте.";
  if (user) {
    poll(user.id);
    setInterval(() => poll(user.id), 5000);
  }
}

document.getElementById("send").addEventListener("click", () => {
  const payload = JSON.stringify({
    music: choice.music,
    effect: choice.effect,
    part: choice.part,
    request: document.getElementById("request").value.trim(),
  });
  if (!tg || !tg.sendData) {
    document.getElementById("detail").textContent = "Открой студию нижней кнопкой в чате бота и нажми ещё раз.";
    return;
  }
  try {
    tg.sendData(payload);
  } catch (error) {
    document.getElementById("detail").textContent = "Отправь задачу нижней кнопкой «Студия». Кнопка у поля ввода показывает статус.";
    return;
  }
  document.getElementById("detail").textContent = "Отправляю задачу боту...";
});

boot();
