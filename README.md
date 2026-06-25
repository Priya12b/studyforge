# StudyForge AI Planner 🚀

StudyForge is a full-stack, three-tier educational productivity ecosystem. It combines a Python multi-agent AI service, a secure Node.js/Express backend, and a highly interactive React frontend to help students orchestrate study roadmaps, generate quizzes from notes, track attendance, manage tasks, run collaborative study rooms with Pomodoro timers, and maintain spaced-repetition revision schedules.

---

## 🏗️ Architecture Overview

Three services run concurrently and communicate over HTTP and WebSockets:

```
┌─────────────────────────────────────────────────────────────┐
│           React Frontend  (Vite · Port 5173)                │
│  React 19 · React Router 7 · Recharts · Socket.IO-Client   │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│        Express Backend  (Node.js · Port 5000)               │
│  Auth · CRUD · Cloudinary · Socket.IO · Web Push · Brevo   │
└───────────┬────────────────────────────────┬────────────────┘
            │ Mongoose                        │ axios
     ┌──────▼──────┐               ┌──────────▼──────────────┐
     │   MongoDB   │               │  FastAPI AI Service      │
     │  (local /   │               │  (Python · Port 8000)   │
     │   Atlas)    │               │  LangChain · LangGraph  │
     └─────────────┘               │  ChromaDB · Gemini      │
                                   └─────────────────────────┘
```

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Recharts, Socket.IO-Client |
| Backend | Node.js, Express 5, Mongoose 9, Socket.IO 4, Cloudinary, Nodemailer (Brevo), Web Push |
| AI Service | FastAPI, LangChain 0.3, LangGraph, ChromaDB, Sentence-Transformers, Gemini / OpenRouter |
| Database | MongoDB (local or Atlas) |

---

## 📋 Prerequisites

- **Node.js** v18+ & **npm**
- **Python** 3.10+ & **pip** / **venv**
- **MongoDB** running locally on `mongodb://localhost:27017` or a MongoDB Atlas URI
- *(Optional)* A **Tesseract-OCR** binary on your PATH for image-to-text uploads

---

## ⚙️ Installation & Setup

### 1. Clone & Root Config

```bash
git clone https://github.com/your-org/studyforge.git
cd studyforge
```

The root `.gitignore` covers all `.env` files, `node_modules/`, `__pycache__/`, `uploads/`, and the Python virtual environment.

---

### 2. Backend Setup (`/backend`)

```bash
cd backend
npm install
```

Create `backend/.env` (copy from `backend/.env.example`):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/studyforge
JWT_SECRET=your_64_char_hex_secret_here
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Transactional email via Brevo (SendinBlue)
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=no-reply@yourdomain.com

# Cloudinary (optional — local Multer fallback is active if omitted)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

### 3. AI Service Setup (`/ai-service`)

```bash
cd ../ai-service

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create `ai-service/.env` (copy from `ai-service/.env.example`):

```env
GEMINI_API_KEY=your_gemini_api_key_here
DEFAULT_PROVIDER=gemini
FALLBACK_PROVIDER=gemini
COMPLEX_REASONING_PROVIDER=gemini
OPENROUTER_API_KEY=your_openrouter_key_here   # optional second provider
ENVIRONMENT=development
MODEL_TIMEOUT_SECONDS=120
```

---

### 4. Frontend Setup (`/frontend`)

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🚀 Running the Services Locally

Open **three separate terminals**:

```bash
# Terminal 1 — Backend
cd backend && npm run dev
# → http://localhost:5000

# Terminal 2 — AI Service
cd ai-service
.\.venv\Scripts\activate   # or source .venv/bin/activate
uvicorn app.main:app --port 8000 --reload
# → http://localhost:8000

