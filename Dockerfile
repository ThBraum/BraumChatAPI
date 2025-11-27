FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV POETRY_VIRTUALENVS_CREATE=false
ENV POETRY_NO_INTERACTION=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry==1.6.1

WORKDIR /app

COPY pyproject.toml poetry.lock* /app/

RUN poetry install --no-dev --no-root

RUN pip install --no-cache-dir alembic==1.11.1

COPY . /app

COPY scripts/wait-for-db-and-migrate.sh /usr/local/bin/wait-for-db-and-migrate.sh
RUN chmod +x /usr/local/bin/wait-for-db-and-migrate.sh

EXPOSE 8000

CMD ["uvicorn", "braumchat_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
ENTRYPOINT ["/usr/local/bin/wait-for-db-and-migrate.sh"]
