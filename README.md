# braumchat-api

Backend API for **Braumchat** — a realtime chat platform for developers and professional teams.

This service powers the Braumchat web app, handling authentication, workspaces, channels, messages, and WebSocket-based realtime communication.

---

## 🔧 Tech Stack

- **Language:** Python 3.11+
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.x (async)
- **Database:** PostgreSQL
- **Cache / Pub-Sub:** Redis
- **Migrations:** Alembic
- **Auth:** JWT (access + refresh), password hashing with `bcrypt`
- **Package manager:** Poetry
- **Runtime:** Uvicorn
- **Infra target:** single cheap VM (e.g. Hetzner) with Docker + docker-compose, behind Nginx + Let’s Encrypt

---

## ✨ Main Features (API)

- User registration and login (email + password)
- JWT-based authentication (`/auth/login`, `/auth/refresh`, `/auth/me`)
- Workspaces (multi-tenant):
  - Create and manage workspaces
  - Membership & roles (owner/admin/member)
- Channels:
  - Public and private channels per workspace
  - Channel membership for private channels
- Messages:
  - Persisted messages per channel
  - Basic pagination for message history
- Realtime:
  - WebSocket endpoint per channel
  - Broadcast of new messages to connected clients

---

## 📁 Project Structure (high level)

```text
braumchat_api/
  api/
    routes/        # FastAPI routers (auth, users, workspaces, channels, messages, realtime)
    deps.py        # Common dependencies (DB session, current user, etc.)
  # braumchat-api

  Backend API for **Braumchat** — a realtime chat platform for developers and teams.

  This repository contains a FastAPI-based backend that implements authentication, workspaces, channels, messages and a WebSocket-based realtime layer.

  ---

  ## 🔧 Tech Stack

  - **Language:** Python 3.11+
  - **Framework:** FastAPI (async)
  - **ORM:** SQLAlchemy 2.x (async)
  - **Database:** PostgreSQL
  - **Cache / Pub-Sub:** Redis
  - **Migrations:** Alembic
  - **Auth:** JWT (access + refresh), password hashing with `bcrypt`
  - **Package manager:** Poetry
  - **Runtime:** Uvicorn
  - **Deploy target:** single VM or small host (Docker + docker-compose), behind Nginx + Let's Encrypt

  ---

  ## ✨ Main Features (API)

  - User registration and login (email + password)
  - JWT-based authentication (`/auth/login`, `/auth/refresh`, `/auth/me`)
  - Workspaces (multi-tenant)
    - Create and manage workspaces
    - Membership & roles (owner/admin/member)
  - Channels
    - Public and private channels per workspace
    - Channel membership for private channels
  - Messages
    - Persisted messages per channel
    - Basic pagination for message history
  - Realtime
    - WebSocket endpoint per channel
    - Broadcast of new messages to connected clients

  ---

  ## 📁 Project Structure (high level)

  ```text
  braumchat_api/
    api/
      routes/        # FastAPI routers (auth, users, workspaces, channels, messages, realtime)
      deps.py        # Common dependencies (DB session, current user, etc.)
    config.py        # Pydantic Settings (env configuration)
    db/
      session.py     # Async DB engine and session
      base.py        # Base imports (for Alembic)
    models/
      meta.py        # Base & BaseEntity (timestamps, naming conventions)
      user.py
      workspace.py
      workspace_member.py
      channel.py
      channel_member.py
      message.py
      __init__.py    # Imports all models for metadata
    schemas/         # Pydantic models (request/response)
    services/        # Business logic (auth, users, workspaces, channels, messages, realtime)
    security/        # JWT, password hashing, auth dependencies
  alembic/
    env.py           # Alembic config (async, uses Base.metadata)
    versions/        # Generated migration files
  docker-compose.yml
  Dockerfile
  pyproject.toml
  README.md
  .env.example
  ```

  ## ✅ Requirements

  - Python 3.11+ (recommended for `asyncpg` compatibility)
  - Poetry
  - Docker & Docker Compose (for running Postgres/Redis and the API in containers)

  ## 🧪 Environment Variables

  Configuration is managed by Pydantic Settings and loaded from `.env`. Copy the example and edit values:

  ```bash
  cp .env.example .env
  ```

  Minimal important keys (example values):

  ```env
  # Database (docker network)
  DATABASE_URL=postgresql+asyncpg://braumchat:password@db:5432/braumchat

  # Redis (docker network)
  REDIS_URL=redis://redis:6379/0

  # JWT
  JWT_SECRET=your-jwt-secret
  JWT_ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRES_MINUTES=15
  REFRESH_TOKEN_EXPIRES_DAYS=7

  # CORS (comma separated)
  CORS_ORIGINS=http://localhost:3000,https://braumchat.com

  # Environment
  ENV=development

  # OAuth (Google) – optional
  GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
  ```

  For local host development you may override `DATABASE_URL` to point at `localhost` instead of the compose service:

  ```bash
  export DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat"
  ```

  ## 💻 Running Locally (without Docker for the API)

  1. Install Python deps with Poetry:

  ```bash
  poetry install
  ```

  2. Start Postgres and Redis (via Docker Compose):

  ```bash
  docker compose up -d db redis
  ```

  3. Apply database migrations (when DB is reachable):

  ```bash
  DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat" \
  poetry run alembic upgrade head
  ```

  4. Run the API in dev mode:

  ```bash
  poetry run uvicorn braumchat_api.main:app --reload
  ```

  API: http://localhost:8000
  Swagger: http://localhost:8000/docs

  ## 🐳 Running with Docker Compose

  Start the stack (API + Postgres + Redis):

  ```bash
  docker compose up --build
  ```

  Services:

  - API: http://localhost:8000
  - Postgres: exposed on localhost:5432 (when mapped)
  - Redis: available on Docker network as `redis:6379`

  If you generate/apply migrations from the host and Postgres runs in Docker, ensure Postgres is up. Example:

  ```bash
  DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat" \
  poetry run alembic upgrade head
  ```

  ## 🧬 Database Migrations (Alembic)

  Generate a new migration from models (autogenerate):

  ```bash
  DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat" \
  poetry run alembic revision --autogenerate -m "your message"
  ```

  Apply migrations:

  ```bash
  DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat" \
  poetry run alembic upgrade head
  ```

  Downgrade one revision:

  ```bash
  DATABASE_URL="postgresql+asyncpg://braumchat:password@localhost:5432/braumchat" \
  poetry run alembic downgrade -1
  ```

  ### Troubleshooting: did autogenerate create an empty migration?

  If the generated file has `upgrade()` with only `pass`, Alembic did not detect your models' metadata in the process that ran `alembic revision`. Quick diagnosis (run in the same environment you used to generate the revision — host or inside the container):

  ```bash
  # On the host (Poetry):
  poetry run python -c "from braumchat_api.db.base import Base; import braumchat_api.models; print(list(Base.metadata.tables.keys()))"

  # Or inside the api container:
  docker compose run --rm api sh -c 'python -c "from braumchat_api.db.base import Base; import braumchat_api.models; print(list(Base.metadata.tables.keys()))"'
  ```

  Expected output: a list of table names (e.g. `['users', 'workspaces', ...]`). If the list is empty:

  - Ensure `braumchat_api/models/__init__.py` imports all model modules.
  - Ensure `alembic/env.py` imports `braumchat_api.models` before defining `target_metadata` (this project already does that — see `alembic/env.py`).
  - Make sure you run `alembic` with the same `PYTHONPATH`/environment that can import the package (running via `docker compose run --rm api` usually works).

  If you prefer to avoid autogenerate, create an initial migration manually with the CREATE TABLE statements and place it in `alembic/versions/`.

  ## 🧪 Testing

  Tests use `pytest` and `pytest-asyncio`. Run tests:

  ```bash
  poetry run pytest
  ```

  Consider a separate test database and an `.env.test` for CI.

  ## 🛡️ Security Notes

  - Passwords are hashed (bcrypt recommended).
  - Authentication uses JWT access + refresh tokens.
  - Configure `CORS_ORIGINS` appropriately for production.
  - Terminate TLS at a reverse proxy (Nginx + Let's Encrypt) in production.

  ## 🚀 Roadmap (high level)

  - Google OAuth2 login implementation
  - Rate limiting (Redis)
  - Direct messages & multi-device session management
  - Presence and typing indicators via Redis pub/sub
  - Admin/audit logs per workspace
