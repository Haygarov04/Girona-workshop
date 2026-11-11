const CAST = {
  lina: { name: "Lina Voss", voice: "eve", role: "Orchard surveyor" },
  bram: { name: "Bram", voice: "leo", role: "Groundskeeper" },
  sera: { name: "Sera Quill", voice: "ara", role: "Night librarian" },
  edwin: { name: "Edwin Voss", voice: "rex", role: "Lina's brother" },
};

const lines = [...document.querySelectorAll("article p[data-voice]")];
const player = document.querySelector(".player");
const portrait = player.querySelector("img");
const face = document.createElement("div");
face.className = "face";
const playerVideo = document.createElement("video");
playerVideo.muted = true;
playerVideo.loop = true;
playerVideo.playsInline = true;
playerVideo.setAttribute("playsinline", "");
portrait.replaceWith(face);
face.append(portrait, playerVideo);
const whoNow = player.querySelector(".who-now");
const statusEl = player.querySelector(".status");
const bar = player.querySelector(".track span");
const playBtn = player.querySelector("[data-action='play']");
const stopBtn = player.querySelector("[data-action='stop']");
const slowBtn = player.querySelector("[data-action='slow']");

const audio = new Audio();
let endVoice = () => {};
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

const stage = document.createElement("aside");
stage.className = "stage";
stage.innerHTML = "<div class=\"stage-frame\"><img alt=\"\"><video muted loop playsinline preload=\"auto\"></video></div><p></p>";
const stageImg = stage.querySelector("img");
const stageVideo = stage.querySelector("video");
stageVideo.muted = true;
const talking = [stageVideo, playerVideo];

function startTalking(video) {
  video.muted = true;
  const go = () => {
    if (document.body.classList.contains("is-reading")) video.play().catch(() => {});
  };
  if (video.readyState >= 2) go();
  else video.addEventListener("canplay", go, { once: true });
}
const stageName = stage.querySelector("p");
const layout = document.querySelector(".layout");
if (layout) layout.prepend(stage);

function setSpeaker(id) {
  const person = CAST[id] || CAST.lina;
  portrait.src = `images/${id}.jpg`;
  portrait.alt = "";
  whoNow.textContent = person.name;
  stageImg.src = `images/${id}.jpg`;
  stageImg.alt = person.name;
  stageName.textContent = person.name;
  const clip = `videos/${id}.mp4?v=2`;
  talking.forEach((video) => {
    if (video.dataset.clip === clip) return;
    video.dataset.clip = clip;
    video.src = clip;
    if (document.body.classList.contains("is-reading")) startTalking(video);
  });
}

function focusLine(line) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = line.getBoundingClientRect().top + window.scrollY - 110;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
}

let followScroll = true;

function setReading(on) {
  document.body.classList.toggle("is-reading", on);
  followScroll = !on;
  talking.forEach((video) => {
    if (on) startTalking(video);
    else {
      video.pause();
      try { video.currentTime = 0; } catch (_) { /* not ready yet */ }
    }
  });
}

if (layout && lines.length) {
  const narratorWatch = new IntersectionObserver((entries) => {
    if (!followScroll) return;
    const visible = entries.filter((entry) => entry.isIntersecting);
    if (!visible.length) return;
    visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    const id = visible[0].target.dataset.voice;
    if (id) setSpeaker(id);
  }, { rootMargin: "-120px 0px -45% 0px", threshold: [0.2, 0.5, 0.8] });
  lines.forEach((line) => narratorWatch.observe(line));
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
  setReading(false);
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
  endVoice();
  if (!lines.length) return;
  const run = ++token;
  paused = false;
  releaseUrls();
  setReading(true);
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
    focusLine(line);
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
  setReading(false);
  setStatus("End of this part.");
  playBtn.textContent = "Play";
  activeIndex = -1;
}

async function speakOnce(text, id) {
  endVoice();
  halt();
  const run = token;
  setSpeaker(id);
  setReading(true);
  setStatus(`${CAST[id].name} is speaking`);
  playBtn.textContent = "Pause";
  try {
    const url = await fetchClip(text, CAST[id].voice);
    if (run !== token) return;
    await playUrl(url, run);
    if (run !== token) return;
    setReading(false);
    setStatus("Ready");
    playBtn.textContent = "Play";
  } catch (error) {
    if (run !== token) return;
    setReading(false);
    setStatus(error.message);
    playBtn.textContent = "Play";
  }
}

