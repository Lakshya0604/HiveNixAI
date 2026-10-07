# HiveNixAI

A multi-agent GenAI application I'm building to learn how agent systems work in practice. A React app talks to a set of Node.js microservices, and an agent service uses **LangGraph** to route each request to a specialised agent (chat, search, coding, plus experimental pdf/ppt/image agents), with **Groq** LLMs and **Tavily** web search behind them.

> 🚧 **Status: work in progress.** Chat, search and coding are the most developed flows. The rest is experimental and changes often.

## What it does

- **Chat interface (React)** with conversation history stored in MongoDB
- **Voice mode** in the browser using the Web Speech API (speech recognition + spoken replies, multiple languages including Hindi)
- **Agent router (LangGraph)** that sends each message to the right agent:
  - **chat** - general conversation, explanations, learning questions
  - **search** - current events and real-time info via Tavily, with accurate server time
  - **coding** - code writing and debugging help
  - **pdf / ppt / imageGen** - experimental agents, still being built out
- **Google sign-in** via Firebase, with an API gateway that proxies and protects the backend services

## Architecture

```
React frontend  ->  API gateway (Express proxy + cookie auth)  ->  microservices
                                                                  ├─ auth service (Firebase Admin)
                                                                  ├─ chat service (conversations + messages, MongoDB)
                                                                  └─ agent service (LangGraph router + agents,
                                                                     Groq via LangChain, Tavily search)
Redis (local via docker-compose) for shared state.
```

- The gateway exposes `/api/auth`, `/api/chat`, `/api/agent` and `/api/me`. Chat and agent routes sit behind an auth middleware that forwards the current user.
- The agent service builds a `StateGraph` with a router node. Time/date questions are hard-routed to the search agent (it has the accurate server clock); everything else is classified by an LLM call.
- LLM access is centralised in one config (`ChatGroq`, model `openai/gpt-oss-120b`).

## Tech stack

**Frontend:** React 19, Vite, Redux Toolkit, Tailwind CSS v4, Firebase
**Backend:** Node.js, Express, LangGraph + LangChain, Groq, Tavily, MongoDB (Mongoose), Redis

## Project structure

```
HiveNixAI/
├── HiveNixAI/
│   ├── backend/
│   │   ├── gateway/            # API gateway: proxying, cookie auth, /api/me
│   │   ├── services/
│   │   │   ├── auth/           # Firebase-based auth service
│   │   │   ├── chat/           # Conversations and messages (MongoDB)
│   │   │   └── agent/          # LangGraph graph, router, agents, LLM + Tavily config
│   │   ├── common/redis/       # Shared Redis client (ioredis)
│   │   └── docker-compose.yml  # Local Redis
│   └── frontend/               # React + Vite app (voice mode, chat UI)
```

## Running locally

Prerequisites: Node.js 18+, MongoDB, Docker (for Redis), a Groq API key, a Tavily API key, and a Firebase project.

```bash
git clone https://github.com/Lakshya0604/HiveNixAI.git
cd HiveNixAI/HiveNixAI

# 1. Start Redis
cd backend && docker compose up -d

# 2. Start each service (separate terminals, each has its own .env)
cd backend/gateway          && npm install && npm run dev
cd backend/services/auth    && npm install && npm run dev   # needs serviceAccountKey.json
cd backend/services/chat    && npm install && npm run dev
cd backend/services/agent   && npm install && npm run dev   # defaults to port 8003

# 3. Start the frontend
cd frontend && npm install && npm run dev
```

Environment variables used across services: `PORT`, `MONGO_URI`, `REDIS_URL`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `FRONTEND_URL`, `AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`. There are no `.env.example` files yet - check each service's config to see what it reads.

## Known gaps

- No `.env.example` files or root setup script yet
- The pdf, ppt and imageGen agents are early and less complete than chat/search/coding
- No tests yet
