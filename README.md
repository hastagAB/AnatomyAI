<div align="center">

<br/>

<img src="frontend/src/assets/hero.png" alt="Anatomy AI" width="120" />

# Anatomy AI

### _Dissect any project before writing a single line of code._

<br/>

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Anthropic](https://img.shields.io/badge/Anthropic_Claude-191919?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Tailwind](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

<br/>

Feed it architecture docs, diagrams, specs, and whiteboard photos.<br/>
It reads everything, maps the system, generates interactive diagrams,<br/>
builds a development plan, and flags what's missing.

<br/>

**`PDF`** · **`DOCX`** · **`Draw.io`** · **`PPTX`** · **`XLSX`** · **`Markdown`** · **`Images`** · **`TXT`**

<br/>

---

</div>

<br/>

## 💡 The Problem

You inherit a project. There are **40 documents** spread across Confluence, SharePoint, and email attachments. Some are architecture docs, some are diagrams, some are meeting notes with critical decisions buried in paragraph 17.

No one person knows the full picture. The architect left. The wiki is stale.

> **Anatomy reads all of it in minutes, understands the relationships, and hands you a complete system map — with gaps highlighted.**

<br/>

## ✨ Features at a Glance

<table>
<tr>
<td width="50%">

### 📄 Ingest Anything
Drop **any combination** of document formats. PDFs, Word docs, PowerPoint decks, spreadsheets, draw.io diagrams, markdown, even whiteboard photos. Everything is parsed into a unified context.

</td>
<td width="50%">

### 🧠 AI Analysis
**Map-Reduce pipeline** extracts components, data flows, models, tech stack, NFRs, and gaps. Runs **3 batches in parallel** with retry, resume, and real-time progress streaming.

</td>
</tr>
<tr>
<td width="50%">

### 🗺️ Interactive Diagrams
**10 diagram types** — from C4 System Context to ER diagrams to deployment views. Glassmorphism-styled nodes, auto-layout with dagre, zoom, pan, minimap. Export to **PNG** or **SVG**.

</td>
<td width="50%">

### 💬 Architecture Chat
Ask anything with **full project context**. _"What are the security concerns?"_ _"What happens if the queue goes down?"_ Responses stream in real-time.

</td>
</tr>
<tr>
<td width="50%">

### 📋 Build Planning
Phased development plan with tasks, deliverables, acceptance criteria, risk assessment, tech recommendations, and team structure suggestions.

</td>
<td width="50%">

### 🔍 Gap Detection
The killer feature. Finds what your docs **don't** say:
_"Auth mentioned but no auth strategy defined"_
_"Database tech not specified for analytics store"_

</td>
</tr>
</table>

<br/>

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|:-|:-|
| 🐍 Python | 3.12+ |
| 📦 Node.js | 18+ |
| 🤖 LLM API Key | Anthropic or OpenAI |

### Install

```bash
# Clone
git clone <repo-url> && cd Anatomy

# Backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # ← Edit with your LLM API credentials

# Frontend
cd ../frontend
npm install
```

### Configure

Create `backend/.env` from the example:

```env
# LLM Provider: "anthropic" or "openai"
ANATOMY_LLM_PROVIDER=anthropic
ANATOMY_LLM_API_KEY=your-api-key-here
# ANATOMY_LLM_BASE_URL=           # leave empty for default provider URL
ANATOMY_LLM_MODEL=claude-sonnet-4-20250514
ANATOMY_LLM_MODEL_DEEP=claude-sonnet-4-20250514
```

> [!TIP]
> For deeper analysis, set `LLM_MODEL_DEEP` to a more powerful model like `claude-opus-4-20250514` or `gpt-4o`.

### Run

```bash
# Terminal 1 — API
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI
cd frontend && npm run dev
```

**→ Open [http://localhost:5173](http://localhost:5173)**

<br/>

## 🎯 How to Use

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   📁 Select  │───▶│   📤 Upload  │───▶│   🧠 Analyze │───▶│  🗺️ Explore  │
│   Project    │    │   Documents  │    │   (parallel) │    │  Diagrams    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                   │
                                                            ┌──────▼───────┐
                                                            │  💬 Chat  /  │
                                                            │  📋 Plan     │
                                                            └──────────────┘
```

| Step | What Happens |
|:-----|:-------------|
| **1. Pick a project** | Select existing or create new. Projects persist across browser sessions via `localStorage`. |
| **2. Upload** | Drag & drop files. Any combination of 8 formats. All parsed instantly. |
| **3. Analyze** | Click "Analyze Documents". Watch real-time SSE progress as batches extract in parallel. |
| **4. Diagrams** | Switch tabs. Pick from 10 diagram types. Pan, zoom, drag nodes. Export PNG/SVG. |
| **5. Chat** | Open the sliding panel. Ask anything — AI has full document + analysis context. |
| **6. Plan** | Generate a phased build plan with tasks, risks, and blocking gaps. |

<br/>

## 📐 Architecture

<details>
<summary><b>Project Structure</b> (click to expand)</summary>

```
Anatomy/
├── backend/                     Python 3.12+ / FastAPI
│   ├── app/
│   │   ├── main.py              App entry, CORS, route registration
│   │   ├── config.py            Pydantic settings from .env
│   │   ├── api/                 Route handlers
│   │   │   ├── upload.py        Project CRUD, file upload, delete
│   │   │   ├── analyze.py       Map-reduce analysis (SSE), progress
│   │   │   ├── diagrams.py      Diagram generation and retrieval
│   │   │   ├── chat.py          Streaming chat (SSE)
│   │   │   └── plan.py          Build plan generation
│   │   ├── services/            Business logic
│   │   │   ├── parser.py        Multi-format doc parser (8 formats)
│   │   │   ├── analyzer.py      Parallel map-reduce + synthesis
│   │   │   ├── diagram_gen.py   AI diagram data generation
│   │   │   ├── chat.py          Context-aware streaming chat
│   │   │   └── planner.py       Build plan generation
│   │   ├── models/
│   │   │   ├── schemas.py       Pydantic models (15 models)
│   │   │   └── project.py       File-based JSON project store
│   │   └── utils/
│   │       ├── prompts.py       System prompt templates
│   │       └── file_utils.py    File I/O utilities
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                    React 19 / TypeScript / Vite
│   └── src/
│       ├── App.tsx              Layout, project restore, routing
│       ├── store/useStore.ts    Zustand global state
│       ├── hooks/useProject.ts  API hooks (SSE + REST)
│       ├── components/
│       │   ├── project/         Project picker
│       │   ├── layout/          Header, Sidebar + progress bar
│       │   ├── upload/          Drag-and-drop zone
│       │   ├── analysis/        Results dashboard
│       │   ├── diagrams/        React Flow canvas + custom nodes
│       │   ├── chat/            Streaming chat panel
│       │   └── plan/            Build plan viewer
│       ├── styles/theme.ts      Node color system
│       └── types/index.ts       TypeScript interfaces
│
├── .gitignore
└── README.md
```
</details>

### 🧠 How the Analysis Engine Works

The core innovation is a **parallel map-reduce pipeline** that handles document sets of any size:

```
  ┌─────────────────────────────────────────────────┐
  │            📄 36 uploaded documents              │
  └────────────────────┬────────────────────────────┘
                       │
                 _group_documents()
            (batches ≤ 120K chars each)
                       │
  ┌────────────────────▼────────────────────────────┐
  │          15 batches  ·  3 running in parallel    │
  │                                                  │
  │   ┌──────┐   ┌──────┐   ┌──────┐               │
  │   │ B1 ✓ │   │ B2 ✓ │   │ B3 ⏳ │   ...        │  MAP: extract_batch()
  │   └──┬───┘   └──┬───┘   └──┬───┘               │  (3× retry + backoff)
  │      │          │          │                     │
  │      💾         💾         💾                    │  saved after EACH batch
  │                                                  │
  └────────────────────┬────────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────────┐
  │         synthesize_extractions()                 │  REDUCE: merge + dedup
  └────────────────────┬────────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────────┐
  │          ✅ Unified AnalysisResult               │
  │    components · flows · models · gaps · NFRs     │
  └─────────────────────────────────────────────────┘
```

> [!NOTE]
> **Resume support** — if the browser disconnects or the server restarts mid-analysis, clicking "Analyze" again **skips completed batches** and picks up where it left off. Zero wasted API calls.

### 🗺️ 10 Diagram Types

| # | Diagram | Description |
|:-:|---------|-------------|
| 1 | **System Context** (C4-L1) | Bird's eye — system, actors, external systems |
| 2 | **Container** (C4-L2) | Applications, data stores, protocols |
| 3 | **Component** (C4-L3) | Internals of a single container |
| 4 | **High-Level Design** | Layers, services, infrastructure boundaries |
| 5 | **Low-Level Design** | Modules, classes, detailed interactions |
| 6 | **Data Flow** | End-to-end data movement through the system |
| 7 | **ER Diagram** | Entities, attributes, relationships |
| 8 | **Sequence** | Service interaction flows over time |
| 9 | **Deployment** | Infrastructure, cloud services, networking |
| 10 | **Tech Stack** | Visual technology radar |

<br/>

## 🛠️ Tech Stack

| Layer | Technology | Why |
|:------|:----------|:----|
| 🤖 **AI** | Anthropic Claude / OpenAI | Large context windows, streaming support |
| ⚡ **Backend** | FastAPI + Python 3.12 | Async, fast, great doc-parsing ecosystem |
| ⚛️ **Frontend** | React 19 + TypeScript | Component model fits diagram rendering |
| 🗺️ **Diagrams** | React Flow + dagre | Interactive node graphs with auto-layout |
| 🎨 **Styling** | Tailwind CSS 4 | Utility-first, rapid visual iteration |
| 🎬 **Animation** | Framer Motion | Smooth transitions between views |
| 📦 **State** | Zustand 5 | Lightweight, zero boilerplate |
| 📡 **Streaming** | Server-Sent Events | Real-time progress, no WebSocket overhead |
| 💾 **Persistence** | File-based JSON | Zero infrastructure — works fully offline |
| 📄 **Parsing** | PyMuPDF, python-docx, python-pptx, openpyxl, lxml | Native parser per format |

<br/>

## 📡 API Reference

<details>
<summary><b>Projects</b></summary>

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/projects?name=X` | Create a new project |
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/:id` | Get project + analysis + plan |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `POST` | `/api/projects/:id/upload` | Upload files (multipart) |
| `DELETE` | `/api/projects/:id/documents/:docId` | Remove a document |
</details>

<details>
<summary><b>Analysis</b></summary>

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/analyze` | Run analysis (SSE stream) — `{project_id}` |
| `POST` | `/api/analyze?fresh=true` | Fresh analysis (wipe previous) |
| `GET` | `/api/projects/:id/analysis` | Get analysis results |
| `GET` | `/api/projects/:id/analysis-progress` | Poll extraction progress |
</details>

<details>
<summary><b>Diagrams</b></summary>

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/diagrams/generate` | Generate diagram — `{project_id, diagram_type}` |
| `GET` | `/api/projects/:id/diagrams/:type` | Get generated diagram |
</details>

<details>
<summary><b>Chat & Planning</b></summary>

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/chat` | Chat (SSE stream) — `{project_id, message}` |
| `GET` | `/api/projects/:id/chat-history` | Get conversation history |
| `DELETE` | `/api/projects/:id/chat-history` | Clear conversation |
| `POST` | `/api/plan/generate` | Generate build plan — `{project_id}` |
| `GET` | `/api/projects/:id/plan` | Get generated plan |
</details>

<br/>

## ⚙️ Configuration

All environment variables use the `ANATOMY_` prefix in `backend/.env`:

| Variable | Required | Default | Description |
|:---------|:--------:|:--------|:------------|
| `LLM_PROVIDER` | | `anthropic` | LLM provider (`anthropic` or `openai`) |
| `LLM_API_KEY` | ✅ | - | API key for your LLM provider |
| `LLM_BASE_URL` | | - | Custom base URL (leave empty for default) |
| `LLM_MODEL` | | `claude-sonnet-4-20250514` | Model for extraction, diagrams, chat |
| `LLM_MODEL_DEEP` | | `claude-sonnet-4-20250514` | Model for synthesis and planning |
| `MAX_FILE_SIZE_MB` | | `50` | Max upload size per file |

<br/>

## 💡 Pro Tips

> [!TIP]
> **Upload everything together** — Cross-references between a PRD, draw.io diagram, and API spec produce much richer analysis than uploading them separately.

> [!TIP]
> **Start with System Context** — Generate the C4 Level 1 diagram first for the big picture, then drill into Container and Component.

> [!TIP]
> **Check gaps first** — Gap detection is the fastest way to surface undocumented decisions and assumptions.

> [!TIP]
> **Resume, don't restart** — If analysis disconnects, just click Analyze again. Completed batches are skipped instantly. Zero wasted API calls.

<br/>

## 🏗️ Design Decisions

| Decision | Rationale |
|:---------|:----------|
| SQLite for storage | Zero infrastructure. No database to provision. Works offline. |
| Map-reduce with parallel batching | Handles 50+ docs without hitting context limits. 3x faster. |
| SSE over WebSockets | Simpler protocol, works through proxies, no state to manage. |
| Zustand over Redux | Same capability, fraction of the boilerplate. |
| React Flow over D3 | First-class React. Built-in pan, zoom, minimap, export. |
| dagre for layout | Deterministic hierarchical layout. Great for architecture diagrams. |

<br/>

---

<div align="center">

<br/>

**Built with [Anthropic Claude](https://www.anthropic.com) and a lot of architectural opinions.**

<br/>

<sub>If it can read your architecture, it can find what's missing.</sub>

<br/><br/>

</div>
