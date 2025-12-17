// Simple storage helpers
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// State
let sessions = load("sessions", []);
let mcqs = load("mcqs", []);
let syllabus = load("syllabus", []);
let notes = load("notes", []);
let currentTimer = null;
let currentTaskId = null;

// Tab switching
document.querySelectorAll(".tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// --- Planner & Timer ---

function renderSessions() {
  const list = document.getElementById("sessions-list");
  list.innerHTML = "";
  const todayList = document.getElementById("today-sessions");
  todayList.innerHTML = "";

  const today = new Date().toISOString().slice(0, 10);

  sessions
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .forEach((s, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${s.subject}</strong> – ${s.topic || ""}<br>
        ${s.date} ${s.start} • ${s.duration} min
        <span class="badge">${s.status || "pending"}</span>
        <button data-idx="${idx}" class="start-focus-btn">Focus</button>
      `;
      list.appendChild(li);

      if (s.date === today) {
        const ti = document.createElement("li");
        ti.textContent = `${s.start} • ${s.subject} – ${s.topic || ""}`;
        todayList.appendChild(ti);
      }
    });

  document.querySelectorAll(".start-focus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      currentTaskId = idx;
      document.getElementById("current-task-name").textContent =
        `Focusing: ${sessions[idx].subject} – ${sessions[idx].topic || ""}`;
    });
  });

  updateFocusStats();
}

document.getElementById("add-session").addEventListener("click", () => {
  const subject = document.getElementById("session-subject").value.trim();
  const topic = document.getElementById("session-topic").value.trim();
  const date = document.getElementById("session-date").value;
  const start = document.getElementById("session-start").value;
  const duration = parseInt(document.getElementById("session-duration").value, 10) || 0;

  if (!subject || !date || !start || !duration) return;

  sessions.push({ subject, topic, date, start, duration, status: "pending", minutesFocused: 0 });
  save("sessions", sessions);
  renderSessions();
});

// Timer
let timerInterval = null;
let secondsLeft = 0;
let isBreak = false;
let focusMinutes = 0;
let breakMinutes = 0;

function updateTimerDisplay() {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  document.getElementById("timer-display").textContent = `${m}:${s}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  secondsLeft = 0;
  updateTimerDisplay();
  document.getElementById("current-task-name").textContent = "No task selected.";
}

document.getElementById("start-timer").addEventListener("click", () => {
  if (timerInterval) return;

  focusMinutes = parseInt(document.getElementById("focus-minutes").value, 10) || 50;
  breakMinutes = parseInt(document.getElementById("break-minutes").value, 10) || 10;

  isBreak = false;
  secondsLeft = focusMinutes * 60;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay();

    if (secondsLeft <= 0) {
      if (!isBreak) {
        // focus session ended
        if (currentTaskId != null && sessions[currentTaskId]) {
          sessions[currentTaskId].minutesFocused =
            (sessions[currentTaskId].minutesFocused || 0) + focusMinutes;
          sessions[currentTaskId].status = "done";
          save("sessions", sessions);
          renderSessions();
        }
        isBreak = true;
        secondsLeft = breakMinutes * 60;
        document.getElementById("current-task-name").textContent = "Break time!";
      } else {
        stopTimer();
      }
    }
  }, 1000);
});

document.getElementById("stop-timer").addEventListener("click", stopTimer);

// --- MCQ / Quiz ---

function renderQuizSummary(score, total) {
  const area = document.getElementById("quiz-area");
  area.innerHTML = `<p>You scored ${score} / ${total}.</p>`;
}

document.getElementById("add-mcq").addEventListener("click", () => {
  const q = document.getElementById("mcq-question").value.trim();
  const a = document.getElementById("mcq-option-a").value.trim();
  const b = document.getElementById("mcq-option-b").value.trim();
  const c = document.getElementById("mcq-option-c").value.trim();
  const d = document.getElementById("mcq-option-d").value.trim();
  const ans = document.getElementById("mcq-answer").value.trim().toUpperCase();
  const subj = document.getElementById("mcq-subject").value.trim();
  const expl = document.getElementById("mcq-explanation").value.trim();

  if (!q || !a || !b || !c || !d || !["A","B","C","D"].includes(ans)) return;

  mcqs.push({ q, options: { A: a, B: b, C: c, D: d }, ans, subj, expl });
  save("mcqs", mcqs);

  document.getElementById("mcq-question").value = "";
  document.getElementById("mcq-option-a").value = "";
  document.getElementById("mcq-option-b").value = "";
  document.getElementById("mcq-option-c").value = "";
  document.getElementById("mcq-option-d").value = "";
  document.getElementById("mcq-answer").value = "";
  document.getElementById("mcq-subject").value = "";
  document.getElementById("mcq-explanation").value = "";
});

document.getElementById("start-quiz").addEventListener("click", () => {
  const area = document.getElementById("quiz-area");
  if (mcqs.length === 0) {
    area.innerHTML = "<p>No MCQs yet. Add some first.</p>";
    return;
  }
  const shuffled = [...mcqs].sort(() => Math.random() - 0.5).slice(0, 10);
  let idx = 0;
  let score = 0;

  function showQuestion() {
    if (idx >= shuffled.length) {
      renderQuizSummary(score, shuffled.length);
      return;
    }
    const q = shuffled[idx];
    area.innerHTML = `
      <p><strong>Q${idx + 1}.</strong> ${q.q}</p>
      <button data-choice="A">A. ${q.options.A}</button><br>
      <button data-choice="B">B. ${q.options.B}</button><br>
      <button data-choice="C">C. ${q.options.C}</button><br>
      <button data-choice="D">D. ${q.options.D}</button><br>
      <p><em>Subject: ${q.subj || "NA"}</em></p>
    `;
    area.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.dataset.choice;
        if (choice === q.ans) score++;
        area.innerHTML += `<p>Correct answer: ${q.ans}. ${q.expl || ""}</p>`;
        idx++;
        setTimeout(showQuestion, 1000);
      });
    });
  }

  showQuestion();
});

