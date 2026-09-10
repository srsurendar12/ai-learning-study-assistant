# Mini Project Report

## Title
AI Learning & Study Assistant using RAG, Memory and Tools

## Problem Statement
Students often have study materials in different files and need help understanding topics, planning revision and testing their knowledge. This project provides one web-based assistant for these tasks.

## Objectives
1. Answer student questions using uploaded study materials.
2. Generate quizzes for revision.
3. Create personalized study plans.
4. Remember student preferences and progress.
5. Demonstrate agent-style capabilities using RAG, memory and tools.

## Modules
### 1. RAG Module
Uploaded documents are converted to text, split into chunks and searched using term-based relevance scoring. Relevant chunks are supplied as context to the answer engine.

### 2. Memory Module
The application stores student name, learning preferences, goals, recent questions and quiz scores in a JSON file.

### 3. Quiz Tool
The quiz tool creates multiple-choice questions. With an API key it can use AI generation; otherwise it uses a built-in demo generator.

### 4. Study Plan Tool
The study-plan tool converts topic, number of days and hours per day into a daily revision schedule.

### 5. Web Interface
The frontend provides upload, chat, memory, quiz and study-plan features.

## Expected Result
A student can upload notes, ask questions, generate a quiz, record the score and create a study schedule from one interface.

## Future Scope
- Vector database
- User authentication
- Cloud database
- Voice assistant
- Mobile application
- Advanced learning analytics
