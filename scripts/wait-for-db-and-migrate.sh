#!/usr/bin/env bash
set -euo pipefail

log() {
    echo "[migrate] $*"
}

MIGRATE_ON_START=${MIGRATE_ON_START:-true}
MIGRATE_TIMEOUT=${MIGRATE_TIMEOUT:-300}
MIGRATE_LOCK_TIMEOUT=${MIGRATE_LOCK_TIMEOUT:-600}
ADVISORY_LOCK_KEY=${ADVISORY_LOCK_KEY:-987654321}

# Monta DATABASE_URL se não vier do ambiente
if [ -n "${DATABASE_URL:-}" ]; then
    export DATABASE_URL
else
    DB_HOST=${DB_HOST:-db}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-braumchat}
    DB_PASSWORD=${DB_PASSWORD:-password}
    DB_NAME=${DB_NAME:-braumchat}
    export DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Extrai host/porta/usuario do DATABASE_URL (para o pg_isready)
output=$(python - <<'PY'
import os, urllib.parse as up
u = up.urlparse(os.environ.get('DATABASE_URL'))
host = u.hostname or 'db'
port = str(u.port or 5432)
user = u.username or 'braumchat'
pwd = u.password or ''
dbname = u.path[1:] if u.path else 'braumchat'
print(host, port, user, pwd, dbname)
PY
)

read URL_HOST URL_PORT URL_USER URL_PASS URL_DB <<< "$output"

HOST=${URL_HOST:-${DB_HOST:-db}}
PORT=${URL_PORT:-${DB_PORT:-5432}}
DB_USER=${URL_USER:-${DB_USER:-braumchat}}
DB_PASS=${URL_PASS:-${DB_PASSWORD:-password}}
DB_NAME=${URL_DB:-${DB_NAME:-braumchat}}

export PGPASSWORD="${DB_PASS}"

if [ "${MIGRATE_ON_START,,}" != "false" ]; then
    log "Aguardando Postgres em ${HOST}:${PORT} (usuario=${DB_USER})..."

    if command -v getent >/dev/null 2>&1; then
        log "DNS ${HOST}: $(getent hosts "${HOST}" | tr '\n' ' ' || true)"
    fi

    if ! command -v pg_isready >/dev/null 2>&1; then
        log "pg_isready nao encontrado; usando fallback TCP para aguardar o Postgres."
    fi

    start_ts=$(date +%s)
    while true; do
        ready=false

        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h "$HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -t 1 >/dev/null 2>&1; then
                ready=true
            fi
        else
            ready=false
        fi

        if [ "$ready" = false ]; then
            if python - <<PY >/dev/null 2>&1
import os, socket
host = os.environ.get('HOST') or 'db'
port = int(os.environ.get('PORT') or 5432)
s = socket.create_connection((host, port), timeout=1)
s.close()
PY
            then
                ready=true
            fi
        fi

        if [ "$ready" = true ]; then
            break
        fi

        printf '.'
        sleep 1
        now=$(date +%s)
        if [ $((now - start_ts)) -ge ${MIGRATE_TIMEOUT} ]; then
            echo
            log "Tempo esgotado aguardando Postgres apos ${MIGRATE_TIMEOUT}s"
            exit 1
        fi
    done

    echo
    log "Postgres pronto — preparando schema e executando migrations Alembic..."
    log "DATABASE_URL=${DATABASE_URL}"

    export DATABASE_URL_SYNC="${DATABASE_URL/+asyncpg/+psycopg}"

    python - <<'PY'
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL_SYNC')
if not db_url:
    raise SystemExit('DATABASE_URL_SYNC nao definido')

engine = create_engine(db_url, future=True)
with engine.begin() as conn:
    # adiciona users.username se estiver faltando
    col_exists = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='users' AND column_name='username'
            """
        )
    ).first()
    if not col_exists:
        # coluna nullable; a app exige no request, mas DB tolera NULL para dados antigos
        conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(32)"))
        # unique simples (create_user salva lower())
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_username_lookup ON users (lower(username))"))
        print('Reparo aplicado: users.username + indices')
    else:
        print('Reparo nao necessario: users.username ja existe')
PY

    baseline_info=$(python - <<'PY'
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL_SYNC')
engine = create_engine(db_url, future=True)

with engine.begin() as conn:
    has_alembic_version = conn.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version'")
    ).first() is not None

    if has_alembic_version:
        version = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()
    else:
        version = None

    users_exists = conn.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'")
    ).first() is not None

print((version or '__empty__'), ('1' if users_exists else '0'))
PY
)

    read CURRENT_REV USERS_EXISTS <<< "$baseline_info"

    if [ "${USERS_EXISTS:-0}" = "1" ] && [ "${CURRENT_REV:-__empty__}" = "__empty__" ]; then
        log "DB existente sem historico do Alembic — fazendo stamp head e criando tabelas faltantes"
        alembic stamp head

        python - <<'PY'
import os
from sqlalchemy import create_engine, inspect

try:
    import braumchat_api.models  # noqa: F401
    from braumchat_api.models.meta import Base
except Exception as exc:
    print('Nao foi possivel importar modelos:', exc)
    raise SystemExit(1)

db_url = os.environ.get('DATABASE_URL_SYNC')
if not db_url:
    raise SystemExit('DATABASE_URL_SYNC nao definido')

engine = create_engine(db_url, future=True)
insp = inspect(engine)
existing = set(insp.get_table_names(schema='public'))
all_tables = set(Base.metadata.tables.keys())
missing_names = sorted(all_tables - existing)

if missing_names:
    missing = [Base.metadata.tables[name] for name in missing_names]
    print('Criando tabelas faltantes:', missing_names)
    Base.metadata.create_all(engine, tables=missing)
else:
    print('Nenhuma tabela faltante; nada a criar via fallback.')
PY
    else
        alembic upgrade head
    fi

    log "Migrations finalizadas."
else
    log "MIGRATE_ON_START=false — migrations puladas."
fi

log "Iniciando aplicacao..."
exec "$@"
