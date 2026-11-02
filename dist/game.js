"use strict";

const $ = (selector) => document.querySelector(selector);
const mapScreen = $("#map-screen");
const gameScreen = $("#game-screen");
const field = $("#field");
const dialog = $("#dialog");
const countdown = $("#countdown");
const result = $("#result");
const pauseModal = $("#pause-modal");

const state = {
  phase: "map",
  time: 80,
  score: 0,
  hearts: 5,
  question: null,
  questionId: 0,
  activeWave: 0,
  tickTimer: null,
  waveTimer: null,
  pausedAt: 0,
  sound: true,
  lastHole: -1,
  combo: 0,
};

const holes = [];
for (let i = 0; i < 9; i += 1) {
  const hole = document.createElement("div");
  hole.className = "hole";
  const capy = document.createElement("button");
  capy.className = "capy-button";
  capy.type = "button";
  capy.dataset.index = String(i);
  capy.setAttribute("aria-label", `第 ${i + 1} 個洞口`);
  capy.innerHTML = `<img src="assets/capy-answer.png" alt="拿著答案牌的卡皮巴拉"><span class="answer-card">56</span>`;
  capy.addEventListener("pointerdown", hitCapy);
  hole.appendChild(capy);
  field.appendChild(hole);
  holes.push(capy);
}

function showScreen(name) {
  mapScreen.classList.toggle("active", name === "map");
  gameScreen.classList.toggle("active", name === "game");
  state.phase = name;
}

function openTutorial() {
  dialog.hidden = false;
}

function buildQuestion() {
  let a;
  let b;
  do {
    a = 2 + Math.floor(Math.random() * 8);
    b = 2 + Math.floor(Math.random() * 8);
  } while (state.question && a === state.question.a && b === state.question.b);
  state.question = { a, b, answer: a * b };
  state.questionId += 1;
  $("#question").textContent = `${a} × ${b} = ?`;
}

function nearbyWrongAnswers(answer, a, b, count) {
  const candidates = [
    a * Math.max(1, b - 1), a * Math.min(9, b + 1),
    Math.max(1, a - 1) * b, Math.min(9, a + 1) * b,
    answer - a, answer + b, answer - 1, answer + 1,
  ].filter((value) => value > 0 && value !== answer);
  const unique = [...new Set(candidates)].sort(() => Math.random() - .5);
  while (unique.length < count) {
    const value = 2 + Math.floor(Math.random() * 79);
    if (value !== answer && !unique.includes(value)) unique.push(value);
  }
  return unique.slice(0, count);
}

function difficulty() {
  if (state.time > 50) return { count: randomInt(2, 3), visible: 1650, gap: 360 };
  if (state.time > 25) return { count: randomInt(3, 4), visible: 1250, gap: 250 };
  return { count: randomInt(4, 5), visible: 900, gap: 160 };
}

function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function chooseHoles(count) {
  const indexes = [...Array(9).keys()];
  if (state.lastHole >= 0) indexes.splice(indexes.indexOf(state.lastHole), 1);
  indexes.sort(() => Math.random() - .5);
  const chosen = indexes.slice(0, count);
  state.lastHole = chosen[0];
  return chosen;
}

function clearWave() {
  clearTimeout(state.waveTimer);
  holes.forEach((capy) => {
    capy.classList.remove("visible", "correct", "wrong", "hit");
    capy.classList.add("retreat");
    capy.disabled = true;
  });
}

function spawnWave() {
  if (state.phase !== "playing") return;
  clearWave();
  const wave = ++state.activeWave;
  const level = difficulty();
  const chosen = chooseHoles(level.count);
  const correctPosition = Math.floor(Math.random() * chosen.length);
  const wrongs = nearbyWrongAnswers(state.question.answer, state.question.a, state.question.b, chosen.length - 1);
  let wrongIndex = 0;

  chosen.forEach((holeIndex, order) => {
    const capy = holes[holeIndex];
    const value = order === correctPosition ? state.question.answer : wrongs[wrongIndex++];
    capy.dataset.value = String(value);
    capy.dataset.correct = String(value === state.question.answer);
    capy.querySelector(".answer-card").textContent = value;
    capy.setAttribute("aria-label", `答案 ${value}`);
    capy.disabled = false;
    capy.classList.remove("retreat", "hit");
    setTimeout(() => {
      if (wave === state.activeWave && state.phase === "playing") capy.classList.add("visible");
    }, order * level.gap);
  });

  state.waveTimer = setTimeout(() => {
    if (wave !== state.activeWave || state.phase !== "playing") return;
    clearWave();
    setTimeout(spawnWave, Math.max(120, level.gap));
  }, level.visible + (chosen.length - 1) * level.gap);
}

function hitCapy(event) {
  if (state.phase !== "playing") return;
  const capy = event.currentTarget;
  if (capy.disabled || !capy.classList.contains("visible")) return;
  capy.blur();
  $(".game-scene").scrollTop = 0;
  capy.disabled = true;
  showHammer(event.clientX, event.clientY);
  capy.classList.add("hit");
  const correct = capy.dataset.correct === "true";
  capy.classList.add(correct ? "correct" : "wrong");

  if (correct) {
    state.score += 1;
    state.combo += 1;
    playTone(660, .09, "sine");
    setTimeout(() => playTone(880, .12, "sine"), 85);
    updateHud();
    showCombo(state.combo > 1 ? `${state.combo} 連續答對！` : "答對了！");
    if (state.score >= 10) {
      setTimeout(() => endGame(true), 480);
      return;
    }
    buildQuestion();
    state.activeWave += 1;
    setTimeout(spawnWave, 520);
  } else {
    state.hearts -= 1;
    state.combo = 0;
    playTone(170, .18, "sawtooth");
    updateHud();
    navigator.vibrate?.(60);
    if (state.hearts <= 0) setTimeout(() => endGame(false), 480);
  }
}

