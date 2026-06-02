# AI-Powered Support Agent (RAG PoC)

An internal customer-support tool. Support agents ask natural-language questions
about company documentation and get answers that are **grounded in the source
docs** and **cite where they came from**. If the answer isn't in the docs, the
agent says so instead of hallucinating.

---

## Architecture

```
┌──────────────┐   HTTP/JSON   ┌──────────────┐   HTTP/JSON   ┌─────────────────┐
│  Next.js UI  │ ────────────▶ │ Node Gateway │ ────────────▶│ Python AI Svc   │
│ (App Router  │ ◀──────────── │  (Express)   │ ◀────────────│  (FastAPI)      │
│  + shadcn/ui)│  answer +     │               │  answer +    │  RAG pipeline   │
└──────────────┘  citations    └──────┬────────┘  citations   └───────┬─────────┘
                                       │                              │
                                       ▼                              ▼
                                 ┌─────────────────────────────────────────┐
                                 │        MongoDB Atlas                    │
                                 │  • sessions   (chat history)            │
                                 │ • doc_chunks (text + vector embeddings) │
                                 │  + Atlas Vector Search index            │
                                 └─────────────────────────────────────────┘
```

### Design choices & separation of concerns

- **Three independent services.** Python owns the *intelligence*
  (embeddings, retrieval, generation), Node owns *orchestration* (proxying AI
  work, persisting chat history, normalizing errors), and Next.js owns
  *presentation*. The browser only ever talks to the Express gateway.
- **Why keep Express when Next.js has API routes?** The assignment explicitly
  evaluates how the Node and Python services communicate, so the gateway stays a
  dedicated service. Next.js is intentionally the presentation layer only — this
  keeps the AI service swappable/scalable and the gateway as the single trust
  boundary that holds DB and service credentials.
- **Retrieval is decoupled from generation** (`ai-service/rag.py`). Chunking,
  embedding, and vector search are separate functions, each testable in
  isolation and independent of the LLM choice.
- **Hallucination mitigation is layered:**
  1. A strict system prompt: answer **only** from retrieved context, else return
     the exact string `"I cannot find the answer in the provided documentation."`
  2. `temperature=0` for deterministic, context-faithful output.
  3. Citations are derived from the chunks **actually retrieved**, so a source
     can never be fabricated. The UI renders the refusal in a distinct state.
- **Sessions are one embedded Mongo document**, so a refresh rehydrates the whole
  conversation in a single read. The browser stores a `sessionId` in
  `localStorage`.

### Tech stack

| Layer         | Tech                                                      |
|---------------|-----------------------------------------------------------|
| Frontend      | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| API Gateway   | Node.js, Express, Mongoose                                 |
| AI Service    | Python, FastAPI, OpenAI SDK                                |
| Data + Vector | MongoDB Atlas + Atlas Vector Search                        |

The `frontend/components/ui` folder contains real shadcn/ui primitives (Button,
Textarea, Card, Badge) built on `class-variance-authority` + `tailwind-merge`,
with the standard HSL design tokens in `app/globals.css`. To add more, run
`npx shadcn@latest add <component>`.

---

## Prerequisites

- A **MongoDB Atlas** cluster (free M0 works) — Atlas Vector Search is required
  and is *not* available in a local mongo container.
- An **OpenAI API key** (or any OpenAI-compatible endpoint via `OPENAI_BASE_URL`).
- Node 20+, Python 3.11+ (or Docker).

---

## One-time setup: the Atlas Vector Search index

After the first ingest creates the `doc_chunks` collection, create a Vector
Search index named `vector_index` on it (Atlas UI → Collection → Search Indexes
→ Create → JSON editor):

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

`numDimensions` must match `EMBEDDING_DIMS` (1536 for `text-embedding-3-small`).

---

## Local setup

### 1. AI service (FastAPI)

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set MONGODB_URI + OPENAI_API_KEY
python ingest.py              # chunk + embed + store data/user-manual.md
uvicorn main:app --reload --port 8000
```

Create the Atlas index (above) after the first ingest.

### 2. API gateway (Express)

```bash
cd api-gateway
npm install
cp .env.example .env          # MONGODB_URI; AI_SERVICE_URL=http://localhost:8000
npm run dev                   # http://localhost:4000
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_BASE=http://localhost:4000
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000 and ask, e.g., *"How much does the Pro plan cost?"*
Try an out-of-scope question (*"What's the weather?"*) to see the grounded refusal.

---

## Run with Docker Compose (gateway + AI service)

```bash
cp .env.example .env          # fill in real values
docker compose up --build     # AI svc :8000, gateway :4000
docker compose exec ai-service python ingest.py   # ingest into the container
```

Run the Next.js frontend separately (`cd frontend && npm run dev`) or deploy to Vercel.

---

## API reference

| Method | Route                          | Purpose                                 |
|--------|--------------------------------|-----------------------------------------|
| GET    | `/api/sessions/:id` (gateway)  | Load chat history for a session         |
| POST   | `/api/chat` (gateway)          | Ask a question → `{ answer, sources }`  |
| POST   | `/api/chat/stream` (gateway)   | Same, streamed token-by-token (SSE)     |
| POST   | `/api/upload` (gateway)        | Upload a `.md`/`.txt` doc to be indexed |
| POST   | `/query` (AI svc)              | Core RAG endpoint                       |
| POST   | `/query/stream` (AI svc)       | Streaming RAG endpoint                  |
| POST   | `/ingest` (AI svc)             | Index an uploaded file                  |

---

## Deployment notes

- **Frontend → Vercel:** import the repo, set root to `frontend/`, set
  `NEXT_PUBLIC_API_BASE` to the gateway's public URL.
- **Gateway + AI service → Render/Railway** (or Docker Compose on one EC2 box).
  Set `CORS_ORIGIN` to the deployed frontend URL and `AI_SERVICE_URL` to the AI
  service's internal URL.
- Never commit `.env` — only `.env.example` is tracked.

## Bonus features implemented

-  Real-time **streaming** of the LLM response (toggle in the header).
-  **Docker Compose** for the Node + Python services.
-  **Upload documents** from the UI to ingest new docs on the fly.
