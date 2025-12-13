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

    start_ts=$(date +%s)
    while ! pg_isready -h "$HOST" -p "$PORT" -U "$DB_USER" >/dev/null 2>&1; do
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
    log "Postgres pronto — executando migrations Alembic..."
    log "DATABASE_URL=${DATABASE_URL}"

    alembic_status=0
    if alembic upgrade head; then
        log "Alembic concluiu com sucesso."
    else
        alembic_status=$?
        log "Alembic retornou erro (${alembic_status}). Tentando fallback incremental." >&2
    fi

    # Garante tabela de versao do Alembic e aplica stamp para o HEAD
    python - <<'PY'
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    raise SystemExit('DATABASE_URL nao definido; nao foi possivel criar alembic_version')

if '+asyncpg' in db_url:
    db_url = db_url.replace('+asyncpg', '+psycopg')

engine = create_engine(db_url, future=True)
with engine.begin() as conn:
    conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"))
print('Tabela alembic_version garantida.')
PY

    if ! alembic stamp head; then
        log "Falha ao fazer stamp do Alembic. Verifique logs." >&2
    fi

    # Fallback: cria apenas as tabelas que estiverem faltando
    python - <<'PY'
import os
from sqlalchemy import create_engine, inspect

try:
    import braumchat_api.models  # registra modelos
    from braumchat_api.models.meta import Base
except Exception as exc:
    print('Nao foi possivel importar modelos:', exc)
    raise SystemExit(1)

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    raise SystemExit('DATABASE_URL nao definido; nao foi possivel criar tabelas faltantes')

if '+asyncpg' in db_url:
    db_url = db_url.replace('+asyncpg', '+psycopg')

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

    log "Migrations finalizadas (com fallback se necessario)."
else
    log "MIGRATE_ON_START=false — migrations puladas."
fi

log "Iniciando aplicacao..."
exec "$@"