function showHammer(x, y) {
  const img = document.createElement("img");
  img.className = "hammer";
  img.src = "assets/toy-hammer.png";
  img.alt = "";
  img.style.left = `${x}px`;
  img.style.top = `${y}px`;
  document.body.appendChild(img);
  setTimeout(() => img.remove(), 320);
}

function showCombo(text) {
  const el = $("#combo");
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}

function updateHud() {
  $("#timer").textContent = state.time;
  $("#score").textContent = `${state.score}/10`;
  $("#hearts").innerHTML = `${"♥".repeat(state.hearts)}<span class="lost">${"♥".repeat(5 - state.hearts)}</span>`;
  $("#hearts").setAttribute("aria-label", `剩餘 ${state.hearts} 滴血`);
  $(".timer-pill").classList.toggle("danger", state.time <= 20);
}

async function startGame() {
  dialog.hidden = true;
  result.hidden = true;
  pauseModal.hidden = true;
  clearGameTimers();
  state.time = 80;
  state.score = 0;
  state.hearts = 5;
  state.combo = 0;
  state.lastHole = -1;
  state.activeWave += 1;
  buildQuestion();
  updateHud();
  showScreen("game");

  for (const value of [3, 2, 1]) {
    countdown.textContent = value;
    countdown.hidden = false;
    countdown.style.animation = "none";
    void countdown.offsetWidth;
    countdown.style.animation = "count-pop .8s ease both";
    playTone(420 + value * 80, .08, "sine");
    await wait(820);
  }
  countdown.textContent = "開始！";
  countdown.style.fontSize = "min(14vw,150px)";
  await wait(550);
  countdown.hidden = true;
  countdown.style.fontSize = "";
  state.phase = "playing";
  spawnWave();
  state.tickTimer = setInterval(() => {
    if (state.phase !== "playing") return;
    state.time -= 1;
    updateHud();
    if (state.time <= 0) endGame(false);
  }, 1000);
}

function endGame(won) {
  if (!["playing", "paused"].includes(state.phase)) return;
  state.phase = "result";
  clearGameTimers();
  clearWave();
  $("#result-title").textContent = won ? "挑戰成功！" : "再試一次吧！";
  $("#result-message").textContent = won ? "卡皮老師為你的乘法速度感到驕傲！" : (state.hearts <= 0 ? "愛心用完了，回村裡休息一下再挑戰。" : "時間到了，再熟悉幾題就會更快！");
  $("#result-capy").textContent = won ? "🌟" : "🌱";
  $("#result-score").textContent = state.score;
  $("#result-time").textContent = state.time;
  result.hidden = false;
  if (won) {
    const best = Number(localStorage.getItem("capyMathBest") || 0);
    if (state.time > best) localStorage.setItem("capyMathBest", String(state.time));
    playWinJingle();
  }
}

function clearGameTimers() {
  clearInterval(state.tickTimer);
  clearTimeout(state.waveTimer);
  state.tickTimer = null;
  state.waveTimer = null;
}

function pauseGame() {
  if (state.phase !== "playing") return;
  state.phase = "paused";
  state.pausedAt = performance.now();
  clearGameTimers();
  clearWave();
  pauseModal.hidden = false;
}

function resumeGame() {
  if (state.phase !== "paused") return;
  pauseModal.hidden = true;
  state.phase = "playing";
  spawnWave();
  state.tickTimer = setInterval(() => {
    if (state.phase !== "playing") return;
    state.time -= 1;
    updateHud();
    if (state.time <= 0) endGame(false);
  }, 1000);
}

function goHome() {
  clearGameTimers();
  clearWave();
  dialog.hidden = true;
  result.hidden = true;
  pauseModal.hidden = true;
  showScreen("map");
}

let audioContext;
function playTone(frequency, duration, type) {
  if (!state.sound) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.07, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function playWinJingle() {
  [523, 659, 784, 1047].forEach((note, i) => setTimeout(() => playTone(note, .18, "sine"), i * 130));
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

$("#npc").addEventListener("click", openTutorial);
$("#level-gate").addEventListener("click", openTutorial);
$("#start-btn").addEventListener("click", startGame);
$("#retry-btn").addEventListener("click", startGame);
$("#home-btn").addEventListener("click", goHome);
$("#pause-btn").addEventListener("click", pauseGame);
$("#resume-btn").addEventListener("click", resumeGame);
$("#quit-btn").addEventListener("click", goHome);
$("#sound-btn").addEventListener("click", () => {
  state.sound = !state.sound;
  $("#sound-btn").textContent = state.sound ? "🔊" : "🔇";
  $("#sound-btn").setAttribute("aria-label", state.sound ? "關閉音效" : "開啟音效");
  if (state.sound) playTone(660, .08, "sine");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.phase === "playing") pauseGame();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.phase === "playing") pauseGame();
    else if (state.phase === "paused") resumeGame();
  }
});