# Terminal 3 — Frontend
cd frontend && npm run dev
# → http://localhost:5173
```

> **Admin account** is seeded automatically on first backend start:
> `admin@studyforge.com` / `admin`

---

## 🗂️ Folder Structure

### Frontend (`/frontend/src/`)

| Path | Purpose |
|---|---|
| `pages/` | All UI screens (see table below) |
| `components/` | `Navbar`, `Sidebar`, `Layout`, `AdminRoute`, `LoadingSpinner` |
| `context/AuthContext.jsx` | Global auth state (JWT, user object) |
| `routes/ProtectedRoute.jsx` | Redirects unauthenticated users to `/login` |
| `services/api.js` | Central Axios instance with JWT header injection |
| `styles/` | Global CSS, dark-mode tokens, animation utilities |

**Pages:**

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | KPI overview, quick actions |
| `/planner` | Planner | AI-generated study roadmaps |
| `/tasks` | Tasks | CRUD task manager |
| `/quiz` | Quiz | AI quiz generator & scorer |
| `/flashcards` | Flashcards | Spaced-repetition flashcards |
| `/revision` | RevisionSchedule | Automated revision calendar |
| `/analytics` | Analytics | Charts: streak, score trends, weak topics |
| `/attendance` | Attendance | Subject-wise attendance tracker |
| `/notes` | NotesUpload | PDF/image upload → AI study notes |
| `/gamification` | Gamification | XP, badges, leaderboard |
| `/chatbot` | Chatbot | Voice-enabled AI tutor chat |
| `/coach` | Coach | Personalised AI study coach |
| `/study-buddy` | StudyBuddy | AI peer-study matching & messaging |
| `/rooms` | StudyRooms | Browse & create study rooms |
| `/rooms/:roomId` | LiveRoom | Real-time Pomodoro + collaborative room |
| `/profile` | Profile | Account settings & avatar |
| `/admin` | Admin | Diagnostics, metrics, prompt configurator |

---

### Backend (`/backend/`)

| Path | Purpose |
|---|---|
| `server.js` | Express app, middleware, route mounting, Socket.IO init |
| `config/db.js` | Mongoose connection |
| `models/` | Mongoose schemas (see below) |
| `controllers/` | Request handlers for every feature domain |
| `routes/` | Express router files with rate-limiter middleware |
| `middleware/authMiddleware.js` | JWT verification |
| `middleware/roleMiddleware.js` | Role-based guard (`admin` / `student`) |
| `integrations/aiService.js` | Axios wrapper for FastAPI calls |
| `services/notificationService.js` | Hourly task-due push notification job |
| `sockets/studyRoomSocket.js` | Socket.IO room & Pomodoro sync logic |
| `workflows/` | Multi-step AI orchestration sequences |
| `utils/` | Helpers (token generation, email templates, etc.) |

**Mongoose Models:**

`User` · `StudyPlan` · `Task` · `Quiz` · `Notes` · `Attendance` · `Gamification` · `Analytics` · `CoachAdvice` · `AdminSettings` · `Subscription`

**API Routes:**

| Prefix | Description |
|---|---|
| `/api/auth` | Register, login, Google OAuth, forgot/reset password |
| `/api/planner` | CRUD for study plans, AI plan generation |
| `/api/tasks` | CRUD tasks, AI subtask breakdown |
| `/api/quiz` | Generate, fetch, submit quizzes |
| `/api/flashcards` | CRUD flashcards |
| `/api/revision` | AI-generated spaced revision schedule |
| `/api/analytics` | Study stats, weak-topic analysis |
| `/api/attendance` | Mark & fetch attendance records |
| `/api/upload` | Upload PDF/image notes, RAG ingest |
| `/api/gamification` | XP, badges, leaderboard |
| `/api/chatbot` | AI tutor chat endpoint |
| `/api/coach` | Personalised coaching advice |
| `/api/study-buddy` | Match students, messaging |
| `/api/notifications` | Web-push subscription & delivery |
| `/api/dashboard` | Aggregated dashboard stats |
| `/api/adaptive` | Adaptive learning signals |
| `/api/admin` | *(admin only)* Diagnostics, prompt config |

---

### AI Service (`/ai-service/app/`)

| Path | Purpose |
|---|---|
| `main.py` | FastAPI app & router registration |
| `config.py` | Provider selection, model config, env loading |
| `agents/base_agent.py` | Abstract `BaseAgent` with retry & fallback logic |
| `agents/orchestrator.py` | LangGraph orchestrator — routes requests to specialist agents |
| `agents/planner_agent.py` | Generates structured multi-week study plans |
| `agents/tutor_agent.py` | Conversational AI tutor with context memory |
| `agents/weak_topic_agent.py` | Identifies knowledge gaps from quiz history |
| `agents/revision_agent.py` | Builds spaced-repetition revision schedules |
| `agents/productivity_agent.py` | Task prioritisation & focus advice |
| `agents/study_coach_agent.py` | Personalised coaching & motivation |
| `agents/rag_agent.py` | Retrieval-augmented Q&A over uploaded notes |
| `agents/validation_agent.py` | JSON schema validation for all agent outputs |
| `models/router.py` | Dynamic provider health-checks & fallback routing |
| `prompts/templates.py` | System prompts for all agents (admin-configurable) |
| `schemas/ai_schemas.py` | Pydantic response models |
| `rag/` | ChromaDB vector store + document ingestion pipeline |
| `memory/` | Per-user conversation memory store |
| `routers/` | FastAPI route handlers |
| `utils/` | Shared utilities (logging, parsing, etc.) |

---

## 🔒 Security & Performance

| Feature | Detail |
|---|---|
| **JWT Auth** | HS256 tokens, 7-day expiry, verified on every protected route |
| **Google OAuth 2.0** | `/api/auth/google` → callback → JWT handoff to frontend |
| **Rate Limiting** | Auth endpoints: 15 req / 15 min · Global: 100 req / 15 min |
| **Role Guards** | `requireRole('admin')` middleware + frontend `AdminRoute` |
| **Cloudinary Uploads** | PDF & image notes stored on Cloudinary; local Multer fallback |
| **DB Indexes** | `userId` indexes on all user-scoped collections |
| **CORS** | Restricted to `FRONTEND_URL` origin |
| **Provider Fallback** | AI service falls back to secondary provider on rate-limit or timeout |

---

## ✨ Feature Highlights

### 🤖 Multi-Agent AI Orchestration
A **LangGraph orchestrator** routes each request to the optimal specialist agent (Planner, Tutor, WeakTopic, Revision, Productivity, Coach, RAG). Each agent inherits retry logic and provider fallback from `BaseAgent`, and all outputs are schema-validated before being returned to the backend.

### 📄 OCR & RAG Pipeline
Upload **PDFs, PNGs, JPGs, or JPEGs**. The backend extracts text (pdf-parse for PDFs, Tesseract for images) and forwards it to FastAPI `/ai/upload-note`, which chunks, embeds, and stores vectors in **ChromaDB**. The RAG agent uses these vectors to answer questions grounded in the student's own notes.

### ⏱️ Real-Time Study Rooms & Pomodoro
**Socket.IO** powers live collaborative study rooms. Room hosts configure study/break intervals; countdown state is broadcast instantly to all participants. The `LiveRoom` page shows a shared timer, participant list, and chat.

### 🔔 Web Push Notifications
**Web Push** (VAPID) sends browser notifications when tasks are due. The notification service runs on startup (10 s delay) and then every hour, checking for tasks due in the next 24 hours.

### 📧 Email Notifications (Brevo)
Transactional emails (password reset, verification) are sent via the **Brevo** SMTP/API integration using Nodemailer.

### 🎙️ Voice-Enabled AI Chatbot
The Chatbot page uses `webkitSpeechRecognition` for dictation and `window.speechSynthesis` to read responses aloud. Markdown is stripped before synthesis for natural speech output.

### 🏆 Gamification
XP is awarded for completing tasks, passing quizzes, and maintaining streaks. Students earn badges and appear on a leaderboard. The `Gamification` model tracks XP, level, badges, and streak data.

### 🤝 Study Buddy
AI-powered peer matching connects students with complementary strengths and schedules. Includes real-time messaging between matched buddies.

### 🛡️ Admin Dashboard
Accessible only to `admin`-role users, the Admin panel shows:
- Live server uptime & AI service health
- Registered user count, quiz count, note upload count
- Web-configurable prompt templates for each AI agent

---

## 📦 Key Dependencies

### Backend
`express 5` · `mongoose 9` · `socket.io 4` · `jsonwebtoken` · `bcryptjs` · `cloudinary` · `multer` · `nodemailer` · `web-push` · `pdf-parse` · `express-rate-limit` · `axios`

### Frontend
`react 19` · `react-router-dom 7` · `recharts` · `socket.io-client` · `axios` · `jwt-decode` · `react-hot-toast`

### AI Service
`fastapi` · `uvicorn` · `langchain 0.3` · `langgraph` · `langchain-google-genai` · `langchain-chroma` · `chromadb` · `sentence-transformers` · `torch` · `pypdf` · `pytesseract` · `scikit-learn` · `tenacity` · `structlog`
