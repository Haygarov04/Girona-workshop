const CAST = {
  lina: { name: "Lina Voss", voice: "eve", role: "Orchard surveyor" },
  bram: { name: "Bram", voice: "leo", role: "Groundskeeper" },
  sera: { name: "Sera Quill", voice: "ara", role: "Night librarian" },
  edwin: { name: "Edwin Voss", voice: "rex", role: "Lina's brother" },
};

const lines = [...document.querySelectorAll("article p[data-voice]")];
const player = document.querySelector(".player");
const portrait = player.querySelector("img");
const whoNow = player.querySelector(".who-now");
const statusEl = player.querySelector(".status");
const bar = player.querySelector(".track span");
const playBtn = player.querySelector("[data-action='play']");
const stopBtn = player.querySelector("[data-action='stop']");
const slowBtn = player.querySelector("[data-action='slow']");

const audio = new Audio();
let token = 0;
let urls = [];
let slow = false;
try {
  slow = localStorage.getItem("orchard-slow") === "1";
} catch (_) {
  slow = false;
}
let paused = false;
let activeIndex = -1;

slowBtn.setAttribute("aria-pressed", slow ? "true" : "false");

function spokenText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll(".who, .say").forEach((el) => el.remove());
  return clone.textContent.replace(/\s+/g, " ").trim();
}

function setSpeaker(id) {
  const person = CAST[id] || CAST.lina;
  portrait.src = `images/${id}.jpg`;
  portrait.alt = "";
  whoNow.textContent = person.name;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function releaseUrls() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
}

function halt() {
  token += 1;
  paused = false;
  audio.pause();
  releaseUrls();
  lines.forEach((line) => line.classList.remove("is-speaking"));
  playBtn.textContent = "Play";
  bar.style.width = "0%";
}

async function fetchClip(text, voice) {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!response.ok) {
    let message = "The voice could not speak just now.";
    try {
      const payload = await response.json();
      if (payload.error) message = payload.error;
    } catch (_) {
      /* keep the fallback */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
}

function playUrl(url, run) {
  audio.src = url;
  audio.playbackRate = slow ? 0.84 : 1;
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (run !== token) {
        clearInterval(timer);
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", fail);
        resolve();
      }
    }, 200);
    const finish = () => {
      clearInterval(timer);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      clearInterval(timer);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", fail);
      reject(new Error("Playback stopped."));
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", fail);
    audio.play().catch(fail);
  });
}

async function speakParagraphs(startAt) {
  if (!lines.length) return;
  const run = ++token;
  paused = false;
  releaseUrls();
  playBtn.textContent = "Pause";
  let upcoming = null;
  for (let index = startAt; index < lines.length; index += 1) {
    if (run !== token) return;
    const line = lines[index];
    const id = line.dataset.voice;
    const text = spokenText(line);
    if (!text) continue;
    activeIndex = index;
    lines.forEach((item) => item.classList.remove("is-speaking"));
    line.classList.add("is-speaking");
    setSpeaker(id);
    setStatus(`Paragraph ${index + 1} of ${lines.length}`);
    bar.style.width = `${((index + 1) / lines.length) * 100}%`;
    line.scrollIntoView({ block: "center", behavior: "smooth" });
    try {
      const url = upcoming && upcoming.index === index ? await upcoming.promise : await fetchClip(text, CAST[id].voice);
      upcoming = null;
      if (run !== token) return;
      const next = lines[index + 1];
      if (next) {
        const nextText = spokenText(next);
        if (nextText) {
          upcoming = {
            index: index + 1,
            promise: fetchClip(nextText, CAST[next.dataset.voice].voice),
          };
        }
      }
      await playUrl(url, run);
    } catch (error) {
      if (run !== token) return;
      setStatus(error.message);
      playBtn.textContent = "Play";
      return;
    }
  }
  if (run !== token) return;
  lines.forEach((item) => item.classList.remove("is-speaking"));
  setStatus("End of this part.");
  playBtn.textContent = "Play";
  activeIndex = -1;
}

