# 🎓 AI Learning & Study Assistant

A student-focused AI assistant that combines **RAG (Retrieval-Augmented Generation)**, **Memory**, and **Tools**.

## Features

- 📚 Upload TXT/MD/PDF study material
- 🔎 RAG-style retrieval from uploaded notes
- 🤖 AI question answering when an OpenAI API key is configured
- 🧠 Student memory for name, preferences, goals, topics and quiz scores
- 📝 Quiz generator
- 📅 Personalized study-plan generator
- 📊 Quiz score tracking
- 🧪 Demo mode works without an API key using a local fallback response engine
- 💻 Simple responsive web interface

## Tech Stack

- Node.js
- Express.js
- HTML, CSS, JavaScript
- Multer for uploads
- pdf-parse for PDF text extraction
- JSON files for lightweight persistence
- Optional OpenAI Responses API for AI generation

## Project Structure

```text
ai-learning-study-assistant/
├── data/
│   ├── documents.json
│   ├── memory.json
│   └── sample_notes.txt
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── uploads/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Run Locally

1. Install Node.js.
2. Open this folder in VS Code.
3. Open a terminal.
4. Run:

```bash
npm install
npm start
```

5. Open:

```text
http://localhost:3000
```

### Optional real AI mode

Copy `.env.example` to `.env` and add your API key:

```text
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

**Never upload `.env` or an API key to GitHub.**

## Demo Flow

1. Upload `data/sample_notes.txt`.
2. Ask: **"What is the difference between stack and queue?"**
3. Set your name and study preferences.
4. Generate a quiz for **Data Structures**.
5. Submit the quiz and see the score.
6. Generate a study plan for an upcoming exam.
7. Show the Memory panel and explain that the assistant stores preferences and progress.

## Architecture

```text
Student
   |
   v
Web UI
   |
   v
Express Server
   |
   +---- RAG Retriever ----> Uploaded Documents
   |
   +---- Memory -----------> memory.json
   |
   +---- Tools ------------> Quiz / Study Plan / Progress
   |
   +---- AI Generator -----> OpenAI (optional)
   |
   v
Answer
```

## RAG Explanation

The project splits uploaded study text into small chunks and retrieves the chunks that best match the student's question using keyword/term scoring. The retrieved context is then supplied to the AI generator when an API key is available. Without a key, the same retrieved context is used by the local demo answer engine.

## Project Title for Submission

**AI Learning & Study Assistant using RAG, Memory and Tools**

## Future Enhancements

- Vector database such as Chroma/Pinecone
- Authentication
- Cloud database
- More file formats
- Voice input/output
- Advanced analytics dashboard
