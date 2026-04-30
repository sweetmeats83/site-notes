# SiteNote

A self-hosted field notes and project management PWA for contractors and tradespeople. Take notes on-site, attach photos, transcribe audio, manage tasks, and sync with your billing software — all from a single installable web app.

![SiteNote demo](site-note.gif)

![License](https://img.shields.io/badge/license-MIT-blue) ![Node](https://img.shields.io/badge/node-20-green) ![Docker](https://img.shields.io/badge/docker-ready-blue)

---

## Features

- **Rich note editor** — Tiptap-powered with inline images, task lists, and drawing canvas
- **Audio transcription** — Record on-site audio and transcribe via any Whisper-compatible API
- **AI assistant** — Per-note chat with any Ollama or OpenAI-compatible LLM
- **File attachments** — Upload photos, PDFs, and documents per note
- **Full-text search** — SQLite FTS5 search across all notes and tags
- **Project management** — Group notes by project, assign clients, track pipeline stages
- **Invoice Ninja integration** — Sync clients, quotes, invoices, and product catalog
- **Bid items & materials** — Track material preferences and attach bid items to notes
- **PDF export** — Convert any note to a PDF
- **PWA / offline-capable** — Installable on iOS, Android, and desktop; works without internet
- **Dark mode** — System default or user-selectable
- **Single-user auth** — Session-based, shared password (no user database needed)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Tiptap |
| Backend | Node.js 20, Express |
| Database | SQLite (better-sqlite3, FTS5, WAL) |
| Session | Express-session with SQLite store |
| Build / Deploy | Docker multi-stage build, Docker Compose |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/your-username/sitenote.git
cd sitenote
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set the required values:

```bash
# Generate a strong session secret
openssl rand -hex 32

# Then paste the output as SESSION_SECRET in .env
# Also set ADMIN_PASSWORD to your chosen login password
```

### 3. Configure Docker Compose

```bash
cp docker-compose.example.yml docker-compose.yml
```

The example file uses a simple standalone setup. See [Reverse Proxy](#reverse-proxy) below if you want to put it behind Caddy or nginx.

### 4. Start the app

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:3000` (or whichever `PORT` you set). Data is persisted in `./data/`.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the server listens on |
| `NODE_ENV` | No | `production` | Set to `development` for verbose logging |
| `DATA_DIR` | No | `/data` | Path to the persistent data directory |
| `TRUST_PROXY` | No | — | Set `true` when behind a reverse proxy |
| `SESSION_SECRET` | **Yes** | — | Secret key for session cookies — generate with `openssl rand -hex 32` |
| `SESSION_SECURE` | No | — | Set `true` to enforce HTTPS-only cookies (recommended in production) |
| `ADMIN_PASSWORD` | **Yes** | — | Shared login password |
| `TRANSCRIPTION_URL` | No | — | OpenAI-compatible Whisper endpoint (e.g. `http://speaches:8000/v1/audio/transcriptions`) |
| `TRANSCRIPTION_API_KEY` | No | — | API key for the transcription service |
| `TRANSCRIPTION_MODEL` | No | — | Model name (e.g. `Systran/faster-whisper-small`) |
| `LLM_URL` | No | — | Ollama or OpenAI-compatible base URL (e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | No | — | API key (required for OpenAI, optional for Ollama) |
| `LLM_MODEL` | No | `llama3` | Default LLM model name |
| `INVOICENINJA_URL` | No | — | Your Invoice Ninja instance URL |
| `INVOICENINJA_API_KEY` | No | — | Invoice Ninja API token |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID (for Calendar integration) |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | — | OAuth redirect URI |

---

## Data Persistence

All persistent data lives in `./data/`:

```
data/
├── sitenote.db        # SQLite database (notes, projects, tasks, settings)
└── uploads/           # User file attachments
```

Back up this directory to preserve your data. The `./data` path is bind-mounted into the container and excluded from git via `.gitignore`.

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm run install:all
```

### Run in development mode

```bash
cp .env.example .env   # fill in at minimum SESSION_SECRET and ADMIN_PASSWORD
npm run dev
```

This starts the Express backend on port 3001 and the Vite dev server on port 5173 with hot-reload.

### Build for production

```bash
npm run build          # builds the frontend into frontend/dist/
```

---

## Reverse Proxy

When running behind a reverse proxy, set `TRUST_PROXY=true` and `SESSION_SECURE=true` in your `.env`.

The `docker-compose.example.yml` includes commented-out blocks for connecting to an external proxy network. Uncomment and set the network name to match your Caddy/nginx/Traefik setup.

Example Caddy site block:

```
notes.example.com {
    reverse_proxy sitenote_app_1:3000
}
```

---

## Optional Integrations

### AI / LLM

SiteNote works with any OpenAI-compatible API. For local inference, [Ollama](https://ollama.com) is the easiest option:

```bash
ollama serve                  # starts on http://localhost:11434
ollama pull llama3            # or mistral, phi3, etc.
```

Set `LLM_URL=http://localhost:11434/v1` and `LLM_MODEL=llama3` in `.env`.

### Audio Transcription

Any Whisper-compatible server works. [speaches](https://github.com/speaches-ai/speaches) and [faster-whisper-server](https://github.com/fedirz/faster-whisper-server) are good self-hosted options.

### Invoice Ninja

Generate an API token in Invoice Ninja under **Settings → API Tokens** and set `INVOICENINJA_URL` and `INVOICENINJA_API_KEY` in `.env`. The integration syncs clients, products, quotes, and invoices.

---

## License

MIT
