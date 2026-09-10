const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadAll() {
  try {
    const status = await api("/api/status");
    $("status").textContent = status.aiEnabled ? "🟢 AI + RAG enabled" : "🟡 Demo RAG mode";
    $("documents").innerHTML = status.documents.length
      ? status.documents.map(d => `<div class="doc">📄 <b>${escapeHtml(d.name)}</b> — ${d.chunks} chunks</div>`).join("")
      : `<p class="muted">No material uploaded yet. Try data/sample_notes.txt.</p>`;

    const memory = await api("/api/memory");
    $("studentName").value = memory.studentName || "";
    $("preference").value = memory.preferences?.[0] || "";
    $("goal").value = memory.goals?.[0] || "";
    renderProgress(memory);
  } catch (e) {
    $("status").textContent = "🔴 Server error";
  }
}

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("fileInput").files[0];
  if (!file) return;

  const form = new FormData();
  form.append("file", file);

  try {
    const data = await api("/api/upload", { method: "POST", body: form });
    $("uploadMessage").textContent = `✅ ${data.message} (${data.chunks} chunks)`;
    $("fileInput").value = "";
    loadAll();
  } catch (e) {
    $("uploadMessage").textContent = `❌ ${e.message}`;
  }
});

$("memoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: $("studentName").value,
        preferences: $("preference").value ? [$("preference").value] : [],
        goals: $("goal").value ? [$("goal").value] : []
      })
    });
    $("memoryMessage").textContent = "✅ Memory saved.";
    loadAll();
  } catch (e) {
    $("memoryMessage").textContent = `❌ ${e.message}`;
  }
});

$("askBtn").addEventListener("click", askQuestion);
$("question").addEventListener("keydown", e => {
  if (e.key === "Enter") askQuestion();
});

async function askQuestion() {
  const question = $("question").value.trim();
  if (!question) return;

  $("answer").classList.remove("hidden");
  $("answer").textContent = "Thinking...";

  try {
    const data = await api("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    $("answer").innerHTML =
      `<b>${data.mode}</b><br><br>${escapeHtml(data.answer).replace(/\n/g, "<br>")}` +
      (data.sources.length ? `<br><br><small>Sources: ${data.sources.map(escapeHtml).join(", ")}</small>` : "");
    loadAll();
  } catch (e) {
    $("answer").textContent = `❌ ${e.message}`;
  }
}

$("quizBtn").addEventListener("click", async () => {
  $("quizArea").innerHTML = "Generating quiz...";
  try {
    const data = await api("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: $("quizTopic").value,
        difficulty: $("quizDifficulty").value,
        count: Number($("quizCount").value)
      })
    });

    $("quizArea").innerHTML = `
      <form id="quizForm">
        ${data.questions.map((q, i) => `
          <div class="quiz-question">
            <b>${i + 1}. ${escapeHtml(q.question)}</b>
            ${q.options.map((o, j) => `
              <label>
                <input type="radio" name="q${i}" value="${j}" required />
                ${escapeHtml(o)}
              </label>
            `).join("")}
          </div>
        `).join("")}
        <button type="submit">Submit Quiz</button>
      </form>
    `;

    $("quizForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      let score = 0;

      data.questions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`);
        if (selected && Number(selected.value) === q.answer) score++;
      });

      const percentage = Math.round((score / data.questions.length) * 100);
      $("quizArea").insertAdjacentHTML(
        "afterbegin",
        `<div class="score">🎉 Score: ${score}/${data.questions.length} (${percentage}%)</div>`
      );

      await api("/api/quiz/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: data.topic,
          score,
          total: data.questions.length
        })
      });

      loadAll();
    });
  } catch (e) {
    $("quizArea").innerHTML = `❌ ${e.message}`;
  }
});

$("planBtn").addEventListener("click", async () => {
  $("planArea").innerHTML = "Creating plan...";
  try {
    const data = await api("/api/study-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: $("planTopic").value,
        days: Number($("planDays").value),
        hoursPerDay: Number($("planHours").value),
        examDate: $("examDate").value
      })
    });

    $("planArea").innerHTML = `
      <p><b>${escapeHtml(data.topic)}</b> • ${data.totalHours} total hours</p>
      ${data.plan.map(day => `
        <div class="plan-day">
          <b>Day ${day.day}: ${escapeHtml(day.focus)}</b><br>
          ${escapeHtml(day.task)}<br>
          <small>${day.hours} hour(s)</small>
        </div>
      `).join("")}
    `;
  } catch (e) {
    $("planArea").innerHTML = `❌ ${e.message}`;
  }
});

function renderProgress(memory) {
  const scores = memory.quizScores || [];
  $("progress").innerHTML = `
    <p><b>Student:</b> ${escapeHtml(memory.studentName || "Not set")}</p>
    <p><b>Goal:</b> ${escapeHtml(memory.goals?.[0] || "Not set")}</p>
    <p><b>Preference:</b> ${escapeHtml(memory.preferences?.[0] || "Not set")}</p>
    <p><b>Recent questions:</b> ${memory.recentTopics?.length || 0}</p>
    ${
      scores.length
        ? `<h3>Recent Quiz Scores</h3>` +
          scores.map(s => `<div class="doc">📝 ${escapeHtml(s.topic)} — ${s.score}/${s.total} (${s.percentage}%)</div>`).join("")
        : `<p class="muted">No quiz scores yet.</p>`
    }
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadAll();