// --- Syllabus & Checklist ---

function renderSyllabus() {
  const list = document.getElementById("syllabus-list");
  list.innerHTML = "";
  syllabus.forEach((t, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${t.paper}</strong>: ${t.topic}
      <span class="badge">${t.status}</span>
      <button data-idx="${idx}" class="advance-status">Next</button>
    `;
    list.appendChild(li);
  });

  document.querySelectorAll(".advance-status").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const statuses = ["Not started","In progress","Completed","Revised x1","Revised x2","Revised x3+"];
      const currentIndex = statuses.indexOf(syllabus[idx].status);
      syllabus[idx].status = statuses[(currentIndex + 1) % statuses.length];
      save("syllabus", syllabus);
      renderSyllabus();
      updateSyllabusProgress();
    });
  });

  updateSyllabusProgress();
}

document.getElementById("add-syllabus").addEventListener("click", () => {
  const paper = document.getElementById("syllabus-paper").value;
  const topic = document.getElementById("syllabus-topic").value.trim();
  if (!topic) return;
  syllabus.push({ paper, topic, status: "Not started" });
  save("syllabus", syllabus);
  document.getElementById("syllabus-topic").value = "";
  renderSyllabus();
});

// --- Notes ---

function renderNotes(filter = "") {
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  const query = filter.toLowerCase();
  notes
    .filter(n => !query || n.title.toLowerCase().includes(query) || n.tag.toLowerCase().includes(query) || n.body.toLowerCase().includes(query))
    .forEach(n => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${n.title}</strong> <span class="badge">${n.tag}</span><br>${n.body}`;
      list.appendChild(li);
    });
}

document.getElementById("add-note").addEventListener("click", () => {
  const title = document.getElementById("note-title").value.trim();
  const tag = document.getElementById("note-tag").value.trim();
  const body = document.getElementById("note-body").value.trim();
  if (!title || !body) return;
  notes.push({ title, tag, body, createdAt: new Date().toISOString() });
  save("notes", notes);
  document.getElementById("note-title").value = "";
  document.getElementById("note-tag").value = "";
  document.getElementById("note-body").value = "";
  renderNotes();
});

document.getElementById("note-search").addEventListener("input", e => {
  renderNotes(e.target.value);
});

// --- Dashboard progress calculations ---

function updateSyllabusProgress() {
  const prelimsTopics = syllabus.filter(s => s.paper.startsWith("Prelims"));
  const mainsTopics = syllabus.filter(s => s.paper.startsWith("Mains"));
  const optionalTopics = syllabus.filter(s => s.paper === "Optional");

  function calcPercent(list) {
    if (list.length === 0) return 0;
    const done = list.filter(s => ["Completed","Revised x1","Revised x2","Revised x3+"].includes(s.status)).length;
    return Math.round((done / list.length) * 100);
  }

  document.getElementById("prelims-progress").textContent = `${calcPercent(prelimsTopics)}% complete`;
  document.getElementById("mains-progress").textContent = `${calcPercent(mainsTopics)}% complete`;
  document.getElementById("optional-progress").textContent = `${calcPercent(optionalTopics)}% complete`;
}

function updateFocusStats() {
  const today = new Date().toISOString().slice(0, 10);
  const todaysSessions = sessions.filter(s => s.date === today);
  const totalMinutes = todaysSessions.reduce((sum, s) => sum + (s.minutesFocused || 0), 0);
  document.getElementById("today-focus").textContent = `${totalMinutes} min`;
}

// --- Init ---

renderSessions();
renderSyllabus();
renderNotes();

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
