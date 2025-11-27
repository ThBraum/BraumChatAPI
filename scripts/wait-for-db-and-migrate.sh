#!/usr/bin/env bash
set -euo pipefail

MIGRATE_ON_START=${MIGRATE_ON_START:-true}
MIGRATE_TIMEOUT=${MIGRATE_TIMEOUT:-300}
MIGRATE_LOCK_TIMEOUT=${MIGRATE_LOCK_TIMEOUT:-600}
ADVISORY_LOCK_KEY=${ADVISORY_LOCK_KEY:-987654321}

if [ -n "${DATABASE_URL:-}" ]; then
    export DATABASE_URL
else
    DB_HOST=${DB_HOST:-db}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-braumchat}
    DB_PASSWORD=${DB_PASSWORD:-password}
    DB_NAME=${DB_NAME:-braumchat}
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

output=$(python - <<'PY'
import os, urllib.parse as up
u=up.urlparse(os.environ.get('DATABASE_URL'))
host=u.hostname or 'db'
port=str(u.port or 5432)
user=u.username or 'braumchat'
pwd=u.password or ''
dbname=u.path[1:] if u.path else 'braumchat'
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
    echo "Waiting for Postgres at ${HOST}:${PORT} (user=${DB_USER})..."

    start_ts=$(date +%s)
    while ! pg_isready -h "$HOST" -p "$PORT" -U "$DB_USER" >/dev/null 2>&1; do
        printf '.'
        sleep 1
        now=$(date +%s)
        if [ $((now - start_ts)) -ge ${MIGRATE_TIMEOUT} ]; then
            echo
            echo "Timed out waiting for Postgres after ${MIGRATE_TIMEOUT}s"
            exit 1
        fi
    done

    echo
    echo "Postgres is ready — attempting to acquire advisory lock ${ADVISORY_LOCK_KEY} to run migrations..."

    lock_start=$(date +%s)
    got_lock=false
    while true; do
        res=$(psql -h "$HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -tA -c "SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY});" 2>/dev/null || echo f)
        if [ "$res" = "t" ]; then
            got_lock=true
            break
        fi
        printf '#'
        sleep 1
        now=$(date +%s)
        if [ $((now - lock_start)) -ge ${MIGRATE_LOCK_TIMEOUT} ]; then
            echo
            echo "Timed out waiting to acquire advisory lock after ${MIGRATE_LOCK_TIMEOUT}s"
            exit 1
        fi
    done

    if [ "$got_lock" = true ]; then
        echo
        echo "Advisory lock acquired — running migrations (only this instance will run them)"
        alembic upgrade head
        echo "Migrations finished — releasing advisory lock"
        psql -h "$HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY});" >/dev/null || true
    fi
else
    echo "MIGRATE_ON_START is false — skipping migrations."
fi

echo "Starting app..."
exec "$@"