playBtn.addEventListener("click", () => {
  if (!audio.paused && !audio.ended && audio.src) {
    audio.pause();
    paused = true;
    talking.forEach((video) => video.pause());
    playBtn.textContent = "Play";
    setStatus("Paused");
    return;
  }
  if (paused && audio.src) {
    paused = false;
    audio.play();
    talking.forEach((video) => startTalking(video));
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

const VOICE_CANON = `You are in a live voice conversation about a finished story, The Orchard of Unspent Hours, set in Low Merrow.
An unspent hour is a decision someone did not finish. In this orchard it grows into a room. Burning or cutting a room seals the hour and makes the person forget. Finishing the act turns the room back into a tree.
Lina Voss, an orchard surveyor, came home after eleven nights because her brother Edwin took their dead mother's pear slips into the west orchard. Bram, the groundskeeper, locked the gate. Sera Quill, the night librarian, says a promise planted in the wrong room becomes the room. In the Room of Tides the slips were under a table set for Mother, Edwin, and Lina. In the Closing Gallery Edwin had held the last door for eleven nights. They planted six slips. The gallery went dark. One young tree kept a seam. Lina left an empty vial. Sera wrote: Finished, not lost. Edwin went home to the bakery.
Speak only as yourself, in first person, in clear spoken English. Never use another language, not even one word. If the visitor speaks another language, understand it and answer only in English. Stay inside this canon. Two to four short sentences. No lists, no stage directions.`;

function downsample(input, inRate, outRate) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
      count += 1;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

function pcm16Base64(samples) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToPcm(payload) {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

function mountTalk() {
  const bar = document.querySelector(".top");
  const dialog = document.createElement("dialog");
  dialog.id = "talk";
  dialog.className = "talk";
  dialog.innerHTML = `
    <div class="talk-head">
      <div>
        <p class="kicker">Voice</p>
        <h2>Talk with them</h2>
      </div>
      <button type="button" data-close>Close</button>
    </div>
    <p class="note">Choose a person and speak. They answer in their own voice, in English. You can interrupt them.</p>
    <div class="talk-people"></div>
    <div class="call-row">
      <button type="button" class="solid" data-call>Start voice</button>
      <p class="call-status" aria-live="polite"></p>
    </div>
    <div class="log" aria-live="polite"></div>
    <form class="ask-form">
      <label class="note" for="question">Or type</label>
      <input id="question" name="question" maxlength="600" placeholder="Ask in English" autocomplete="off">
      <button class="solid" type="submit">Ask</button>
    </form>
  `;
  const people = dialog.querySelector(".talk-people");
  Object.entries(CAST).forEach(([id, person]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.character = id;
    button.innerHTML = `<img src="images/${id}.jpg" alt=""><strong>${person.name}</strong>`;
    people.append(button);
  });
  document.body.append(dialog);

  const open = document.createElement("button");
  open.type = "button";
  open.className = "talk-open";
  open.textContent = "Talk";
  open.setAttribute("aria-haspopup", "dialog");
  if (bar) bar.append(open);

  const threads = { lina: [], bram: [], sera: [], edwin: [] };
  let current = document.body.dataset.narrator || "lina";
  const log = dialog.querySelector(".log");
  const form = dialog.querySelector("form");
  const input = form.querySelector("input");
  const choices = [...dialog.querySelectorAll("[data-character]")];
  const callBtn = dialog.querySelector("[data-call]");
  const callStatus = dialog.querySelector(".call-status");

  let generation = 0;
  let live = null;

  function render() {
    log.replaceChildren();
    const thread = threads[current];
    if (!thread.length) {
      const empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = live
        ? `${CAST[current].name} can hear you. Speak in English.`
        : `Start the voice line, then speak with ${CAST[current].name}.`;
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
    log.scrollTop = log.scrollHeight;
  }

  function putLine(role, id, text) {
    const thread = threads[current];
    const found = thread.find((entry) => entry.id === id);
    if (found) found.content = text;
    else thread.push({ role, id, content: text });
    render();
  }

  function paintCall() {
    const person = CAST[current];
    callBtn.textContent = live ? "Hang up" : `Speak with ${person.name.split(" ")[0]}`;
    callBtn.classList.toggle("live", Boolean(live));
    callBtn.setAttribute("aria-pressed", live ? "true" : "false");
  }

  function select(id) {
    const same = id === current;
    current = id;
    choices.forEach((choice) => choice.setAttribute("aria-pressed", choice.dataset.character === id ? "true" : "false"));
    setSpeaker(id);
    paintCall();
    render();
    if (live && !same) startCall(id);
  }

  function stopLive(run) {
    const session = live;
    if (!session || (run && session.run !== run)) return;
    live = null;
    session.sendMic = false;
    session.sources.forEach((source) => {
      try { source.stop(); } catch (_) { /* already ended */ }
    });
    try { session.processor.disconnect(); } catch (_) { /* not started */ }
    try { session.micSource.disconnect(); } catch (_) { /* not started */ }
    session.stream?.getTracks().forEach((track) => track.stop());
    try { session.socket.close(); } catch (_) { /* already closed */ }
    session.context?.close().catch(() => {});
    setReading(false);
    paintCall();
  }

  function enqueue(session, samples) {
    if (!samples.length || session.run !== generation) return;
    const buffer = session.context.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);
    const source = session.context.createBufferSource();
    source.buffer = buffer;
    source.connect(session.context.destination);
    const now = session.context.currentTime;
    if (session.playAt < now) session.playAt = now;
    source.start(session.playAt);
    session.playAt += buffer.duration;
    session.sources.push(source);
    setSpeaker(session.character);
    setReading(true);
    source.onended = () => {
      if (session.run === generation && session.context.currentTime >= session.playAt - 0.08) setReading(false);
    };
  }

  function flushAudio(session) {
    session.sources.forEach((source) => {
      try { source.stop(); } catch (_) { /* already ended */ }
    });
    session.sources = [];
    session.playAt = 0;
    setReading(false);
  }

  function onVoiceEvent(session, event) {
    if (session.run !== generation) return;
    const type = event.type;
    if (type === "error") {
      callStatus.textContent = event.error?.message || "The voice line failed.";
      return;
    }
    if (type === "session.updated" && !session.greeted) {
      session.greeted = true;
      session.socket.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "I just sat down with you. Greet me in one short English sentence and invite one question about the orchard." }],
        },
      }));
      session.socket.send(JSON.stringify({ type: "response.create" }));
      callStatus.textContent = `${CAST[session.character].name} is on the line.`;
      return;
    }
    if (type === "input_audio_buffer.speech_started") {
      flushAudio(session);
      callStatus.textContent = "Listening.";
      return;
    }
    if (type === "response.created") {
      session.answerId = event.response?.id || `answer-${Date.now()}`;
      session.answer = "";
      callStatus.textContent = `${CAST[session.character].name} is speaking.`;
      return;
    }
    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      if (event.delta) enqueue(session, base64ToPcm(event.delta));
      return;
    }
    if (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") {
      session.answer += event.delta || "";
      putLine("assistant", session.answerId, session.answer);
      return;
    }
    if (type === "response.output_audio_transcript.done" || type === "response.audio_transcript.done") {
      const text = event.transcript || session.answer;
      if (text) putLine("assistant", session.answerId, text);
      return;
    }
    if (type === "response.done") {
      if (session.sendMic) return;
      const arm = () => {
        if (session.run !== generation) return;
        if (session.context.currentTime + 0.15 < session.playAt) {
          setTimeout(arm, 120);
          return;
        }
        session.sendMic = true;
        callStatus.textContent = "Listening. Speak in English.";
      };
      arm();
      return;
    }
    if (type === "conversation.item.input_audio_transcription.updated" || type === "conversation.item.input_audio_transcription.completed") {
      const text = event.transcript || event.text || "";
      if (!text) return;
      putLine("user", event.item_id || "you-latest", text);
    }
  }

  async function startCall(id) {
    const run = ++generation;
    stopLive();
    generation = run;
    halt();
    current = id;
    choices.forEach((choice) => choice.setAttribute("aria-pressed", choice.dataset.character === id ? "true" : "false"));
    setSpeaker(id);
    callBtn.disabled = true;
    callStatus.textContent = `Opening a line to ${CAST[id].name}…`;
    paintCall();
    try {
      const context = new AudioContext();
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      if (run !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        context.close();
        return;
      }
      const tokenResponse = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: id }),
      });
      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenPayload.error || "The voice line did not open.");
      if (run !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        context.close();
        return;
      }
      const socket = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [`xai-client-secret.${tokenPayload.token}`]);
      const session = {
        run,
        character: id,
        socket,
        context,
        stream,
        processor: null,
        micSource: null,
        sources: [],
        playAt: 0,
        sendMic: false,
        greeted: false,
        answerId: "",
        answer: "",
      };
      live = session;
      paintCall();
      const micSource = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sink = context.createGain();
      sink.gain.value = 0;
      micSource.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);
      session.micSource = micSource;
      session.processor = processor;
      processor.onaudioprocess = (event) => {
        if (!session.sendMic || socket.readyState !== WebSocket.OPEN) return;
        const down = downsample(event.inputBuffer.getChannelData(0), context.sampleRate, 24000);
        if (!down.length) return;
        socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcm16Base64(down) }));
      };
      socket.addEventListener("open", () => {
        if (session.run !== generation) return;
        const person = CAST[id];
        socket.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: person.voice,
            instructions: `You are ${person.name}, ${person.role}. ${VOICE_CANON}`,
            reasoning: { effort: "none" },
            turn_detection: { type: "server_vad" },
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: {
                  model: "grok-transcribe",
                  language_hint: "en",
                  keyterms: ["Lina", "Bram", "Sera", "Edwin", "Low Merrow", "orchard"],
                },
              },
              output: {
                format: { type: "audio/pcm", rate: 24000 },
                speed: slow ? 0.84 : 1,
              },
            },
          },
        }));
      });
      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;
        try {
          onVoiceEvent(session, JSON.parse(message.data));
        } catch (_) {
          /* ignore a bad frame */
        }
      });
      socket.addEventListener("error", () => {
        if (session.run !== generation) return;
        callStatus.textContent = "The voice line dropped.";
      });
      socket.addEventListener("close", () => {
        if (session.run !== generation) return;
        stopLive(session.run);
        callStatus.textContent = "Hung up.";
      });
    } catch (error) {
      if (run !== generation) return;
      stopLive(run);
      const denied = error && error.name === "NotAllowedError";
      callStatus.textContent = denied
        ? "The microphone is blocked. Allow it, or type a question."
        : error.message;
    } finally {
      callBtn.disabled = false;
      paintCall();
    }
  }

  endVoice = () => {
    if (!live) return;
    generation += 1;
    stopLive();
    callStatus.textContent = "Hung up.";
  };

  function show() {
    if (!dialog.open) dialog.showModal();
  }

  open.addEventListener("click", show);
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => endVoice());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.querySelectorAll('a[href="#talk"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show();
    });
  });
  choices.forEach((choice) => {
    choice.addEventListener("click", () => select(choice.dataset.character));
  });
  callBtn.addEventListener("click", () => {
    if (live) endVoice();
    else startCall(current);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    if (live && live.socket.readyState === WebSocket.OPEN) {
      putLine("user", `typed-${Date.now()}`, question);
      live.socket.send(JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: question }] },
      }));
      live.socket.send(JSON.stringify({ type: "response.create" }));
      callStatus.textContent = `${CAST[current].name} is speaking.`;
      return;
    }
    const history = threads[current].slice(-8);
    threads[current].push({ role: "user", id: `typed-${Date.now()}`, content: question });
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
      threads[current].push({ role: "assistant", id: `typed-answer-${Date.now()}`, content: payload.answer });
      render();
      await speakOnce(payload.answer, current);
    } catch (error) {
      threads[current].push({ role: "assistant", id: `typed-error-${Date.now()}`, content: error.message });
      render();
      setStatus(error.message);
    } finally {
      form.querySelector("button").disabled = false;
    }
  });

  select(current);
}

mountTalk();