async function speakOnce(text, id) {
  halt();
  const run = token;
  setSpeaker(id);
  setStatus(`${CAST[id].name} is speaking`);
  playBtn.textContent = "Pause";
  try {
    const url = await fetchClip(text, CAST[id].voice);
    if (run !== token) return;
    await playUrl(url, run);
    if (run !== token) return;
    setStatus("Ready");
    playBtn.textContent = "Play";
  } catch (error) {
    if (run !== token) return;
    setStatus(error.message);
    playBtn.textContent = "Play";
  }
}

playBtn.addEventListener("click", () => {
  if (!audio.paused && !audio.ended && audio.src) {
    audio.pause();
    paused = true;
    playBtn.textContent = "Play";
    setStatus("Paused");
    return;
  }
  if (paused && audio.src) {
    paused = false;
    audio.play();
    playBtn.textContent = "Pause";
    setStatus(`Paragraph ${activeIndex + 1} of ${lines.length}`);
    return;
  }
  const start = activeIndex >= 0 ? activeIndex : 0;
  speakParagraphs(start);
});

stopBtn.addEventListener("click", () => {
  halt();
  setStatus("Stopped");
  setSpeaker(document.body.dataset.narrator || "lina");
});

slowBtn.addEventListener("click", () => {
  slow = !slow;
  try {
    localStorage.setItem("orchard-slow", slow ? "1" : "0");
  } catch (_) {
    /* private browsing can block storage */
  }
  slowBtn.setAttribute("aria-pressed", slow ? "true" : "false");
  audio.playbackRate = slow ? 0.84 : 1;
  setStatus(slow ? "Slower English is on." : "Normal pace.");
});

lines.forEach((line, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "say";
  button.textContent = "Hear this";
  const holder = document.createElement("div");
  holder.className = "para-tools";
  holder.append(button);
  line.insertAdjacentElement("afterend", holder);
  button.addEventListener("click", () => {
    speakParagraphs(index);
  });
});

document.querySelectorAll("[data-line]").forEach((button) => {
  button.addEventListener("click", () => {
    speakOnce(button.dataset.line, button.dataset.voice);
  });
});

setSpeaker(document.body.dataset.narrator || "lina");
setStatus(lines.length ? "Press Play to hear this part in English." : "Ready");

const askRoot = document.querySelector("#ask");
if (askRoot) {
  const threads = { lina: [], bram: [], sera: [], edwin: [] };
  let current = "lina";
  const log = askRoot.querySelector(".log");
  const form = askRoot.querySelector("form");
  const input = form.querySelector("input");
  const choices = [...askRoot.querySelectorAll(".choice")];

  function render() {
    log.replaceChildren();
    const thread = threads[current];
    if (!thread.length) {
      const empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = `Ask ${CAST[current].name} in English about the orchard, the choices they made, or a sentence you want to hear.`;
      log.append(empty);
      return;
    }
    thread.forEach((entry) => {
      const bubble = document.createElement("div");
      bubble.className = `bubble ${entry.role === "user" ? "user" : "them"}`;
      const label = document.createElement("b");
      label.textContent = entry.role === "user" ? "You" : CAST[current].name;
      bubble.append(label, document.createTextNode(entry.content));
      log.append(bubble);
    });
    log.lastElementChild.scrollIntoView({ block: "nearest" });
  }

  function select(id) {
    current = id;
    choices.forEach((choice) => choice.setAttribute("aria-pressed", choice.dataset.character === id ? "true" : "false"));
    setSpeaker(id);
    render();
  }

  choices.forEach((choice) => {
    choice.addEventListener("click", () => select(choice.dataset.character));
  });

  askRoot.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.q;
      input.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    const history = threads[current].slice(-8);
    threads[current].push({ role: "user", content: question });
    input.value = "";
    render();
    form.querySelector("button").disabled = true;
    setStatus(`${CAST[current].name} is thinking`);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: current, question, history }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No answer came back.");
      threads[current].push({ role: "assistant", content: payload.answer });
      render();
      await speakOnce(payload.answer, current);
    } catch (error) {
      threads[current].push({ role: "assistant", content: error.message });
      render();
      setStatus(error.message);
    } finally {
      form.querySelector("button").disabled = false;
    }
  });

  select("lina");
}
