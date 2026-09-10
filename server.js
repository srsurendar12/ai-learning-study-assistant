require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DOCS_FILE = path.join(DATA_DIR, "documents.json");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

function chunkText(text, size = 900) {
  const words = cleanText(text).split(/\s+/);
  const chunks = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > size && current) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function tokenize(text) {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2);
}

function retrieve(query, documents, limit = 4) {
  const q = tokenize(query);
  const qSet = new Set(q);

  const scored = [];
  for (const doc of documents) {
    for (const chunk of doc.chunks || []) {
      const words = tokenize(chunk);
      let score = 0;
      for (const word of words) {
        if (qSet.has(word)) score += 1;
      }
      const phraseBonus = cleanText(chunk).toLowerCase().includes(cleanText(query).toLowerCase()) ? 5 : 0;
      scored.push({ chunk, source: doc.name, score: score + phraseBonus });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .filter(x => x.score > 0)
    .slice(0, limit);
}

function fallbackAnswer(question, context, memory) {
  if (!context.length) {
    return `I could not find relevant information in the uploaded study materials. Try uploading notes related to "${question}".`;
  }

  const joined = context.map(c => c.chunk).join(" ");
  const qWords = tokenize(question);
  const sentences = joined.split(/(?<=[.!?])\s+/);
  const useful = sentences
    .filter(s => qWords.some(w => tokenize(s).includes(w)))
    .slice(0, 4);

  const answer = useful.length ? useful.join(" ") : context[0].chunk;
  const name = memory.studentName ? `, ${memory.studentName}` : "";
  return `Based on your study material${name}: ${answer}`;
}

async function callOpenAI(question, context, memory) {
  if (!process.env.OPENAI_API_KEY) return null;

  const contextText = context.length
    ? context.map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.chunk}`).join("\n\n")
    : "No relevant document context was found.";

  const memoryText = JSON.stringify(memory);

  const body = {
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text:
            "You are an AI Learning & Study Assistant. Answer clearly for a college student. " +
            "Prefer the supplied study material. If the material does not contain the answer, say so. " +
            "Do not invent citations. Give concise explanations with examples when useful.\n\n" +
            "Student memory:\n" + memoryText + "\n\nRetrieved study context:\n" + contextText
        }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: question }]
      }
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data.output_text) return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim() || null;
}

async function generateQuiz(topic, difficulty, count, documents) {
  const context = retrieve(topic, documents, 6);
  if (process.env.OPENAI_API_KEY) {
    const contextText = context.map(c => c.chunk).join("\n\n");
    const prompt = `Create ${count} multiple-choice questions about "${topic}" at ${difficulty} difficulty.
Use the study material below. Return ONLY valid JSON in this exact shape:
{"questions":[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}
Study material:
${contextText}`;

    const body = {
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: prompt
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error("AI quiz generation failed.");
    const data = await response.json();
    const raw = data.output_text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.questions?.length) return parsed.questions.slice(0, count);
      } catch {}
    }
  }

  return makeFallbackQuiz(topic, context, count);
}

function makeFallbackQuiz(topic, context, count) {
  const source = context.length ? context.map(c => c.chunk).join(" ") : "";
  const lower = source.toLowerCase();
  const questions = [];

  if (lower.includes("stack")) {
    questions.push({
      question: "Which principle does a stack follow?",
      options: ["FIFO", "LIFO", "Random access", "Priority order"],
      answer: 1,
      explanation: "A stack follows Last In, First Out (LIFO)."
    });
  }
  if (lower.includes("queue")) {
    questions.push({
      question: "Which principle does a queue follow?",
      options: ["LIFO", "FIFO", "Binary search", "Divide and conquer"],
      answer: 1,
      explanation: "A queue follows First In, First Out (FIFO)."
    });
  }
  if (lower.includes("array")) {
    questions.push({
      question: "What is the typical time complexity of array access by index?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
      answer: 0,
      explanation: "Direct index access is typically O(1)."
    });
  }
  if (lower.includes("big-o")) {
    questions.push({
      question: "What does Big-O notation describe?",
      options: [
        "A programming language",
        "How resource usage grows with input size",
        "A database table",
        "A network protocol"
      ],
      answer: 1,
      explanation: "Big-O describes asymptotic growth of time or space requirements."
    });
  }

  while (questions.length < count) {
    questions.push({
      question: `Which statement is most appropriate when studying ${topic}?`,
      options: [
        "Understand the concept and practice examples",
        "Memorize without understanding",
        "Skip all exercises",
        "Avoid reviewing mistakes"
      ],
      answer: 0,
      explanation: "Understanding concepts and practicing examples improves learning."
    });
  }

  return questions.slice(0, count);
}

function makeStudyPlan(topic, days, hoursPerDay, examDate) {
  const d = Math.max(1, Number(days) || 5);
  const h = Math.max(1, Number(hoursPerDay) || 2);
  const plan = [];

  const phases = [
    ["Learn fundamentals", "Read core concepts and make short notes."],
    ["Practice", "Solve examples and short exercises."],
    ["Active recall", "Create flashcards and explain concepts without notes."],
    ["Quiz & review", "Take a self-test and review mistakes."],
    ["Final revision", "Revise weak areas and summarize the topic."]
  ];

  for (let i = 0; i < d; i++) {
    const phase = phases[i % phases.length];
    plan.push({
      day: i + 1,
      focus: phase[0],
      task: phase[1],
      hours: h
    });
  }

  return {
    topic,
    days: d,
    hoursPerDay: h,
    examDate: examDate || null,
    totalHours: d * h,
    plan
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/status", (_req, res) => {
  const docs = readJson(DOCS_FILE, []);
  res.json({
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    documents: docs.map(d => ({ name: d.name, chunks: d.chunks?.length || 0 })),
    project: "AI Learning & Study Assistant"
  });
});

app.get("/api/memory", (_req, res) => {
  res.json(readJson(MEMORY_FILE, {
    studentName: "", preferences: [], goals: [], recentTopics: [], quizScores: []
  }));
});

app.post("/api/memory", (req, res) => {
  const old = readJson(MEMORY_FILE, {});
  const updated = {
    ...old,
    ...req.body,
    preferences: Array.isArray(req.body.preferences) ? req.body.preferences : (old.preferences || []),
    goals: Array.isArray(req.body.goals) ? req.body.goals : (old.goals || []),
    recentTopics: old.recentTopics || [],
    quizScores: old.quizScores || []
  };
  writeJson(MEMORY_FILE, updated);
  res.json(updated);
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please select a file." });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = "";

    if (ext === ".txt" || ext === ".md") {
      text = fs.readFileSync(req.file.path, "utf8");
    } else if (ext === ".pdf") {
      const pdf = require("pdf-parse");
      const data = await pdf(fs.readFileSync(req.file.path));
      text = data.text;
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Only TXT, MD and PDF files are supported." });
    }

    const documents = readJson(DOCS_FILE, []);
    const document = {
      id: Date.now().toString(),
      name: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      chunks: chunkText(text)
    };
    documents.push(document);
    writeJson(DOCS_FILE, documents);

    res.json({
      message: "Study material uploaded successfully.",
      name: document.name,
      chunks: document.chunks.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not process the uploaded file." });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Enter a question." });

    const documents = readJson(DOCS_FILE, []);
    const memory = readJson(MEMORY_FILE, {});
    const context = retrieve(question, documents, 4);

    let answer;
    try {
      answer = await callOpenAI(question, context, memory);
    } catch (error) {
      console.error(error.message);
      answer = null;
    }

    if (!answer) answer = fallbackAnswer(question, context, memory);

    const updatedMemory = {
      ...memory,
      recentTopics: [question, ...(memory.recentTopics || [])].slice(0, 8)
    };
    writeJson(MEMORY_FILE, updatedMemory);

    res.json({
      answer,
      sources: context.map(c => c.source),
      mode: process.env.OPENAI_API_KEY ? "AI + RAG" : "Demo RAG"
    });
  } catch (error) {
    res.status(500).json({ error: "Could not answer the question." });
  }
});

app.post("/api/quiz", async (req, res) => {
  try {
    const topic = String(req.body.topic || "Data Structures");
    const difficulty = String(req.body.difficulty || "medium");
    const count = Math.min(10, Math.max(3, Number(req.body.count) || 5));
    const documents = readJson(DOCS_FILE, []);
    const questions = await generateQuiz(topic, difficulty, count, documents);
    res.json({ topic, questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not generate quiz." });
  }
});

app.post("/api/quiz/score", (req, res) => {
  const memory = readJson(MEMORY_FILE, {});
  const score = Number(req.body.score) || 0;
  const total = Number(req.body.total) || 0;

  memory.quizScores = [
    {
      topic: req.body.topic || "General",
      score,
      total,
      percentage: total ? Math.round((score / total) * 100) : 0,
      date: new Date().toISOString()
    },
    ...(memory.quizScores || [])
  ].slice(0, 10);

  writeJson(MEMORY_FILE, memory);
  res.json(memory.quizScores[0]);
});

app.post("/api/study-plan", (req, res) => {
  const plan = makeStudyPlan(
    req.body.topic || "Data Structures",
    req.body.days || 5,
    req.body.hoursPerDay || 2,
    req.body.examDate || ""
  );
  res.json(plan);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AI Learning & Study Assistant running at http://localhost:${PORT}`);
});
